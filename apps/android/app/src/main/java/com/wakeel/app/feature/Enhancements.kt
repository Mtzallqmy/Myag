package com.wakeel.app.feature

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.wakeel.app.core.ModelCatalog
import com.wakeel.app.core.LocalSearch
import com.wakeel.app.data.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

private fun UiState.words(ar: String, en: String) = if (english) en else ar
@Composable fun ModelPrice(model: JsonObject, state: UiState) {
    val tier = when (ModelCatalog.tier(model)) {
        "FREE_VERIFIED" -> state.words("مجاني · سعر موثّق من المزود", "Free · provider pricing verified")
        "FREE_REPORTED" -> state.words("مجاني مُعلن · يحتاج تحققًا", "Free reported · verify availability")
        "PAID" -> state.words("مدفوع", "Paid")
        else -> state.words("السعر غير معروف", "Unknown price")
    }
    Text(tier, color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.labelMedium)
    val meta = model["metadata_json"] as? JsonObject
    val pricing = meta?.get("pricing") as? JsonObject
    if (pricing != null) Text("USD / token · ${pricing.text("prompt")} / ${pricing.text("completion")}", style = MaterialTheme.typography.labelSmall)
}
@Composable fun ModelBrowser(state: UiState, onTest: ((JsonObject) -> Unit)? = null, onSelect: (JsonObject) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var price by rememberSaveable { mutableStateOf("ALL") }
    var capability by rememberSaveable { mutableStateOf("ALL") }
    var sort by rememberSaveable { mutableStateOf("NAME") }
    Column(Modifier.fillMaxWidth()) {
        OutlinedTextField(query, { query = it }, label = { Text(state.words("بحث في النماذج", "Search models")) }, singleLine = true, modifier = Modifier.fillMaxWidth())
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("ALL" to state.words("الكل", "All"), "FREE" to state.words("مجاني", "Free"), "PAID" to state.words("مدفوع", "Paid"), "UNKNOWN" to state.words("غير معروف", "Unknown")).forEach { (id, name) -> FilterChip(selected = price == id, onClick = { price = id }, label = { Text(name) }) }
        }
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("ALL" to state.words("كل القدرات", "All capabilities"), "tool_calling" to state.words("أدوات", "Tools"), "reasoning" to state.words("تفكير", "Reasoning"), "vision" to state.words("صور", "Vision"), "structured_output" to "JSON").forEach { (id, name) -> FilterChip(selected = capability == id, onClick = { capability = id }, label = { Text(name) }) }
        }
        Row { TextButton(onClick = { sort = "NAME" }) { Text(state.words("الاسم", "Name")) }; TextButton(onClick = { sort = "PRICE" }) { Text(state.words("السعر", "Price")) }; TextButton(onClick = { sort = "CONTEXT" }) { Text(state.words("السياق", "Context")) } }
        val models = ModelCatalog.filter(state.rows["models"].orEmpty(), query, price, capability, sort)
        Text("${models.size} " + state.words("نموذج · القدرات قد تكون مستنتجة", "models · capabilities may be inferred"), style = MaterialTheme.typography.bodySmall)
        LazyColumn(Modifier.weight(1f, fill = false), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(models, key = { it.text("id") }) { model -> Card(onClick = { onSelect(model) }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(model.text("display_name")); Text(model.text("external_model_id"), style = MaterialTheme.typography.bodySmall)
                    onTest?.let { test -> TextButton(onClick = { test(model) }, enabled = !state.busy) { Text(state.words("اختبار النموذج", "Test model")) } }
                    ModelPrice(model, state); Text("${model.text("context_length")} · ${model.text("status")}", style = MaterialTheme.typography.labelSmall)
                }
            } }
        }
    }
}
@Composable fun LocalWorkspace(state: UiState, vm: WakeelViewModel, onChat: () -> Unit) {
    LaunchedEffect(Unit) { vm.loadLocal() }
    val import = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris -> vm.systemPicker(false); if (uris.isNotEmpty()) vm.importLocal(uris) }
    val export = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("text/plain")) { uri -> vm.systemPicker(false); if (uri != null) vm.exportLocal(uri) }
    var query by rememberSaveable { mutableStateOf("") }
    var attach by remember { mutableStateOf(false) }
    Column(Modifier.fillMaxSize().padding(16.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(state.words("مختبر الملفات المحلي", "Local file workspace"), style = MaterialTheme.typography.headlineSmall)
        Text(state.words("حتى 10 ملفات في المرة، 600KB للملف، UTF-8. الفحص تقريبي ولا يشغّل الشيفرة. لا تُرفع الملفات تلقائيًا.", "Up to 10 files at once, 600KB each, UTF-8. Heuristic inspection does not run code. Files are not uploaded automatically."), style = MaterialTheme.typography.bodySmall)
        Button(onClick = { vm.systemPicker(true); import.launch(arrayOf("*/*")) }, enabled = !state.busy) { Text(state.words("فتح ملفات من الهاتف", "Open phone files")) }
        if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; state.notice?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
        OutlinedTextField(query, { query = it }, label = { Text(state.words("بحث محلي في الملفات", "Search local files")) }, modifier = Modifier.fillMaxWidth())
        if (query.isNotBlank()) {
            val hits by produceState<List<com.wakeel.app.core.LocalHit>>(emptyList(), state.localFiles, query) { delay(200); value = withContext(Dispatchers.Default) { LocalSearch.find(state.localFiles.map { it.path to it.content }, query).take(30) } }
            hits.forEach { hit -> TextButton(onClick = { state.localFiles.find { it.path == hit.path }?.let(vm::selectLocal) }) { Text("${hit.path} : ${hit.line}\n${hit.preview}", maxLines = 3) } }
            if (hits.isEmpty()) Text(state.words("لا توجد نتائج", "No matches"))
        } else state.localFiles.forEach { file -> OutlinedButton(onClick = { vm.selectLocal(file) }, modifier = Modifier.fillMaxWidth()) { Text(file.path.substringAfter('/')) } }
        state.localFile?.let { file ->
            HorizontalDivider(); Text(file.path.substringAfter('/'), style = MaterialTheme.typography.titleLarge)
            state.inspection?.let { report ->
                Text("${report.language} · ${report.bytes} B · ${report.lines} " + state.words("سطر", "lines"))
                SelectionContainer { Text("SHA-256: ${report.sha256}", style = MaterialTheme.typography.labelSmall) }
                Text(report.frameworks.joinToString(" · "))
                report.jsonValid?.let { Text(if (it) state.words("JSON صالح", "Valid JSON") else state.words("JSON غير صالح", "Invalid JSON")) }
                report.findings.forEach { Text("${it.kind} · ${state.words("السطر", "line")} ${it.line}", color = if (it.kind == "SECRET") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary) }
                if (report.symbols.isNotEmpty()) Text(report.symbols.joinToString("\n"), fontFamily = FontFamily.Monospace)
            }
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                if (state.inspection?.language == "JSON") TextButton(onClick = { vm.processLocal("JSON") }) { Text(state.words("تنسيق JSON", "Format JSON")) }
                TextButton(onClick = { vm.processLocal("TRIM") }) { Text(state.words("تنظيف المسافات", "Trim whitespace")) }
                TextButton(onClick = { vm.processLocal("REDACT") }) { Text(state.words("نسخة منقحة للأسرار", "Redact secrets")) }
            }
            Row(Modifier.horizontalScroll(rememberScrollState())) {
                Button(onClick = { vm.systemPicker(true); export.launch("processed-" + file.path.substringAfter('/')) }, enabled = !state.busy) { Text(state.words("تصدير نسخة", "Export copy")) }
                TextButton(onClick = { attach = true }) { Text(state.words("إرفاق للمحادثة", "Attach to chat")) }
                TextButton(onClick = { vm.removeLocal(file) }) { Text(state.words("حذف محلي", "Delete local copy")) }
            }
            SelectionContainer { Text((state.localOutput ?: file.content).take(60_000), fontFamily = FontFamily.Monospace, modifier = Modifier.heightIn(max = 400.dp).verticalScroll(rememberScrollState()).horizontalScroll(rememberScrollState())) }
        }
    }
    if (attach) AlertDialog(onDismissRequest = { attach = false }, title = { Text(state.words("إرسال ملف إلى النموذج", "Send file to model")) }, text = { Text(state.words("سيُرفق أول 30 ألف حرف بعد تنقيح أنماط الأسرار عند إرسال رسالتك. راجع المحتوى بنفسك؛ الكشف ليس مضمونًا لكل الأسرار.", "The first 30,000 characters will be attached after pattern-based redaction when you send. Review the content; detection cannot guarantee every secret is removed.")) }, confirmButton = { TextButton(onClick = { vm.attachLocal(); attach = false; onChat() }) { Text(state.words("أرفق", "Attach")) } }, dismissButton = { TextButton(onClick = { attach = false }) { Text(state.words("إلغاء", "Cancel")) } })
}
@Composable fun TelegramScreen(state: UiState, vm: WakeelViewModel) {
    LaunchedEffect(Unit) { vm.load("telegram") }
    var token by remember { mutableStateOf("") }; var userId by rememberSaveable { mutableStateOf("") }
    var enable by remember { mutableStateOf<JsonObject?>(null) }; var remove by remember { mutableStateOf<JsonObject?>(null) }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text(state.words("بوتات تليجرام", "Telegram bots"), style = MaterialTheme.typography.headlineSmall) }
        item { Text(state.words("أضف توكن BotFather ومعرّف حسابك الرقمي في تليجرام. يُشفّر التوكن على الخادم؛ البوت يقبل محادثتك الخاصة فقط. يحتاج نشر API الجديد ومزودًا يعمل.", "Add a BotFather token and your numeric Telegram user ID. The server encrypts the token; only your private messages are allowed. Updated API deployment and a working provider are required."), style = MaterialTheme.typography.bodySmall) }
        item { OutlinedTextField(token, { token = it }, label = { Text("Bot token") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth()) }
        item { OutlinedTextField(userId, { userId = it.filter(Char::isDigit) }, label = { Text(state.words("معرّف مستخدم تليجرام الرقمي", "Numeric Telegram user ID")) }, singleLine = true, modifier = Modifier.fillMaxWidth()) }
        item { Row { Button(onClick = { val value = token.trim(); token = ""; vm.operation("connectTelegram", payload("token" to value, "allowedUserId" to userId), "telegram") }, enabled = token.contains(':') && userId.toLongOrNull()?.let { it > 0 } == true && !state.busy) { Text(state.words("ربط واختبار", "Connect and test")) }; TextButton(onClick = { vm.load("telegram") }) { Text(state.words("تحديث", "Refresh")) } } }
        item { if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth()); state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; if (state.result.isNotEmpty()) Text(state.result, style = MaterialTheme.typography.bodySmall) }
        items(state.rows["telegram"].orEmpty(), key = { it.text("id") }) { bot -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("@${bot.text("username")} · ${bot.text("status")}")
            Row(Modifier.horizontalScroll(rememberScrollState())) { TextButton(onClick = { vm.operation("testTelegram", payload("id" to bot.text("id"))) }) { Text(state.words("فحص", "Test")) }; TextButton(onClick = { enable = bot }) { Text(state.words("تفعيل استقبال الرسائل", "Enable webhook")) }; TextButton(onClick = { vm.operation("disableTelegram", payload("id" to bot.text("id")), "telegram") }) { Text(state.words("تعطيل", "Disable")) }; TextButton(onClick = { remove = bot }) { Text(state.words("فصل", "Disconnect")) } }
        } } }
    }
    enable?.let { bot -> AlertDialog(onDismissRequest = { enable = null }, title = { Text(state.words("تفعيل Webhook", "Enable webhook")) }, text = { Text(state.words("سيستبدل وكيل أي Webhook سابق لهذا البوت، ويستقبل رسائلك الخاصة ويستخدم نماذج حسابك. التوجيه يفضّل المجاني وقد ينتقل إلى مدفوع إذا لم يتوفر مجاني.", "Wakeel replaces any existing webhook, accepts your private messages, and uses your models. Routing prefers free models and may fall back to paid models.")) }, confirmButton = { TextButton(onClick = { vm.operation("enableTelegram", buildJsonObject { put("id", bot.text("id")); put("confirmReplaceWebhook", true) }, "telegram"); enable = null }) { Text(state.words("أوافق وأفعّل", "Confirm and enable")) } }, dismissButton = { TextButton(onClick = { enable = null }) { Text(state.words("إلغاء", "Cancel")) } }) }
    remove?.let { bot -> AlertDialog(onDismissRequest = { remove = null }, title = { Text(state.words("فصل البوت", "Disconnect bot")) }, text = { Text(state.words("سيُحذف الربط والتوكن المشفّر وسجل تسليم تليجرام. يبقى سجل المحادثة في وكيل.", "Delete the binding, encrypted token and Telegram delivery log. Wakeel conversation history remains.")) }, confirmButton = { TextButton(onClick = { vm.operation("disconnectTelegram", payload("id" to bot.text("id")), "telegram"); remove = null }) { Text(state.words("فصل", "Disconnect")) } }, dismissButton = { TextButton(onClick = { remove = null }) { Text(state.words("إلغاء", "Cancel")) } }) }
}
@Composable fun TaskControls(state: UiState, vm: WakeelViewModel) {
    LaunchedEffect(state.project) { vm.capabilities() }
    var request by rememberSaveable { mutableStateOf("") }; var mode by rememberSaveable { mutableStateOf("READ_ONLY") }; var depth by rememberSaveable { mutableStateOf("BALANCED") }
    Text(state.words("وكيل المشروع", "Project agent"), style = MaterialTheme.typography.titleLarge)
    Text(state.words("تحليل، اقتراح، مراجعة وأمان بأدوار محددة. تطبيق التغييرات يحتاج موافقتك؛ الاختبارات تحتاج Runtime معزولًا.", "Bounded analysis, implementation, review and security roles. Applying changes requires approval; tests require an isolated runtime."), style = MaterialTheme.typography.bodySmall)
    Row(Modifier.horizontalScroll(rememberScrollState())) { listOf("READ_ONLY", "SUGGEST", "WORKSPACE").forEach { value -> FilterChip(selected = mode == value, onClick = { mode = value }, label = { Text(value) }) } }
    Row(Modifier.horizontalScroll(rememberScrollState())) { listOf("FAST", "BALANCED", "DEEP", "MULTI").forEach { value -> FilterChip(selected = depth == value, onClick = { depth = value }, label = { Text(value) }) } }
    OutlinedTextField(request, { request = it.take(8000) }, label = { Text(state.words("المهمة المطلوبة", "Task request")) }, modifier = Modifier.fillMaxWidth(), minLines = 2)
    val available = state.capabilities["agent_worker"]?.jsonPrimitive?.booleanOrNull == true
    if (!available) Text(state.words("عامل المهام غير متاح على الخادم الحالي. لن نعرض مهمة وهمية ناجحة.", "The current server worker is unavailable."), color = MaterialTheme.colorScheme.secondary)
    Button(onClick = { vm.createTask(request, mode, depth) }, enabled = available && request.trim().length >= 3 && !state.busy) { Text(state.words("إرسال إلى طابور المهام", "Queue task")) }
}
@Composable fun TaskDetail(state: UiState, vm: WakeelViewModel, onApprovals: () -> Unit) {
    val job = state.job
    LaunchedEffect(job?.text("id"), job?.text("status")) { if (job?.text("status") !in listOf("COMPLETED", "FAILED", "CANCELLED", "INTERRUPTED", "AWAITING_APPROVAL")) while (true) { delay(10000); vm.refreshJob() } }
    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text(state.words("تفاصيل المهمة", "Task details"), style = MaterialTheme.typography.headlineSmall); Text(job?.text("request_text").orEmpty()); Text(job?.text("status").orEmpty()); LinearProgressIndicator(progress = { ((job?.get("progress") as? JsonPrimitive)?.floatOrNull ?: 0f).coerceIn(0f, 100f) / 100f }, modifier = Modifier.fillMaxWidth()) }
        item { Row { TextButton(onClick = { vm.refreshJob() }) { Text(state.words("تحديث", "Refresh")) }; TextButton(onClick = onApprovals) { Text(state.words("الموافقات", "Approvals")) }; TextButton(onClick = { job?.let { vm.operation("cancelAgentJob", payload("jobId" to it.text("id")), "jobs") } }) { Text(state.words("إلغاء المهمة", "Cancel task")) } } }
        item { state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; Text(job?.text("result_summary").orEmpty()); Text(job?.text("error_code").orEmpty(), color = MaterialTheme.colorScheme.error) }
        items(state.jobDetails["steps"].orEmpty()) { step -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) { Text("${step.text("step_number")} · ${step.text("step_type")} · ${step.text("status")}"); Text(step.text("summary")) } } }
        items(state.jobDetails["changes"].orEmpty()) { change -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) { Text(state.words("التغيير: ", "Change: ") + change.text("status")); Text(change.text("summary")); SelectionContainer { Text(change.text("diff_text").take(100000), fontFamily = FontFamily.Monospace, modifier = Modifier.heightIn(max = 360.dp).verticalScroll(rememberScrollState()).horizontalScroll(rememberScrollState())) } } } }
        item { Text(state.words("نتائج التحقق مستقلة عن تطبيق التغيير", "Validation is separate from applying changes"), style = MaterialTheme.typography.titleMedium) }
        items(state.jobDetails["validations"].orEmpty()) { validation -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) { Text("${validation.text("command_label")} · ${validation.text("status")}"); Text(validation.text("summary")); SelectionContainer { Text(validation.text("output_excerpt").take(10000), fontFamily = FontFamily.Monospace) } } } }
    }
}
@Composable fun ZipImport(state: UiState, vm: WakeelViewModel) {
    var uri by remember { mutableStateOf<Uri?>(null) }; var name by rememberSaveable { mutableStateOf("") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { value -> vm.systemPicker(false); uri = value }
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(state.words("استيراد مشروع ZIP", "Import ZIP project"), style = MaterialTheme.typography.headlineSmall)
        Text(state.words("ستُرفع نسخة خاصة إلى الخادم وتُفحص بأداة المشروع الحالية. حد 3MB للأرشيف، 200 عنصر و8MB بعد الفك. تُرفض المسارات غير الآمنة والروابط الرمزية وأنماط الأسرار. لا يُنفَّذ المشروع.", "Uploads a private server copy through the existing archive inspector. Limits: 3MB archive, 200 entries, 8MB unpacked. Unsafe paths, symlinks and detected secrets are rejected. Project code is not executed."))
        OutlinedTextField(name, { name = it.take(120) }, label = { Text(state.words("اسم المشروع", "Project name")) }, modifier = Modifier.fillMaxWidth())
        OutlinedButton(onClick = { vm.systemPicker(true); picker.launch(arrayOf("application/zip", "application/x-zip-compressed")) }) { Text(state.words("اختيار ZIP", "Choose ZIP")) }
        Text(if (uri != null) state.words("تم اختيار ملف", "File selected") else state.words("لم تختر ملفًا", "No file selected"))
        Button(onClick = { uri?.let { vm.importZip(name, it) } }, enabled = uri != null && name.isNotBlank() && !state.busy) { Text(state.words("أوافق على الرفع والاستيراد", "Confirm upload and import")) }
        if (state.busy) LinearProgressIndicator(Modifier.fillMaxWidth()); state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; state.notice?.let { Text(it) }; if (state.result.isNotEmpty()) Text(state.result)
    }
}
