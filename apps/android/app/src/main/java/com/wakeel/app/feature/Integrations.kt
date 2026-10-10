package com.wakeel.app.feature

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.wakeel.app.data.*
import kotlinx.serialization.json.*

private fun UiState.integrationLabel(ar: String, en: String) = if (english) en else ar
@Composable fun GithubWorkspace(state: UiState, vm: WakeelViewModel, onProjects: () -> Unit) {
    LaunchedEffect(Unit) { vm.load("github"); vm.load("repositories") }
    var token by remember { mutableStateOf("") }
    var disconnect by remember { mutableStateOf<JsonObject?>(null) }
    var import by remember { mutableStateOf<JsonObject?>(null) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("GitHub", style = MaterialTheme.typography.headlineMedium)
            Text(state.integrationLabel("اربط حسابك برمز Fine-grained PAT يقتصر على المستودعات اللازمة. يُشفّر الخادم الرمز ولا يحفظه التطبيق. الكتابة تحتاج موافقة مهمة الوكيل؛ لا توجد كتابة مباشرة إلى main.", "Connect using a fine-grained PAT scoped to required repositories. The server encrypts it; the app does not persist it. Agent repository writes require approval; no direct main writes."))
            OutlinedTextField(token, { token = it }, label = { Text("Fine-grained PAT") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
            Button(onClick = { val value = token.trim(); token = ""; vm.operation("connectGithub", payload("token" to value), "github"); vm.load("repositories") }, enabled = token.trim().length in 20..400 && !state.busy) { Text(state.integrationLabel("ربط واكتشاف المستودعات", "Connect and discover repositories")) }
            Row { TextButton(onClick = { vm.load("github"); vm.load("repositories") }) { Text(state.integrationLabel("تحديث", "Refresh")) }; TextButton(onClick = onProjects) { Text(state.integrationLabel("فتح المشاريع", "Open projects")) } }
            IntegrationStatus(state)
        }
        items(state.rows["github"].orEmpty(), key = { it.text("id") }) { connection -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) {
            Text(connection.text("github_login") + " · " + connection.text("status"))
            Row { TextButton(onClick = { vm.operation("refreshGithub", payload("connectionId" to connection.text("id")), "github"); vm.load("repositories") }, enabled = !state.busy) { Text(state.integrationLabel("مزامنة المستودعات", "Sync repositories")) }; TextButton(onClick = { disconnect = connection }, enabled = !state.busy) { Text(state.integrationLabel("فصل", "Disconnect")) } }
        } } }
        items(state.rows["repositories"].orEmpty(), key = { it.text("id") }) { repo -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(repo.text("full_name"), style = MaterialTheme.typography.titleMedium); Text(repo.text("description")); Text(repo.text("default_branch"))
            Row { TextButton(onClick = { vm.operation("listRepoItems", payload("repositoryId" to repo.text("id"), "kind" to "issues")) }, enabled = !state.busy) { Text(state.integrationLabel("المشكلات", "Issues")) }; TextButton(onClick = { vm.operation("listRepoItems", payload("repositoryId" to repo.text("id"), "kind" to "pulls")) }, enabled = !state.busy) { Text(state.integrationLabel("طلبات الدمج", "Pull requests")) }; TextButton(onClick = { import = repo }, enabled = !state.busy) { Text(state.integrationLabel("استيراد", "Import")) } }
        } } }
    }
    disconnect?.let { connection -> AlertDialog(onDismissRequest = { disconnect = null }, title = { Text(state.integrationLabel("فصل GitHub؟", "Disconnect GitHub?")) }, text = { Text(connection.text("github_login")) }, confirmButton = { TextButton(onClick = { vm.operation("disconnectGithub", payload("connectionId" to connection.text("id")), "github"); vm.load("repositories"); disconnect = null }) { Text(state.integrationLabel("أوافق وأفصل", "Confirm disconnect")) } }, dismissButton = { TextButton(onClick = { disconnect = null }) { Text(state.integrationLabel("إلغاء", "Cancel")) } }) }
    import?.let { repo -> AlertDialog(onDismissRequest = { import = null }, title = { Text(state.integrationLabel("استيراد مشروع من GitHub", "Import GitHub project")) }, text = { Text(repo.text("full_name") + "\n" + state.integrationLabel("ستُنقل نسخة من ملفات المستودع إلى تخزين مشروعك الخاص. لن تُنفَّذ الشيفرة ولن يتغير المستودع.", "A repository snapshot is copied to your private project. Code is not executed and the repository is unchanged.")) }, confirmButton = { TextButton(onClick = { vm.operation("importRepository", payload("repositoryId" to repo.text("id")), "projects"); import = null }) { Text(state.integrationLabel("أوافق وأستورد", "Confirm import")) } }, dismissButton = { TextButton(onClick = { import = null }) { Text(state.integrationLabel("إلغاء", "Cancel")) } }) }
}
@Composable private fun IntegrationStatus(state: UiState) {
    if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; state.notice?.let { Text(it) }
    if (state.result.isNotEmpty()) SelectionContainer { Text(state.result.take(20000), style = MaterialTheme.typography.bodySmall) }
}
@Composable fun McpWorkspace(state: UiState, vm: WakeelViewModel) {
    LaunchedEffect(Unit) { vm.load("mcp") }
    val context = LocalContext.current
    var name by rememberSaveable { mutableStateOf("") }; var url by rememberSaveable { mutableStateOf("") }; var bearer by remember { mutableStateOf("") }
    var selected by rememberSaveable { mutableStateOf<String?>(null) }
    var permission by remember { mutableStateOf<JsonObject?>(null) }; var call by remember { mutableStateOf<JsonObject?>(null) }
    var args by remember { mutableStateOf("{}") }; var argumentError by remember { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text(state.integrationLabel("تكاملات MCP", "MCP integrations"), style = MaterialTheme.typography.headlineMedium)
            Text(state.integrationLabel("Streamable HTTP عبر HTTPS. الخادم يتحقق من الوجهة والصلاحيات ويشفّر الرموز. فشل اكتشاف الأدوات يظهر كحالة ERROR أو AUTH_REQUIRED، ولا يُعد اتصالًا ناجحًا.", "Streamable HTTP over HTTPS. The server validates destinations/permissions and encrypts tokens. Discovery failure remains ERROR/AUTH_REQUIRED, not a successful connection."))
            OutlinedTextField(name, { name = it.take(80) }, label = { Text(state.integrationLabel("اسم الاتصال", "Connection name")) }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(url, { url = it.take(500) }, label = { Text("HTTPS MCP URL") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
            OutlinedTextField(bearer, { bearer = it }, label = { Text(state.integrationLabel("Bearer اختياري", "Optional bearer")) }, modifier = Modifier.fillMaxWidth(), visualTransformation = PasswordVisualTransformation(), singleLine = true)
            Button(onClick = { val secret = bearer.trim(); bearer = ""; vm.operation("addMcpServer", buildJsonObject { put("name", name.trim()); put("url", url.trim()); if (secret.isNotEmpty()) put("bearer", secret) }, "mcp") }, enabled = !state.busy && name.isNotBlank() && url.startsWith("https://") && (bearer.isBlank() || bearer.length in 8..4000)) { Text(state.integrationLabel("ربط واكتشاف", "Connect and discover")) }
            IntegrationStatus(state)
            state.oauthUrl?.let { authorize -> Button(onClick = { val uri = Uri.parse(authorize); if (uri.scheme == "https" && !uri.host.isNullOrBlank()) try { context.startActivity(Intent(Intent.ACTION_VIEW, uri)); vm.clearOAuth() } catch (_: android.content.ActivityNotFoundException) { vm.browserUnavailable() } }) { Text(state.integrationLabel("فتح المصادقة في متصفح النظام", "Open authentication in system browser")) }; Text(state.integrationLabel("بعد إنهاء المصادقة ارجع واضغط تحديث الاتصال.", "After authentication, return and refresh the connection.")) }
        }
        items(state.rows["mcp"].orEmpty(), key = { it.text("id") }) { server -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) {
            Text(server.text("name") + " · " + server.text("status")); Text(server.text("url"))
            Row { TextButton(onClick = { vm.operation("refreshMcpServer", payload("serverId" to server.text("id")), "mcp") }, enabled = !state.busy) { Text(state.integrationLabel("فحص", "Refresh")) }; TextButton(onClick = { selected = server.text("id"); vm.load("tools", "?serverId=$selected"); vm.load("resources", "?serverId=$selected") }) { Text(state.integrationLabel("الأدوات والموارد", "Tools and resources")) }; TextButton(onClick = { vm.mcpOAuth(server.text("id")) }, enabled = !state.busy) { Text("OAuth") } }
        } } }
        if (selected != null) {
            item { Text(state.integrationLabel("الأدوات المكتشفة", "Discovered tools"), style = MaterialTheme.typography.titleLarge) }
            items(state.rows["tools"].orEmpty().filter { it.text("server_id") == selected }, key = { it.text("id") }) { tool -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) {
                Text(tool.text("name") + " · " + tool.text("risk_level")); Text(tool.text("description").take(1000)); Text(state.integrationLabel("مفعّلة: ", "Enabled: ") + tool.text("enabled"))
                Row { TextButton(onClick = { permission = tool }, enabled = !state.busy) { Text(state.integrationLabel("الصلاحية", "Permission")) }; TextButton(onClick = { call = tool; args = "{}"; argumentError = false }, enabled = !state.busy && tool.text("enabled") == "true") { Text(state.integrationLabel("استدعاء يدوي", "Manual call")) } }
            } } }
            item { Text(state.integrationLabel("الموارد المكتشفة", "Discovered resources"), style = MaterialTheme.typography.titleLarge) }
            items(state.rows["resources"].orEmpty().filter { it.text("server_id") == selected }, key = { it.text("id") }) { resource -> Text(resource.text("name") + "\n" + resource.text("uri")) }
        }
    }
    permission?.let { tool -> val enabled = tool.text("enabled") != "true"; AlertDialog(onDismissRequest = { permission = null }, title = { Text(state.integrationLabel("تغيير صلاحية الأداة", "Change tool permission")) }, text = { Text(tool.text("name") + " · " + tool.text("risk_level") + "\n" + state.integrationLabel("ستبقى الموافقة مطلوبة لكل استدعاء. تفعيل الأدوات الحرجة يتطلب موافقتك هنا وسياسة الخادم.", "Each call retains approval. Enabling critical tools requires this explicit confirmation and server policy.")) }, confirmButton = { TextButton(onClick = { vm.operation("setMcpToolState", buildJsonObject { put("toolId", tool.text("id")); put("enabled", enabled); put("approvalRequired", true); put("confirmCritical", true) }); selected?.let { vm.load("tools", "?serverId=$it") }; permission = null }) { Text(state.integrationLabel(if (enabled) "أوافق على التفعيل" else "أوافق على التعطيل", if (enabled) "Confirm enable" else "Confirm disable")) } }, dismissButton = { TextButton(onClick = { permission = null }) { Text(state.integrationLabel("إلغاء", "Cancel")) } }) }
    call?.let { tool -> AlertDialog(onDismissRequest = { call = null }, title = { Text(tool.text("name") + " · " + tool.text("risk_level")) }, text = { Column {
        Text(state.integrationLabel("راجع معاملات JSON. سيُنفَّذ الاستدعاء الحقيقي على خادم MCP؛ قد يقرأ أو يغيّر بيانات وفق صلاحية الأداة.", "Review JSON arguments. A real MCP call may read or change data according to the tool permission.")); OutlinedTextField(args, { args = it.take(12000); argumentError = false }, label = { Text("JSON arguments") }, minLines = 3)
        if (argumentError) Text(state.integrationLabel("المعاملات يجب أن تكون كائن JSON صالحًا", "Arguments must be a valid JSON object"), color = MaterialTheme.colorScheme.error)
    } }, confirmButton = { TextButton(onClick = { val parsed = runCatching { Json.parseToJsonElement(args).jsonObject }.getOrNull(); if (parsed == null) argumentError = true else { vm.operation("callMcpTool", buildJsonObject { put("toolId", tool.text("id")); put("args", parsed); put("confirmed", true) }); call = null } }) { Text(state.integrationLabel("أوافق وأنفّذ الاستدعاء", "Confirm and execute call")) } }, dismissButton = { TextButton(onClick = { call = null }) { Text(state.integrationLabel("إلغاء", "Cancel")) } }) }
}
