package com.wakeel.app

import android.os.Bundle
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.unit.*
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.*
import androidx.work.*
import com.wakeel.app.data.*
import com.wakeel.app.feature.*
import dagger.hilt.android.AndroidEntryPoint
import io.noties.markwon.Markwon
import kotlinx.serialization.json.*

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val viewModel: WakeelViewModel by viewModels()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState); enableEdgeToEdge()
        WorkManager.getInstance(this).enqueueUniqueWork("wakeel-connectivity", ExistingWorkPolicy.KEEP,
            OneTimeWorkRequestBuilder<HealthWorker>().setConstraints(androidx.work.Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build())
        setContent { Wakeel(viewModel) }
    }
    override fun onStop() { viewModel.lock(); super.onStop() }
}

private fun UiState.label(ar: String, en: String) = if (english) en else ar
@Composable private fun Wakeel(vm: WakeelViewModel) {
    val state by vm.state.collectAsStateWithLifecycle()
    val colors = if (state.dark) darkColorScheme(primary = Color(0xFF59D1C3), background = Color(0xFF0C1724), surface = Color(0xFF132538), secondary = Color(0xFFA8B9FF))
    else lightColorScheme(primary = Color(0xFF006D65), background = Color(0xFFF6F8FC), surface = Color.White, secondary = Color(0xFF4959A5))
    MaterialTheme(colorScheme = colors) {
        CompositionLocalProvider(LocalLayoutDirection provides if (state.english) LayoutDirection.Ltr else LayoutDirection.Rtl) {
            Surface(Modifier.fillMaxSize()) {
                when { state.restoring -> Box(Modifier.fillMaxSize(), contentAlignment = androidx.compose.ui.Alignment.Center) { CircularProgressIndicator() }
                    !state.authenticated -> Login(state, vm)
                    state.locked -> AppLock(state, vm)
                    else -> Shell(state, vm) }
            }
        }
    }
}
@Composable private fun Login(state: UiState, vm: WakeelViewModel) {
    var email by rememberSaveable { mutableStateOf("mtzallqmy@gmail.com") }
    var password by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(false) }
    Column(Modifier.safeDrawingPadding().imePadding().padding(28.dp).verticalScroll(rememberScrollState()).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Spacer(Modifier.height(36.dp))
        Text("وكيل", fontSize = 46.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
        Text(state.label("مساحتك للبرمجة والذكاء الاصطناعي", "Your AI coding workspace"), style = MaterialTheme.typography.titleMedium)
        Text("ANDROID · ${BuildConfig.VERSION_NAME}", color = MaterialTheme.colorScheme.secondary)
        OutlinedTextField(email, { email = it }, label = { Text(state.label("البريد الإلكتروني", "Email")) }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth())
        OutlinedTextField(password, { password = it }, label = { Text(state.label("كلمة المرور", "Password")) }, visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(), trailingIcon = { TextButton(onClick = { visible = !visible }) { Text(state.label(if (visible) "إخفاء" else "إظهار", if (visible) "Hide" else "Show")) } }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth())
        Button(onClick = { vm.login(email, password) }, enabled = !state.busy && email.isNotBlank() && password.isNotBlank(), modifier = Modifier.fillMaxWidth().height(52.dp)) { Text(state.label("تسجيل الدخول", "Sign in")) }
        TextButton(onClick = { vm.signup(email, password) }, enabled = !state.busy && email.contains('@') && password.length >= 8) { Text(state.label("إنشاء حساب بهذا البريد", "Create account with this email")) }
        Text(state.label("حساب المالك مؤكَّد بالفعل. سجّل الدخول مرة واحدة، ثم عيّن رمز القفل الداخلي من المزيد. الحسابات الجديدة قد تتطلب تأكيد البريد.", "The owner account is already confirmed. Sign in once, then set an app PIN in More. New accounts may require email confirmation."), style = MaterialTheme.typography.bodySmall)
        Status(state)
    }
}
@Composable private fun Status(state: UiState) {
    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    state.error?.let { code -> Text(when (code) {
        "LOGIN_FAILED" -> state.label("البريد أو كلمة المرور غير صحيحة. إنشاء الحساب مجددًا لا يغيّر كلمة مروره. استخدم كلمة المرور الجديدة التي أُعطيت لك.", "Incorrect email or password. Creating the account again does not change its password.")
        "PIN_FAILED" -> state.label("الرمز غير صحيح. بعد 5 محاولات انتظر 30 ثانية.", "Incorrect PIN. After 5 attempts, wait 30 seconds.")
        "SESSION_EXPIRED", "HTTP_401" -> state.label("انتهت الجلسة؛ سجّل الدخول مجددًا.", "Session expired. Sign in again.")
        "HTTP_429" -> state.label("طلبات كثيرة؛ انتظر قليلًا ثم أعد المحاولة.", "Too many requests. Wait, then retry.")
        "FILE_NOT_CACHED" -> state.label("هذا الملف لم يُحفظ محليًا بعد. افتحه عند توفر الاتصال أولًا.", "This file is not cached. Open it online first.")
        "PROJECT_NOT_CACHED" -> state.label("لا توجد ملفات محفوظة لهذا المشروع للبحث دون اتصال.", "No cached files are available for offline search.")
        else -> state.label("تعذّر الطلب: ", "Request failed: ") + code
    }, color = MaterialTheme.colorScheme.error) }
    state.notice?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
    if (state.offline) Text(state.label("غير متصل · بيانات محفوظة للقراءة", "Offline · cached read-only data"), color = MaterialTheme.colorScheme.secondary)
}
@Composable private fun AppLock(state: UiState, vm: WakeelViewModel) {
    var pin by remember { mutableStateOf("") }
    Column(Modifier.safeDrawingPadding().imePadding().padding(28.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("وكيل", style = MaterialTheme.typography.headlineLarge)
        Text(state.label("فتح التطبيق بالرمز الداخلي", "Unlock with your app PIN"))
        OutlinedTextField(pin, { pin = com.wakeel.app.core.PinVerifier.normalize(it) }, label = { Text(state.label("الرمز الداخلي", "App PIN")) }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword), singleLine = true)
        Button(onClick = { vm.unlock(pin); pin = "" }, enabled = !state.busy && pin.length >= 6) { Text(state.label("فتح", "Unlock")) }
        TextButton(onClick = { vm.resetLockedSession() }, enabled = !state.busy) { Text(state.label("نسيت الرمز؟ امسح الجلسة وسجّل الدخول", "Forgot PIN? Clear session and sign in")) }
        Status(state)
    }
}
@Composable private fun SecuritySettings(state: UiState, vm: WakeelViewModel) {
    var action by remember { mutableStateOf<String?>(null) }
    var value by remember { mutableStateOf("") }
    var confirmation by remember { mutableStateOf("") }
    OutlinedButton(onClick = { action = "pin" }) { Text(state.label(if (state.pinEnabled) "تغيير الرمز الداخلي" else "تعيين رمز داخلي", "Set / change app PIN")) }
    OutlinedButton(onClick = { action = "password" }) { Text(state.label("تعيين كلمة مرور جديدة للحساب", "Set a new account password")) }
    action?.let { current ->
        val pin = current == "pin"
        val valid = value == confirmation && if (pin) com.wakeel.app.core.PinVerifier.valid(value) else value.length >= 8
        AlertDialog(onDismissRequest = { action = null; value = ""; confirmation = "" }, title = { Text(state.label(if (pin) "رمز داخلي من 6 إلى 12 رقمًا" else "كلمة مرور الحساب", if (pin) "App PIN: 6–12 digits" else "Account password")) }, text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(state.label(if (pin) "يقفل هذا الهاتف عند مغادرة التطبيق. يظل الخادم محميًا بجلسة مشفّرة." else "اختر كلمة مرور جديدة من 8 أحرف على الأقل. لا تُحفظ في التطبيق.", if (pin) "Locks this device when you leave the app. The server session stays encrypted." else "Choose at least 8 characters. The password is not saved in the app."))
                OutlinedTextField(value, { value = if (pin) com.wakeel.app.core.PinVerifier.normalize(it) else it }, label = { Text(state.label("الرمز الجديد", "New secret")) }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = if (pin) KeyboardType.NumberPassword else KeyboardType.Password), singleLine = true)
                OutlinedTextField(confirmation, { confirmation = if (pin) com.wakeel.app.core.PinVerifier.normalize(it) else it }, label = { Text(state.label("تأكيد", "Confirm")) }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = if (pin) KeyboardType.NumberPassword else KeyboardType.Password), singleLine = true)
            }
        }, confirmButton = { TextButton(onClick = { if (pin) vm.setPin(value) else vm.changePassword(value); action = null; value = ""; confirmation = "" }, enabled = valid && !state.busy) { Text(state.label("حفظ", "Save")) } }, dismissButton = { TextButton(onClick = { action = null; value = ""; confirmation = "" }) { Text(state.label("إلغاء", "Cancel")) } })
    }
}
@Composable private fun Shell(state: UiState, vm: WakeelViewModel) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route ?: "home"
    val tabs = listOf(Triple("home", "الرئيسية", "Home"), Triple("conversations", "المحادثات", "Chats"), Triple("projects", "المشاريع", "Projects"), Triple("jobs", "المهام", "Tasks"), Triple("more", "المزيد", "More"))
    Scaffold(topBar = {
        Row(Modifier.statusBarsPadding().fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("وكيل", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            if (route !in tabs.map { it.first }) TextButton(onClick = { vm.stop(); nav.popBackStack() }) { Text(state.label("رجوع", "Back")) }
            else Text("BETA 3", color = MaterialTheme.colorScheme.secondary, fontSize = 12.sp)
        }
    }, bottomBar = {
        if (route != "chat") NavigationBar {
            tabs.forEachIndexed { index, tab -> NavigationBarItem(selected = route == tab.first, onClick = { nav.navigate(tab.first) { popUpTo("home") { saveState = true }; launchSingleTop = true; restoreState = true } }, icon = { Text(listOf("⌂", "◌", "▤", "✓", "•••")[index], fontSize = 22.sp) }, label = { Text(state.label(tab.second, tab.third), fontSize = 10.sp, maxLines = 1) }) }
        }
    }) { padding ->
        NavHost(nav, startDestination = "home", modifier = Modifier.padding(padding).fillMaxSize()) {
            composable("home") {
                Column(Modifier.padding(20.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                    Text(state.label("مرحبًا بك في وكيل", "Welcome to Wakeel"), style = MaterialTheme.typography.headlineMedium)
                    Card { Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(state.label("ابدأ بفكرة، وحوّلها إلى شيفرة", "Start with an idea"), style = MaterialTheme.typography.titleLarge)
                        Text(state.label("أضف مزودًا حقيقيًا، اكتشف نماذجه، ثم ابدأ المحادثة.", "Add a real provider, discover models, then start a conversation."))
                        Button(onClick = { vm.openChat(null); nav.navigate("chat") }) { Text(state.label("محادثة جديدة", "New conversation")) }
                    } }
                    OutlinedButton(onClick = { nav.navigate("providers") }, modifier = Modifier.fillMaxWidth()) { Text(state.label("المزودون والنماذج", "Providers and models")) }
                    Text(state.label("بيتا أولية: المهام للمتابعة حاليًا. رفع ZIP وتنفيذ المهام وتكاملات GitHub وMCP الكاملة لم تُنقل بعد.", "Early beta: task monitoring only. ZIP upload, task execution and full GitHub/MCP flows are not migrated yet."), style = MaterialTheme.typography.bodySmall)
                    Status(state)
                }
            }
            composable("chat") { Chat(state, vm) }
            composable("project") { Project(state, vm) }
            composable("providers") { Providers(state, vm) }
            composable("more") {
                LazyColumn(Modifier.padding(horizontal = 20.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(listOf(Triple("providers", "المزودون", "Providers"), Triple("models", "النماذج", "Models"), Triple("github", "GitHub · الحسابات", "GitHub accounts"), Triple("mcp", "تكاملات MCP", "MCP integrations"), Triple("memory", "الذاكرة", "Memory"), Triple("notifications", "الإشعارات", "Notifications"), Triple("history", "السجل", "History"), Triple("approvals", "الموافقات", "Approvals"))) { row ->
                        OutlinedButton(onClick = { nav.navigate(row.first) }, modifier = Modifier.fillMaxWidth()) { Text(state.label(row.second, row.third)) }
                    }
                    item { Row { TextButton(onClick = { vm.theme() }) { Text(state.label("ليلي / نهاري", "Dark / light")) }; TextButton(onClick = { vm.language() }) { Text("العربية / English") } } }
                    item { SecuritySettings(state, vm) }
                    item { OutlinedButton(onClick = { vm.logout() }) { Text(state.label("تسجيل الخروج", "Sign out")) } }
                    item { Status(state) }
                }
            }
            listOf("conversations", "projects", "jobs", "models", "github", "mcp", "memory", "notifications", "history", "approvals").forEach { collection -> composable(collection) {
                Collection(state, vm, collection) { row -> when (collection) {
                    "conversations" -> { vm.openChat(row.text("id").takeIf { it.isNotBlank() }); nav.navigate("chat") }
                    "projects" -> { vm.openProject(row.text("id")); nav.navigate("project") }
                    "models" -> { vm.selectModel(row.text("id")); vm.openChat(null); nav.navigate("chat") }
                } }
            } }
        }
    }
}
@Composable private fun Collection(state: UiState, vm: WakeelViewModel, collection: String, open: (JsonObject) -> Unit) {
    LaunchedEffect(collection) { vm.load(collection) }
    var name by remember { mutableStateOf("") }
    var showNew by remember { mutableStateOf(false) }
    var approval by remember { mutableStateOf<JsonObject?>(null) }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = { vm.load(collection) }, enabled = !state.busy) { Text(state.label("تحديث", "Refresh")) }
            if (collection == "conversations") Button(onClick = { vm.openChat(null); open(payload("id" to "")) }) { Text(state.label("جديد", "New")) }
            if (collection == "projects") Button(onClick = { showNew = true }) { Text(state.label("مشروع جديد", "New project")) }
        }
        Status(state)
        val rows = state.rows[collection].orEmpty()
        if (rows.isEmpty() && !state.busy) Text(state.label("لا توجد بيانات بعد", "No data yet"), modifier = Modifier.padding(24.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(vertical = 16.dp)) {
            items(rows) { row -> Card(onClick = { open(row) }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(listOf("title", "name", "display_name", "summary", "action", "github_login", "request_text").firstNotNullOfOrNull { row.text(it).takeIf(String::isNotEmpty) } ?: row.text("id"), fontWeight = FontWeight.SemiBold)
                    Text(listOf("status", "provider_type", "external_model_id", "created_at").map { row.text(it) }.filter(String::isNotEmpty).joinToString(" · "), style = MaterialTheme.typography.bodySmall)
                    if (collection == "jobs") Text(state.label("متابعة الحالة فقط في هذه البيتا", "Monitoring only in this beta"), style = MaterialTheme.typography.bodySmall)
                    if (collection == "approvals") { SelectionContainer { Text(row.toString(), style = MaterialTheme.typography.bodySmall) }; if (row.text("status") == "PENDING") TextButton(onClick = { approval = row }) { Text(state.label("مراجعة القرار", "Review decision")) } }
                    if (collection == "models") TextButton(onClick = { vm.operation("testModel", payload("modelId" to row.text("id"))) }) { Text(state.label("اختبار النموذج", "Test model")) }
                }
            } }
        }
    }
    if (showNew) AlertDialog(onDismissRequest = { showNew = false }, title = { Text(state.label("مشروع فارغ", "Empty project")) }, text = { OutlinedTextField(name, { name = it }, label = { Text(state.label("الاسم", "Name")) }) }, confirmButton = { TextButton(onClick = { vm.operation("createProject", payload("name" to name, "sourceType" to "EMPTY"), "projects"); showNew = false }, enabled = name.isNotBlank()) { Text(state.label("إنشاء", "Create")) } }, dismissButton = { TextButton(onClick = { showNew = false }) { Text(state.label("إلغاء", "Cancel")) } })
    approval?.let { row -> AlertDialog(onDismissRequest = { approval = null }, title = { Text(state.label("موافقة صريحة", "Explicit approval")) }, text = { Text(row.toString()) }, confirmButton = { TextButton(onClick = { vm.operation("decideApproval", payload("approvalId" to row.text("id"), "decision" to "APPROVE"), "approvals"); approval = null }) { Text(state.label("أوافق على الإجراء المعروض", "Approve displayed action")) } }, dismissButton = { TextButton(onClick = { vm.operation("decideApproval", payload("approvalId" to row.text("id"), "decision" to "REJECT"), "approvals"); approval = null }) { Text(state.label("رفض", "Reject")) } }) }
}
@Composable private fun Chat(state: UiState, vm: WakeelViewModel) {
    var input by rememberSaveable { mutableStateOf("") }
    var chooseModel by remember { mutableStateOf(false) }
    val scroll = rememberLazyListState()
    LaunchedEffect(state.messages.size, state.draftReply.length) { val count = state.messages.size + if (state.draftReply.isNotEmpty()) 1 else 0; if (count > 0) scroll.animateScrollToItem(count - 1) }
    Column(Modifier.fillMaxSize().imePadding()) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            TextButton(onClick = { vm.load("models"); chooseModel = true }, enabled = state.conversation == null && !state.streaming) { Text(state.label("النموذج: ", "Model: ") + (state.selectedModel?.let { id -> state.rows["models"]?.find { it.text("id") == id }?.text("display_name") } ?: state.label("تلقائي", "Auto"))) }
            TextButton(onClick = { vm.send(null, retry = true) }, enabled = !state.streaming && state.conversation != null) { Text(state.label("إعادة التوليد", "Regenerate")) }
        }
        if (state.model.isNotEmpty()) Text(state.model, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 20.dp))
        Status(state)
        LazyColumn(Modifier.weight(1f).padding(horizontal = 14.dp), state = scroll, verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(vertical = 12.dp)) {
            items(state.messages) { row -> Message(row.text("content"), row.text("role") == "user", state) }
            if (state.draftReply.isNotEmpty()) item { Message(state.draftReply, false, state) }
            if (state.messages.isEmpty() && !state.streaming) item { Text(state.label("كيف أساعدك في مشروعك اليوم؟", "How can I help with your project?"), modifier = Modifier.padding(24.dp)) }
        }
        Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(input, { input = it }, placeholder = { Text(state.label("اكتب رسالتك…", "Message…")) }, modifier = Modifier.weight(1f), maxLines = 5, shape = RoundedCornerShape(20.dp))
            if (state.streaming) Button(onClick = { vm.stop() }) { Text(state.label("إيقاف", "Stop")) }
            else Button(onClick = { vm.send(input); input = "" }, enabled = input.isNotBlank()) { Text(state.label("إرسال", "Send")) }
        }
    }
    if (chooseModel) AlertDialog(onDismissRequest = { chooseModel = false }, title = { Text(state.label("نموذج المحادثة الجديدة", "New conversation model")) }, text = { LazyColumn {
        item { TextButton(onClick = { vm.selectModel(null); chooseModel = false }) { Text(state.label("توجيه تلقائي", "Automatic routing")) } }
        items(state.rows["models"].orEmpty()) { model -> TextButton(onClick = { vm.selectModel(model.text("id")); chooseModel = false }) { Text(model.text("display_name")) } }
    } }, confirmButton = { TextButton(onClick = { chooseModel = false }) { Text(state.label("إغلاق", "Close")) } })
}
@Composable private fun Message(content: String, user: Boolean, state: UiState) {
    val clipboard = LocalClipboardManager.current
    val foreground = MaterialTheme.colorScheme.onSurface
    Card(colors = CardDefaults.cardColors(containerColor = if (user) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(if (user) state.label("أنت", "You") else "وكيل", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            AndroidView(factory = { context -> TextView(context).apply { setTextIsSelectable(true); textSize = 16f; tag = Markwon.create(context) } }, update = { view -> view.setTextColor(android.graphics.Color.argb((foreground.alpha * 255).toInt(), (foreground.red * 255).toInt(), (foreground.green * 255).toInt(), (foreground.blue * 255).toInt())); (view.tag as Markwon).setMarkdown(view, content) }, modifier = Modifier.fillMaxWidth())
            TextButton(onClick = { clipboard.setText(AnnotatedString(content)) }) { Text(state.label("نسخ", "Copy")) }
        }
    }
}
@Composable private fun Providers(state: UiState, vm: WakeelViewModel) {
    LaunchedEffect(Unit) { vm.load("providers") }
    var show by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<JsonObject?>(null) }
    var deleting by remember { mutableStateOf<JsonObject?>(null) }
    Column(Modifier.padding(16.dp).fillMaxSize()) {
        Row { Button(onClick = { editing = null; show = true }) { Text(state.label("إضافة مزود", "Add provider")) }; TextButton(onClick = { vm.load("providers") }) { Text(state.label("تحديث", "Refresh")) } }
        Status(state)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(vertical = 16.dp)) {
            items(state.rows["providers"].orEmpty()) { row -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) {
                Text(row.text("name"), style = MaterialTheme.typography.titleMedium)
                Text(row.text("status") + " · " + row.text("base_url"), style = MaterialTheme.typography.bodySmall)
                Row { TextButton(onClick = { vm.operation("testProvider", payload("id" to row.text("id")), "providers") }) { Text(state.label("اختبار واكتشاف", "Test / discover")) }; TextButton(onClick = { editing = row; show = true }) { Text(state.label("تعديل", "Edit")) }; TextButton(onClick = { deleting = row }) { Text(state.label("حذف", "Delete")) } }
            } } }
            if (state.rows["providers"].isNullOrEmpty()) item { Text(state.label("أضف رمز مزودك للحصول على إجابات فعلية. يحفظه الخادم مشفرًا.", "Add your provider token for real responses. The server encrypts it.")) }
        }
    }
    if (show) ProviderForm(state, editing, onDismiss = { show = false }, onSave = { body -> vm.operation(if (editing == null) "createProvider" else "updateProvider", body, "providers"); show = false })
    deleting?.let { row -> AlertDialog(onDismissRequest = { deleting = null }, title = { Text(state.label("حذف المزود؟", "Delete provider?")) }, text = { Text(row.text("name")) }, confirmButton = { TextButton(onClick = { vm.operation("deleteProvider", payload("id" to row.text("id")), "providers"); deleting = null }) { Text(state.label("حذف", "Delete")) } }, dismissButton = { TextButton(onClick = { deleting = null }) { Text(state.label("إلغاء", "Cancel")) } }) }
}
@Composable private fun ProviderForm(state: UiState, row: JsonObject?, onDismiss: () -> Unit, onSave: (JsonObject) -> Unit) {
    var name by remember { mutableStateOf(row?.text("name").orEmpty()) }
    var url by remember { mutableStateOf(row?.text("base_url") ?: "https://openrouter.ai/api/v1") }
    var token by remember { mutableStateOf("") }
    var type by remember { mutableStateOf(row?.text("provider_type") ?: "OPENROUTER") }
    AlertDialog(onDismissRequest = onDismiss, title = { Text(state.label("إعداد المزود", "Provider settings")) }, text = { Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(name, { name = it }, label = { Text(state.label("الاسم", "Name")) })
        listOf("OPENROUTER", "OPENAI_COMPATIBLE", "NVIDIA_NIM", "CUSTOM_OPENAI_COMPATIBLE").forEach { option -> FilterChip(selected = type == option, onClick = { type = option }, label = { Text(option, fontSize = 11.sp) }) }
        OutlinedTextField(url, { url = it }, label = { Text("HTTPS API URL") }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri))
        OutlinedTextField(token, { token = it }, label = { Text(if (row == null) "API Token" else "New token (optional)") }, visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
    } }, confirmButton = { TextButton(onClick = { val body = buildJsonObject { row?.let { put("id", it.text("id")) }; put("name", name); put("baseUrl", url); put("providerType", type); if (token.isNotBlank()) put("token", token) }; token = ""; onSave(body) }, enabled = name.isNotBlank() && url.startsWith("https://") && (row != null || token.length >= 8)) { Text(state.label("حفظ واختبار", "Save and test")) } }, dismissButton = { TextButton(onClick = onDismiss) { Text(state.label("إلغاء", "Cancel")) } })
}
@Composable private fun Project(state: UiState, vm: WakeelViewModel) {
    var query by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(state.label("مساحة المشروع", "Project workspace"), style = MaterialTheme.typography.titleLarge)
        Text(state.label("الملفات التي تفتحها تُحفظ على الهاتف للقراءة والبحث دون اتصال. البحث المحلي يشمل الملفات المحفوظة فقط.", "Opened files are saved on this phone for offline reading and search. Local search covers cached files only."), style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(query, { query = it }, label = { Text(state.label("بحث أو سؤال عن المشروع", "Search or ask project")) }, modifier = Modifier.fillMaxWidth())
        Row { Button(onClick = { vm.operation("searchProject", buildJsonObject { put("projectId", state.project); put("query", query); put("kinds", buildJsonArray { add("file"); add("text"); add("symbol") }) }) }, enabled = query.isNotBlank()) { Text(state.label("بحث", "Search")) }; TextButton(onClick = { vm.operation("askProject", payload("projectId" to state.project.orEmpty(), "question" to query)) }, enabled = query.length >= 2) { Text(state.label("اسأل المشروع", "Ask project")) } }
        Status(state)
        if (state.result.isNotEmpty()) SelectionContainer { Text(state.result, fontFamily = FontFamily.Monospace) }
        state.rows["files"].orEmpty().forEach { file -> TextButton(onClick = { vm.readFile(file.text("path")) }) { Text(file.text("path"), fontFamily = FontFamily.Monospace) } }
        if (state.file.isNotEmpty()) CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) { SelectionContainer { Text(state.file.lineSequence().mapIndexed { index, line -> "${index + 1}  $line" }.joinToString("\n"), fontFamily = FontFamily.Monospace, modifier = Modifier.horizontalScroll(rememberScrollState())) } }
    }
}
