package com.wakeel.app.feature

import android.net.Uri
import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import com.wakeel.app.data.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

private fun UiState.mediaLabel(ar: String, en: String) = if (english) en else ar
@Composable fun MediaWorkspace(state: UiState, vm: WakeelViewModel, onChat: () -> Unit) {
    LaunchedEffect(Unit) { vm.loadMedia(); vm.load("uploads") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris -> vm.systemPicker(false); if (uris.isNotEmpty()) vm.importMedia(uris) }
    var upload by remember { mutableStateOf<Boolean?>(null) }
    var removeCloud by remember { mutableStateOf<JsonObject?>(null) }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp), contentPadding = PaddingValues(vertical = 16.dp)) {
        item {
            Text(state.mediaLabel("الوسائط والملفات", "Media and files"), style = MaterialTheme.typography.headlineMedium)
            Text(state.mediaLabel("فحص محلي وبصمة SHA-256، أبعاد الصور، مدة الفيديو، وعدد صفحات PDF. لا يتم رفع شيء عند الاختيار. ملفات الهاتف الأصلية تبقى في مكانها.", "Local SHA-256, image dimensions, video duration and PDF page count. Picking does not upload. Original phone files remain in place."))
            Button(onClick = { vm.systemPicker(true); picker.launch(arrayOf("*/*")) }, enabled = !state.busy) { Text(state.mediaLabel("اختيار صور أو فيديو أو ملفات", "Pick images, video or files")) }
            if (state.busy) {
                if (state.uploadTotal > 0) { LinearProgressIndicator(progress = { (state.uploadProgress.toFloat() / state.uploadTotal).coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth()); Text("${state.uploadProgress / 1024} / ${state.uploadTotal / 1024} KB") }
                else LinearProgressIndicator(Modifier.fillMaxWidth())
                TextButton(onClick = { vm.cancelMedia() }) { Text(state.mediaLabel("إلغاء الفحص أو الرفع", "Cancel inspection or upload")) }
            }
            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            state.notice?.let { Text(it) }
        }
        items(state.mediaFiles, key = { it.uri }) { file -> OutlinedCard(onClick = { vm.selectMedia(file) }, modifier = Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) { Text(file.name, style = MaterialTheme.typography.titleMedium); Text("${file.mime} · ${file.size / 1024} KB", style = MaterialTheme.typography.labelMedium) } } }
        state.media?.let { file -> item(key = "selected-media") {
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(file.name, style = MaterialTheme.typography.titleLarge)
                val bitmap by produceState<android.graphics.Bitmap?>(null, file.preview) { value = withContext(Dispatchers.IO) { file.preview?.let { BitmapFactory.decodeFile(it) } } }
                DisposableEffect(bitmap) { onDispose { bitmap?.recycle() } }
                bitmap?.let { Image(it.asImageBitmap(), file.name, modifier = Modifier.fillMaxWidth().heightIn(max = 260.dp), contentScale = ContentScale.Fit) }
                SelectionContainer { Text(file.metadata, style = MaterialTheme.typography.bodySmall) }
                Text(state.mediaLabel("معاينة الفيديو: أول لقطة مفتاحية فقط (Android 8.1+)، دون صوت. PDF: معاينة الصفحة الأولى فقط. هذه ليست قراءة كاملة للمحتوى.", "Video preview: first keyframe only (Android 8.1+), without audio. PDF: first page preview only. This is not full content analysis."), style = MaterialTheme.typography.bodySmall)
                Button(onClick = { upload = true }, enabled = file.preview != null && !state.busy && state.imageIds.size < 4) { Text(state.mediaLabel("إرفاق المعاينة لتحليلها بالنموذج", "Attach preview for model analysis")) }
                OutlinedButton(onClick = { upload = false }, enabled = file.size in 1..52_428_800L && !state.busy) { Text(state.mediaLabel("رفع الملف الأصلي إلى التخزين الخاص", "Upload original to private storage")) }
                if (file.size > 52_428_800L) Text(state.mediaLabel("يمكن فحص هذا الملف محليًا. الرفع الحالي محدود بـ50MiB حسب إعداد التخزين، وليس حجم APK.", "Local inspection remains available. Storage upload is currently limited to 50MiB, independently of APK size."))
                TextButton(onClick = { vm.removeMedia(file) }, enabled = !state.busy) { Text(state.mediaLabel("إزالة المعاينة من التطبيق", "Remove app preview")) }
            } }
        } }
        item { HorizontalDivider(); Text(state.mediaLabel("الملفات السحابية الخاصة", "Private cloud files"), style = MaterialTheme.typography.titleLarge); TextButton(onClick = { vm.load("uploads") }, enabled = !state.busy) { Text(state.mediaLabel("تحديث", "Refresh")) } }
        items(state.rows["uploads"].orEmpty(), key = { it.text("id") }) { file -> Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(12.dp)) { Text(file.text("name")); Text("${file.text("status")} · ${file.text("purpose")} · ${file.text("size_bytes")} B"); TextButton(onClick = { removeCloud = file }, enabled = !state.busy) { Text(state.mediaLabel("حذف النسخة السحابية", "Delete cloud copy")) } } } }
    }
    upload?.let { vision -> AlertDialog(onDismissRequest = { upload = null }, title = { Text(state.mediaLabel("موافقة الرفع", "Confirm upload")) }, text = { Text(if (vision) state.mediaLabel("ستُرفع المعاينة إلى تخزين حسابك الخاص. عند إرسال سؤال ستُرسل للنموذج الذي يدعم الصور. قد تُستهلك حصة أو رسوم المزود. الفيديو وPDF يمثلان لقطة أو صفحة فقط. لا ترسل محتوى حساسًا دون مراجعته.", "Upload the preview to your private account storage. Sending a question passes it to a vision model and may consume provider quota or fees. Video/PDF previews represent one frame/page only. Review sensitive content first.") else state.mediaLabel("ستُرفع نسخة من الملف الأصلي إلى Supabase الخاص بحسابك؛ لن تُرسل تلقائيًا إلى نموذج. الحد 50MiB للملف و500MiB أو 50 ملفًا للحساب، بما فيها العمليات المعلقة.", "Upload the original to private Supabase storage; it is not automatically passed to a model. Limits: 50MiB per file, 500MiB or 50 files per account, including pending uploads.")) }, confirmButton = { TextButton(onClick = { vm.uploadMedia(vision, onChat); upload = null }) { Text(state.mediaLabel("أوافق وأرفع", "Confirm upload")) } }, dismissButton = { TextButton(onClick = { upload = null }) { Text(state.mediaLabel("إلغاء", "Cancel")) } }) }
    removeCloud?.let { file -> AlertDialog(onDismissRequest = { removeCloud = null }, title = { Text(state.mediaLabel("حذف النسخة السحابية؟", "Delete cloud copy?")) }, text = { Text(state.mediaLabel("سيُحذف الملف من التخزين وقد يتعذر إعادة تحليل الرسائل التي استخدمته. الأصل على الهاتف لا يُحذف.", "The cloud file will be deleted and linked messages may no longer be reanalyzable. The phone original remains.")) }, confirmButton = { TextButton(onClick = { vm.operation("removeUpload", payload("id" to file.text("id")), "uploads"); removeCloud = null }) { Text(state.mediaLabel("حذف", "Delete")) } }, dismissButton = { TextButton(onClick = { removeCloud = null }) { Text(state.mediaLabel("إلغاء", "Cancel")) } }) }
}
