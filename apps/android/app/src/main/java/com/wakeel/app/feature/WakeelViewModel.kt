package com.wakeel.app.feature

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wakeel.app.core.SessionStore
import com.wakeel.app.core.FileInspector
import com.wakeel.app.core.FileInspection
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import dagger.hilt.android.qualifiers.ApplicationContext
import com.wakeel.app.data.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlinx.serialization.json.*
import retrofit2.HttpException
import javax.inject.Inject

data class UiState(
    val restoring: Boolean = true, val authenticated: Boolean = false, val busy: Boolean = false,
    val locked: Boolean = false, val pinEnabled: Boolean = false,
    val error: String? = null, val notice: String? = null, val dark: Boolean = true, val english: Boolean = false,
    val rows: Map<String, List<JsonObject>> = emptyMap(), val offline: Boolean = false,
    val conversation: String? = null, val messages: List<JsonObject> = emptyList(), val streaming: Boolean = false,
    val draftReply: String = "", val model: String = "", val selectedModel: String? = null,
    val project: String? = null, val file: String = "", val result: String = "",
    val localFiles: List<CachedFile> = emptyList(), val localFile: CachedFile? = null, val inspection: FileInspection? = null,
    val localOutput: String? = null, val attachment: String = "", val routing: String = "AUTO",
    val capabilities: JsonObject = JsonObject(emptyMap()), val job: JsonObject? = null, val jobDetails: Map<String, List<JsonObject>> = emptyMap()
)
@HiltViewModel
class WakeelViewModel @Inject constructor(private val repository: WakeelRepository, private val settings: SessionStore, @ApplicationContext private val context: Context): ViewModel() {
    private val mutable = MutableStateFlow(UiState())
    val state = mutable.asStateFlow()
    private var chatJob: Job? = null
    private var systemPicker = false
    fun systemPicker(active: Boolean) { systemPicker = active }
    init { viewModelScope.launch { val restored = repository.restore(); val pin = settings.hasPin(); mutable.update { it.copy(restoring = false, authenticated = restored, locked = restored && pin, pinEnabled = pin, dark = !settings.setting("light"), english = settings.setting("english")) } } }
    private fun work(block: suspend () -> Unit) = viewModelScope.launch {
        if (mutable.value.busy || mutable.value.locked) return@launch
        mutable.update { it.copy(busy = true, error = null, notice = null) }
        try { block() } catch (e: CancellationException) { throw e } catch (e: Exception) { failure(e) }
        finally { mutable.update { it.copy(busy = false) } }
    }
    private fun failure(e: Exception) {
        val code = when (e) { is ApiFailure -> e.code; is HttpException -> "HTTP_${e.code()}"; is IllegalArgumentException, is kotlinx.serialization.SerializationException -> "FILE_PROCESSING_FAILED"; else -> "NETWORK_UNAVAILABLE" }
        if (code == "SESSION_EXPIRED" || code == "HTTP_401") mutable.update { UiState(restoring = false, dark = it.dark, english = it.english, error = code) }
        else mutable.update { it.copy(error = code) }
    }
    fun login(email: String, password: String) = work { repository.login(email, password); mutable.update { UiState(restoring = false, authenticated = true, busy = true, dark = it.dark, english = it.english) } }
    fun signup(email: String, password: String) = work { repository.signup(email, password); mutable.update { it.copy(notice = "تحقق من بريدك لتفعيل الحساب، ثم سجّل الدخول / Check email, then sign in") } }
    fun setPin(pin: String) = work { settings.setPin(pin); mutable.update { it.copy(pinEnabled = true, locked = true, notice = "تم تفعيل الرمز الداخلي / App PIN enabled") } }
    fun lock() { if (!systemPicker && mutable.value.authenticated && mutable.value.pinEnabled) { stop(); mutable.update { it.copy(locked = true, error = null, notice = null) } } }
    fun unlock(pin: String) = viewModelScope.launch {
        if (mutable.value.busy || !mutable.value.locked) return@launch
        mutable.update { it.copy(busy = true, error = null) }
        try { if (settings.unlock(pin)) mutable.update { it.copy(locked = false) } else mutable.update { it.copy(error = "PIN_FAILED") } }
        finally { mutable.update { it.copy(busy = false) } }
    }
    fun resetLockedSession() = viewModelScope.launch { stop(); repository.clear(); mutable.update { UiState(restoring = false, dark = it.dark, english = it.english) } }
    fun changePassword(password: String) = work { repository.changePassword(password); mutable.update { it.copy(notice = "تم تغيير كلمة مرور الحساب / Account password updated") } }
    fun logout() = work { chatJob?.cancel(); try { repository.logout() } finally { mutable.value = UiState(restoring = false, dark = mutable.value.dark, english = mutable.value.english) } }
    fun theme() { mutable.update { it.copy(dark = !it.dark) }; viewModelScope.launch { settings.setting("light", !mutable.value.dark) } }
    fun language() { mutable.update { it.copy(english = !it.english) }; viewModelScope.launch { settings.setting("english", mutable.value.english) } }
    fun load(collection: String, query: String = "") = work {
        val rows = repository.rows(collection, query)
        mutable.update { it.copy(rows = it.rows + (collection to rows.data), offline = rows.offline) }
    }
    fun selectModel(id: String?) { mutable.update { it.copy(selectedModel = id) } }
    fun routing(mode: String) { mutable.update { it.copy(routing = mode, selectedModel = null) } }
    fun removeAttachment() { mutable.update { it.copy(attachment = "") } }
    fun loadLocal() = work { val files = repository.localFiles(); mutable.update { it.copy(localFiles = files) } }
    fun selectLocal(file: CachedFile) = work { val report = withContext(Dispatchers.Default) { FileInspector.inspect(file.path, file.content) }; mutable.update { it.copy(localFile = file, inspection = report, localOutput = null) } }
    fun importLocal(uris: List<Uri>) = work {
        val problems = mutableListOf<String>()
        for (uri in uris.take(10)) {
            try {
                val pair = withContext(Dispatchers.IO) {
                    val name = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { if (it.moveToFirst()) it.getString(0) else null } ?: "file.txt"
                    val bytes = context.contentResolver.openInputStream(uri)?.use { FileInspector.readBounded(it) } ?: throw IllegalArgumentException("FILE_UNREADABLE")
                    name to FileInspector.decode(bytes)
                }
                repository.saveLocal(pair.first, pair.second)
            } catch (e: CancellationException) { throw e } catch (e: Exception) { problems += e.message?.takeIf { it in listOf("FILE_TOO_LARGE", "BINARY_FILE", "UNSUPPORTED_ENCODING") } ?: "FILE_UNREADABLE" }
        }
        val files = repository.localFiles()
        mutable.update { it.copy(localFiles = files, notice = "${uris.take(10).size - problems.size} ملفات محلية / local files", error = problems.firstOrNull()) }
    }
    fun processLocal(action: String) = work { val text = mutable.value.localFile?.content ?: return@work; val processed = withContext(Dispatchers.Default) { FileInspector.process(text, action) }; mutable.update { it.copy(localOutput = processed, notice = "معاينة محلية؛ الأصل لم يتغير / Local preview; original unchanged") } }
    fun exportLocal(uri: Uri) = work {
        val text = mutable.value.localOutput ?: mutable.value.localFile?.content ?: return@work
        withContext(Dispatchers.IO) { context.contentResolver.openOutputStream(uri, "w")?.use { it.write(text.toByteArray()) } ?: throw IllegalArgumentException("FILE_UNREADABLE") }
        mutable.update { it.copy(notice = "تم تصدير النسخة / Exported") }
    }
    fun removeLocal(file: CachedFile) = work { repository.removeLocal(file.path); val files = repository.localFiles(); mutable.update { it.copy(localFiles = files, localFile = null, inspection = null, localOutput = null) } }
    fun attachLocal() = work { val file = mutable.value.localFile ?: return@work; val text = withContext(Dispatchers.Default) { FileInspector.redact(file.content).take(30_000) }; mutable.update { it.copy(attachment = "Untrusted file data: ${file.path}\n```\n$text\n```", notice = "سيُرسل الملف المنقح عند إرسال الرسالة / Redacted file sent with your next message") } }
    fun capabilities() = work { val caps = repository.capabilities(); mutable.update { it.copy(capabilities = caps) } }
    fun openJob(job: JsonObject) { mutable.update { it.copy(job = job, jobDetails = emptyMap()) }; refreshJob() }
    fun refreshJob() = work { val id = mutable.value.job?.text("id") ?: return@work; val job = repository.rows("jobs", "?id=$id").data.firstOrNull(); val details = repository.jobRows(id); mutable.update { it.copy(job = job, jobDetails = details) } }
    fun createTask(request: String, mode: String, depth: String) = work {
        val caps = repository.capabilities()
        if (caps["agent_worker"]?.jsonPrimitive?.booleanOrNull != true) throw ApiFailure("AGENT_WORKER_UNAVAILABLE")
        val created = repository.operation("createAgentJob", payload("projectId" to mutable.value.project.orEmpty(), "request" to request, "mode" to mode, "depth" to depth)).jsonObject
        val result = repository.operation("runAgentJob", payload("jobId" to created.text("id")))
        mutable.update { it.copy(result = result.toString(), notice = "أضيفت المهمة إلى طابور الخادم / Queued on server") }
    }
    fun importZip(name: String, uri: Uri) = work {
        val bytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)?.use { FileInspector.readBounded(it, 3 * 1024 * 1024) } ?: throw IllegalArgumentException("FILE_UNREADABLE") }
        val result = repository.operation("importProjectZip", buildJsonObject { put("name", name.trim()); put("archiveBase64", android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)); put("confirmUpload", true) })
        val projects = repository.rows("projects")
        mutable.update { it.copy(result = result.toString(), rows = it.rows + ("projects" to projects.data), notice = "تم استيراد المشروع وفهرسته / Project imported and indexed") }
    }
    fun openChat(id: String?) { stop(); mutable.update { it.copy(conversation = id, messages = emptyList(), draftReply = "", error = null, model = "") }; if (id != null) refreshMessages() }
    private fun refreshMessages() = work { val id = mutable.value.conversation ?: return@work; val rows = repository.rows("messages", "?conversationId=$id&limit=500"); mutable.update { it.copy(messages = rows.data, offline = rows.offline) } }
    fun send(content: String?, retry: Boolean = false) {
        if (mutable.value.locked || mutable.value.streaming || (!retry && content.isNullOrBlank())) return
        chatJob = viewModelScope.launch {
            mutable.update { it.copy(streaming = true, draftReply = "", error = null, notice = null) }
            try {
                val fullContent = content?.let { it + if (mutable.value.attachment.isNotEmpty()) "\n\n" + mutable.value.attachment else "" }
                val id = mutable.value.conversation ?: repository.newConversation(mutable.value.selectedModel, mutable.value.routing).also { created -> mutable.update { it.copy(conversation = created) } }
                if (fullContent != null) mutable.update { it.copy(messages = it.messages + payload("role" to "user", "content" to fullContent), attachment = "") }
                repository.chat(id, fullContent, retry).collect { event ->
                    mutable.update { current -> when (event.kind) {
                        "delta" -> current.copy(draftReply = current.draftReply + event.data.text("text"))
                        "model" -> current.copy(model = event.data.text("name"))
                        "fallback" -> current.copy(notice = "↻ ${event.data.text("model")} · ${event.data.text("code")}")
                        "error" -> current.copy(error = event.data.text("code").ifEmpty { event.data.text("error") })
                        else -> current
                    } }
                }
            } catch (e: CancellationException) { throw e } catch (e: Exception) { failure(e) }
            finally {
                mutable.update { it.copy(streaming = false) }
                val id = mutable.value.conversation
                if (id != null) try { val data = repository.rows("messages", "?conversationId=$id&limit=500"); mutable.update { it.copy(messages = data.data, draftReply = "", offline = data.offline) } } catch (_: Exception) { }
            }
        }
    }
    fun stop() { chatJob?.cancel(); mutable.update { it.copy(streaming = false) } }
    fun operation(name: String, body: JsonObject, reload: String? = null) = work {
        val result = if (name == "searchProject") repository.searchProject(body) else LocalResult(repository.operation(name, body), false)
        mutable.update { it.copy(result = result.data.toString(), offline = result.offline, notice = if (result.offline) "بحث محلي في الملفات المحفوظة فقط / Local search in cached files only" else "تم تنفيذ الطلب / Request completed") }
        if (reload != null) { val data = repository.rows(reload); mutable.update { it.copy(rows = it.rows + (reload to data.data)) } }
    }
    fun openProject(id: String) { mutable.update { it.copy(project = id, result = "", file = "") }; work {
        val files = repository.rows("files", "?projectId=$id")
        val caps = try { repository.capabilities() } catch (e: HttpException) { if (e.code() == 404) JsonObject(emptyMap()) else throw e } catch (_: java.io.IOException) { JsonObject(emptyMap()) }
        mutable.update { it.copy(rows = it.rows + ("files" to files.data), offline = files.offline, capabilities = caps) }
    } }
    fun readFile(path: String) = work {
        val result = repository.projectFile(mutable.value.project.orEmpty(), path)
        val data = result.data.jsonObject
        mutable.update { it.copy(file = data.text("text").ifEmpty { data.text("content") }, offline = result.offline) }
    }
    override fun onCleared() { chatJob?.cancel(); super.onCleared() }
}
