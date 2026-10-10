package com.wakeel.app.feature

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.wakeel.app.core.SessionStore
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
    val project: String? = null, val file: String = "", val result: String = ""
)
@HiltViewModel
class WakeelViewModel @Inject constructor(private val repository: WakeelRepository, private val settings: SessionStore): ViewModel() {
    private val mutable = MutableStateFlow(UiState())
    val state = mutable.asStateFlow()
    private var chatJob: Job? = null
    init { viewModelScope.launch { val restored = repository.restore(); val pin = settings.hasPin(); mutable.update { it.copy(restoring = false, authenticated = restored, locked = restored && pin, pinEnabled = pin, dark = !settings.setting("light"), english = settings.setting("english")) } } }
    private fun work(block: suspend () -> Unit) = viewModelScope.launch {
        if (mutable.value.busy || mutable.value.locked) return@launch
        mutable.update { it.copy(busy = true, error = null, notice = null) }
        try { block() } catch (e: CancellationException) { throw e } catch (e: Exception) { failure(e) }
        finally { mutable.update { it.copy(busy = false) } }
    }
    private fun failure(e: Exception) {
        val code = when (e) { is ApiFailure -> e.code; is HttpException -> "HTTP_${e.code()}"; else -> "NETWORK_UNAVAILABLE" }
        if (code == "SESSION_EXPIRED" || code == "HTTP_401") mutable.update { UiState(restoring = false, dark = it.dark, english = it.english, error = code) }
        else mutable.update { it.copy(error = code) }
    }
    fun login(email: String, password: String) = work { repository.login(email, password); mutable.update { UiState(restoring = false, authenticated = true, busy = true, dark = it.dark, english = it.english) } }
    fun signup(email: String, password: String) = work { repository.signup(email, password); mutable.update { it.copy(notice = "تحقق من بريدك لتفعيل الحساب، ثم سجّل الدخول / Check email, then sign in") } }
    fun setPin(pin: String) = work { settings.setPin(pin); mutable.update { it.copy(pinEnabled = true, locked = true, notice = "تم تفعيل الرمز الداخلي / App PIN enabled") } }
    fun lock() { if (mutable.value.authenticated && mutable.value.pinEnabled) { stop(); mutable.update { it.copy(locked = true, error = null, notice = null) } } }
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
    fun openChat(id: String?) { stop(); mutable.update { it.copy(conversation = id, messages = emptyList(), draftReply = "", error = null, model = "") }; if (id != null) refreshMessages() }
    private fun refreshMessages() = work { val id = mutable.value.conversation ?: return@work; val rows = repository.rows("messages", "?conversationId=$id&limit=500"); mutable.update { it.copy(messages = rows.data, offline = rows.offline) } }
    fun send(content: String?, retry: Boolean = false) {
        if (mutable.value.locked || mutable.value.streaming || (!retry && content.isNullOrBlank())) return
        chatJob = viewModelScope.launch {
            mutable.update { it.copy(streaming = true, draftReply = "", error = null, notice = null) }
            try {
                val id = mutable.value.conversation ?: repository.newConversation(mutable.value.selectedModel).also { created -> mutable.update { it.copy(conversation = created) } }
                if (content != null) mutable.update { it.copy(messages = it.messages + payload("role" to "user", "content" to content)) }
                repository.chat(id, content, retry).collect { event ->
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
    fun openProject(id: String) { mutable.update { it.copy(project = id, result = "", file = "") }; load("files", "?projectId=$id") }
    fun readFile(path: String) = work {
        val result = repository.projectFile(mutable.value.project.orEmpty(), path)
        val data = result.data.jsonObject
        mutable.update { it.copy(file = data.text("text").ifEmpty { data.text("content") }, offline = result.offline) }
    }
    override fun onCleared() { chatJob?.cancel(); super.onCleared() }
}
