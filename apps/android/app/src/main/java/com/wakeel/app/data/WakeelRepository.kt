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
import okhttp3.RequestBody.Companion.toRequestBody
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

data class Rows(val data: List<JsonObject>, val offline: Boolean = false)
data class ChatEvent(val kind: String, val data: JsonObject)
class ApiFailure(val code: String): Exception(code)

@Singleton
class WakeelRepository @Inject constructor(private val api: WakeelApi, private val client: OkHttpClient, private val store: SessionStore, private val database: WakeelDatabase) {
    private val json = Json { ignoreUnknownKeys = true }
    private val lock = Mutex()
    private var session: Session? = null
    private var owner = ""
    suspend fun restore(): Boolean { session = store.read(); if (session == null) return false; return try { token(); true } catch (e: ApiFailure) { if (e.code == "SESSION_EXPIRED") clear(); false } catch (_: Exception) { true } }
    suspend fun login(email: String, password: String) {
        val data = checked(api.post("v1/auth/login", payload("email" to email.trim(), "password" to password))) as JsonObject
        session = json.decodeFromJsonElement<Session>(data); store.save(session!!); owner = data["user"]?.jsonObject?.text("id").orEmpty()
    }
    suspend fun signup(email: String, password: String) {
        // Publishable project key; never a service-role/server key.
        api.signup("https://ywtfvgkhrmouqxsocgdq.supabase.co/auth/v1/signup", "sb_publishable_q_GnsHqOuoY1gcVvMraQ-Q_E4JLk9Zb", payload("email" to email.trim(), "password" to password))
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
    suspend fun clear() { session = null; owner = ""; store.clear(); database.cache().clear() }
    suspend fun logout() { try { api.post("v1/auth/logout", JsonObject(emptyMap()), "Bearer ${token()}") } finally { clear() } }
    suspend fun rows(collection: String, query: String = ""): Rows {
        val bearer = token()
        val cacheKey = collection + query
        return try {
            val data = checked(api.get("v1/data/$collection$query", "Bearer $bearer")) as JsonArray
            database.cache().save(CachedRows(owner, cacheKey, data.toString()))
            Rows(data.map { it.jsonObject })
        } catch (e: Exception) {
            if (e is HttpException || e is ApiFailure) throw e
            val cached = database.cache().read(owner, cacheKey) ?: throw e
            Rows(json.parseToJsonElement(cached).jsonArray.map { it.jsonObject }, true)
        }
    }
    suspend fun operation(name: String, body: JsonObject): JsonElement = checked(api.post("v1/operations/$name", body, "Bearer ${token()}"))
    suspend fun newConversation(model: String?): String {
        val body = buildJsonObject { put("routingMode", if (model == null) "AUTO" else "MANUAL"); model?.let { put("modelId", it) } }
        return checked(api.post("v1/conversations", body, "Bearer ${token()}")).jsonObject.text("id")
    }
    fun chat(id: String, content: String?, retry: Boolean = false): Flow<ChatEvent> = channelFlow {
        val bearer = token()
        val body = buildJsonObject { put("conversationId", id); content?.let { put("content", it) }; if (retry) put("retry", true) }
        val call = client.newCall(Request.Builder().url(BuildConfig.API_ORIGIN + "v1/chat").header("Authorization", "Bearer $bearer").header("Accept", "text/event-stream").post(body.toString().toRequestBody("application/json".toMediaType())).build())
        val cancelOnClose = launch { try { awaitCancellation() } finally { call.cancel() } }
        try {
            withContext(Dispatchers.IO) {
                call.execute().use { response ->
                    if (!response.isSuccessful) throw ApiFailure("HTTP_${response.code}")
                    val source = response.body?.source() ?: throw ApiFailure("EMPTY_RESPONSE")
                    var done = false
                    val parser = SseParser { event, raw ->
                        val data = json.parseToJsonElement(raw).jsonObject
                        if (event == "done") done = true
                        trySend(ChatEvent(event, data))
                    }
                    while (isActive) { val line = source.readUtf8Line() ?: break; parser.line(line) }
                    if (!done) throw ApiFailure("STREAM_INTERRUPTED")
                }
            }
        } finally { call.cancel(); cancelOnClose.cancel() }
    }
}
