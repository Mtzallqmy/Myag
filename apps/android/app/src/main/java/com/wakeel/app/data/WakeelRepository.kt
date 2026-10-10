package com.wakeel.app.data

import com.wakeel.app.BuildConfig
import com.wakeel.app.core.*
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.channelFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

data class Rows(val data: List<JsonObject>, val offline: Boolean = false)
data class ChatEvent(val kind: String, val data: JsonObject)
data class LocalResult(val data: JsonElement, val offline: Boolean)
class ApiFailure(val code: String): Exception(code)

@Singleton
class WakeelRepository @Inject constructor(private val api: WakeelApi, private val client: OkHttpClient, private val store: SessionStore, private val database: WakeelDatabase, @dagger.hilt.android.qualifiers.ApplicationContext private val context: android.content.Context) {
    private val json = Json { ignoreUnknownKeys = true }
    private val lock = Mutex()
    private var session: Session? = null
    private var owner = ""
    suspend fun restore(): Boolean { session = store.read(); owner = session?.user?.id.orEmpty(); if (session == null) return false; return try { token(); true } catch (e: ApiFailure) { if (e.code == "SESSION_EXPIRED") clear(); false } catch (_: Exception) { true } }
    suspend fun login(email: String, password: String) {
        val response = try { api.post("v1/auth/login", payload("email" to email.trim(), "password" to password)) } catch (e: HttpException) {
            if (e.code() == 401) throw ApiFailure("LOGIN_FAILED")
            throw e
        }
        val data = checked(response) as JsonObject
        session = json.decodeFromJsonElement<Session>(data); store.save(session!!); owner = data["user"]?.jsonObject?.text("id").orEmpty()
    }
    suspend fun signup(email: String, password: String) {
        // Publishable project key; never a service-role/server key.
        api.signup("https://ywtfvgkhrmouqxsocgdq.supabase.co/auth/v1/signup", "sb_publishable_q_GnsHqOuoY1gcVvMraQ-Q_E4JLk9Zb", payload("email" to email.trim(), "password" to password))
    }
    suspend fun changePassword(password: String) {
        require(password.length >= 8)
        api.updateUser("https://ywtfvgkhrmouqxsocgdq.supabase.co/auth/v1/user", "sb_publishable_q_GnsHqOuoY1gcVvMraQ-Q_E4JLk9Zb", "Bearer ${token()}", payload("password" to password))
    }
    private fun checked(result: JsonObject): JsonElement {
        if (result["ok"]?.jsonPrimitive?.booleanOrNull == false) throw ApiFailure(result.text("error"))
        return result["data"] ?: JsonNull
    }
    private suspend fun token(): String = lock.withLock {
        var current = session ?: throw ApiFailure("SESSION_EXPIRED")
        if (current.expires_at <= System.currentTimeMillis() / 1000 + 60) {
            try {
                val data = checked(api.post("v1/auth/refresh", payload("refreshToken" to current.refresh_token)))
                current = json.decodeFromJsonElement(data); session = current; store.save(current)
                owner = (data as? JsonObject)?.get("user")?.jsonObject?.text("id").orEmpty()
            } catch (e: HttpException) { if (e.code() == 401) { clear(); throw ApiFailure("SESSION_EXPIRED") }; throw e }
        }
        if (owner.isEmpty()) {
            // Cache key only; JWT is never decoded to authorize operations.
            owner = java.security.MessageDigest.getInstance("SHA-256").digest(current.refresh_token.toByteArray()).joinToString("") { "%02x".format(it) }
        }
        current.access_token
    }
    suspend fun clear() { session = null; owner = ""; store.clear(); database.cache().clear(); database.files().clear(); database.media().clear(); withContext(Dispatchers.IO) { java.io.File(context.cacheDir, "media-previews").deleteRecursively() } }
    suspend fun logout() { try { api.post("v1/auth/logout", JsonObject(emptyMap()), "Bearer ${token()}") } finally { clear() } }
    suspend fun rows(collection: String, query: String = ""): Rows {
        val cacheKey = collection + query
        return try {
            val bearer = token()
            val data = if (collection == "models" && query.isEmpty()) {
                val all = mutableListOf<JsonElement>()
                for (offset in 0 until 3_000 step 500) {
                    val page = checked(api.get("v1/data/models?offset=$offset&limit=500", "Bearer $bearer")) as JsonArray
                    all.addAll(page)
                    if (page.size < 500) break
                }
                JsonArray(all)
            } else checked(api.get("v1/data/$collection$query", "Bearer $bearer")) as JsonArray
            database.cache().save(CachedRows(owner, cacheKey, data.toString()))
            Rows(data.map { it.jsonObject }.let { if (collection == "messages") it.sortedBy { row -> row.text("created_at") } else it })
        } catch (e: Exception) {
            if (e !is IOException || owner.isEmpty()) throw e
            val cached = database.cache().read(owner, cacheKey) ?: throw e
            Rows(json.parseToJsonElement(cached).jsonArray.map { it.jsonObject }.let { if (collection == "messages") it.sortedBy { row -> row.text("created_at") } else it }, true)
        }
    }
    suspend fun projectFile(projectId: String, path: String): LocalResult {
        return try {
            val data = operation("readFile", payload("projectId" to projectId, "path" to path)).jsonObject
            val content = data.text("content").ifEmpty { data.text("text") }
            if (content.length <= 600_000 && data["is_binary"]?.jsonPrimitive?.booleanOrNull != true) {
                database.files().save(CachedFile(owner, projectId, path, content, System.currentTimeMillis()))
                database.files().trim(owner, projectId)
            }
            LocalResult(data, false)
        } catch (e: IOException) {
            if (owner.isEmpty()) throw e
            val file = database.files().read(owner, projectId, path) ?: throw ApiFailure("FILE_NOT_CACHED")
            LocalResult(payload("path" to path, "content" to file.content), true)
        }
    }
    suspend fun searchProject(body: JsonObject): LocalResult {
        return try { LocalResult(operation("searchProject", body), false) } catch (e: IOException) {
            if (owner.isEmpty()) throw e
            val files = database.files().files(owner, body.text("projectId"))
            if (files.isEmpty()) throw ApiFailure("PROJECT_NOT_CACHED")
            val hits = withContext(Dispatchers.Default) { LocalSearch.find(files.map { it.path to it.content }, body.text("query")) }
            LocalResult(buildJsonArray { hits.forEach { hit -> add(buildJsonObject { put("kind", hit.kind); put("path", hit.path); put("line", hit.line); put("preview", hit.preview) }) } }, true)
        }
    }
    suspend fun operation(name: String, body: JsonObject): JsonElement = checked(api.post("v1/operations/$name", body, "Bearer ${token()}"))
    suspend fun mediaFiles(): List<CachedMedia> = database.media().files(owner)
    suspend fun saveMedia(report: MediaInspection) {
        if (owner.isEmpty()) throw ApiFailure("SESSION_EXPIRED")
        if (database.media().count(owner) >= 100 && database.media().files(owner).none { it.uri == report.uri }) { report.preview?.let { java.io.File(it).delete() }; throw ApiFailure("LOCAL_MEDIA_LIMIT") }
        database.media().save(CachedMedia(owner, report.uri, report.name, report.mime, report.size, report.metadata.toString(), report.preview, System.currentTimeMillis()))
    }
    suspend fun removeMedia(uri: String) = database.media().remove(owner, uri)
    suspend fun upload(context: android.content.Context, uri: android.net.Uri, name: String, mime: String, size: Long, vision: Boolean, progress: (Long) -> Unit): JsonObject {
        val allowed = setOf("image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/mp4", "application/pdf", "application/zip", "text/plain")
        val contentType = if (mime in allowed) mime else "application/octet-stream"
        if (size <= 0 || size > 50L * 1024 * 1024 || (vision && size > 1024 * 1024)) throw ApiFailure("UPLOAD_TOO_LARGE")
        val prepared = operation("prepareUpload", buildJsonObject { put("name", name); put("mime", contentType); put("size", size); put("purpose", if (vision) "VISION" else "FILE"); put("confirmUpload", true) }).jsonObject
        val url = prepared.text("signedUrl").toHttpUrl()
        // Only the configured private Supabase upload origin; never forward a bearer token.
        if (url.scheme != "https" || url.host != "ywtfvgkhrmouqxsocgdq.supabase.co" || !url.encodedPath.startsWith("/storage/v1/object/upload/sign/wakeel-uploads/")) throw ApiFailure("INVALID_UPLOAD_DESTINATION")
        val body = object : RequestBody() {
            override fun contentType() = contentType.toMediaType()
            override fun contentLength() = size
            override fun writeTo(sink: okio.BufferedSink) {
                context.contentResolver.openInputStream(uri)?.use { input ->
                    val buffer = ByteArray(64 * 1024); var sent = 0L; var reported = 0L
                    while (true) { val read = input.read(buffer); if (read < 0) break; sent += read; if (sent > size) throw IOException("FILE_CHANGED"); sink.write(buffer, 0, read); if (sent - reported >= 256 * 1024 || sent == size) { progress(sent); reported = sent } }
                    if (sent != size) throw IOException("FILE_CHANGED")
                } ?: throw IOException("FILE_UNREADABLE")
            }
        }
        val call = client.newBuilder().followRedirects(false).followSslRedirects(false).callTimeout(10, java.util.concurrent.TimeUnit.MINUTES).build().newCall(Request.Builder().url(url).header("x-upsert", "false").header("cache-control", "max-age=0").put(body).build())
        coroutineScope {
            val cancel = launch { try { awaitCancellation() } finally { call.cancel() } }
            try { withContext(Dispatchers.IO) { call.execute().use { if (!it.isSuccessful) throw ApiFailure("UPLOAD_HTTP_${it.code}") } } }
            finally { cancel.cancel(); call.cancel() }
        }
        return operation("finalizeUpload", payload("id" to prepared.text("id"))).jsonObject
    }
    suspend fun localFiles(): List<CachedFile> { if (owner.isEmpty()) throw ApiFailure("SESSION_EXPIRED"); return database.files().files(owner, "LOCAL") }
    suspend fun saveLocal(name: String, content: String): CachedFile {
        if (owner.isEmpty()) throw ApiFailure("SESSION_EXPIRED")
        val report = withContext(Dispatchers.Default) { FileInspector.inspect(name, content) }
        val safeName = name.replace(Regex("[\\\\/\\p{Cntrl}]"), "_").take(150).ifBlank { "file.txt" }
        val file = CachedFile(owner, "LOCAL", report.sha256.take(12) + "/" + safeName, content, System.currentTimeMillis())
        database.files().save(file); database.files().trim(owner, "LOCAL"); return file
    }
    suspend fun removeLocal(path: String) = database.files().remove(owner, "LOCAL", path)
    suspend fun capabilities(): JsonObject = checked(api.get("v1/capabilities", "Bearer ${token()}")).jsonObject
    suspend fun connections(): JsonObject {
        val bearer = token()
        val checks = linkedMapOf<String, JsonElement>()
        for ((name, path) in listOf("API" to "health/ready", "PROVIDERS" to "v1/data/providers?limit=100", "MODELS" to "v1/data/models?limit=500", "WORKER" to "v1/capabilities", "AGENTS" to "v1/agent/profiles", "TELEGRAM" to "v1/data/telegram")) {
            val started = System.nanoTime()
            try {
                val response = api.get(path, "Bearer $bearer")
                val data = if (name == "API") response else checked(response)
                checks[name] = buildJsonObject { put("status", "CONNECTED"); put("latency_ms", (System.nanoTime() - started) / 1_000_000); put("data", data) }
            } catch (e: CancellationException) { throw e }
            catch (e: HttpException) { if (e.code() == 401) throw e; checks[name] = payload("status" to "FAILED", "error" to "HTTP_${e.code()}") }
            catch (_: IOException) { checks[name] = payload("status" to "OFFLINE", "error" to "NETWORK_UNAVAILABLE") }
            catch (e: ApiFailure) { throw e }
        }
        return JsonObject(checks)
    }
    suspend fun jobRows(jobId: String): Map<String, List<JsonObject>> = listOf("steps", "changes", "validations").associateWith { rows(it, "?jobId=$jobId").data }
    suspend fun newConversation(model: String?, routing: String = "AUTO"): String {
        val body = buildJsonObject { put("routingMode", if (model == null) routing else "MANUAL"); model?.let { put("modelId", it) } }
        return checked(api.post("v1/conversations", body, "Bearer ${token()}")).jsonObject.text("id")
    }
    fun chat(id: String, content: String?, retry: Boolean = false, imageIds: List<String> = emptyList()): Flow<ChatEvent> = channelFlow {
        val bearer = token()
        val body = buildJsonObject { put("conversationId", id); content?.let { put("content", it) }; if (retry) put("retry", true); if (imageIds.isNotEmpty()) put("imageIds", JsonArray(imageIds.map(::JsonPrimitive))) }
        val call = client.newCall(Request.Builder().url(BuildConfig.API_ORIGIN + "v1/chat").header("Authorization", "Bearer $bearer").header("Accept", "text/event-stream").post(body.toString().toRequestBody("application/json".toMediaType())).build())
        val cancelOnClose = launch { try { awaitCancellation() } finally { call.cancel() } }
        try {
            withContext(Dispatchers.IO) {
                call.execute().use { response ->
                    if (!response.isSuccessful) throw ApiFailure("HTTP_${response.code}")
                    val source = response.body?.source() ?: throw ApiFailure("EMPTY_RESPONSE")
                    var done = false
                    val pending = mutableListOf<ChatEvent>()
                    val parser = SseParser { event, raw ->
                        val data = json.parseToJsonElement(raw).jsonObject
                        if (event == "done" || event == "error") done = true
                        pending.add(ChatEvent(event, data))
                    }
                    while (isActive) {
                        val line = source.readUtf8Line() ?: break
                        parser.line(line)
                        for (event in pending) send(event) // Suspend for backpressure; never drop text deltas.
                        pending.clear()
                    }
                    if (!done) throw ApiFailure("STREAM_INTERRUPTED")
                }
            }
        } finally { call.cancel(); cancelOnClose.cancel() }
    }
}
