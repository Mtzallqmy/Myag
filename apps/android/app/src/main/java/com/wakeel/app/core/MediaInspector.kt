package com.wakeel.app.core

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.serialization.json.*
import java.io.File
import java.security.MessageDigest
import java.util.UUID

data class MediaInspection(val uri: String, val name: String, val mime: String, val size: Long, val metadata: JsonObject, val preview: String?)
/** Local, streaming fingerprint; platform decoders only. Never runs source code or uploads. */
object MediaInspector {
    suspend fun inspect(context: Context, uri: Uri): MediaInspection {
        val resolver = context.contentResolver
        val name = resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { if (it.moveToFirst()) it.getString(0) else null } ?: "file"
        val mime = resolver.getType(uri) ?: "application/octet-stream"
        val digest = MessageDigest.getInstance("SHA-256")
        var size = 0L
        resolver.openInputStream(uri)?.use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) { currentCoroutineContext().ensureActive(); val read = input.read(buffer); if (read < 0) break; digest.update(buffer, 0, read); size += read }
        } ?: error("FILE_UNREADABLE")
        val fields = mutableMapOf<String, JsonElement>("sha256" to JsonPrimitive(digest.digest().joinToString("") { "%02x".format(it) }))
        var preview: String? = null
        fun save(bitmap: Bitmap) {
            try {
                val folder = File(context.cacheDir, "media-previews").apply { mkdirs() }
                val file = File(folder, "${UUID.randomUUID()}.jpg")
                file.outputStream().use { check(bitmap.compress(Bitmap.CompressFormat.JPEG, 80, it)) }
                preview = file.absolutePath
            } finally { bitmap.recycle() }
        }
        try {
            when {
                mime.startsWith("image/") -> {
                    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
                    require(bounds.outWidth > 0 && bounds.outHeight > 0 && bounds.outWidth.toLong() * bounds.outHeight <= 100_000_000L)
                    fields["width"] = JsonPrimitive(bounds.outWidth); fields["height"] = JsonPrimitive(bounds.outHeight)
                    var sample = 1
                    while (bounds.outWidth / sample > 1024 || bounds.outHeight / sample > 1024) sample *= 2
                    val options = BitmapFactory.Options().apply { inSampleSize = sample; inPreferredConfig = Bitmap.Config.RGB_565 }
                    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, options) }?.let(::save)
                    fields["analysis_scope"] = JsonPrimitive("IMAGE_PREVIEW")
                }
                mime.startsWith("video/") || mime.startsWith("audio/") -> {
                    val media = MediaMetadataRetriever()
                    try {
                        media.setDataSource(context, uri)
                        listOf("duration_ms" to MediaMetadataRetriever.METADATA_KEY_DURATION, "width" to MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH, "height" to MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT, "rotation" to MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION).forEach { (key, id) -> media.extractMetadata(id)?.let { fields[key] = JsonPrimitive(it) } }
                        if (mime.startsWith("video/") && Build.VERSION.SDK_INT >= 27) media.getScaledFrameAtTime(0L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC, 1024, 576)?.let(::save)
                        fields["analysis_scope"] = JsonPrimitive(if (preview != null) "FIRST_KEYFRAME_ONLY_NO_AUDIO" else "METADATA_ONLY")
                    } finally { media.release() }
                }
                mime == "application/pdf" -> {
                    resolver.openFileDescriptor(uri, "r")?.use { descriptor -> PdfRenderer(descriptor).use { pdf ->
                        fields["pages"] = JsonPrimitive(pdf.pageCount)
                        if (pdf.pageCount > 0) pdf.openPage(0).use { page ->
                            val width = 1024; val height = (width.toLong() * page.height / page.width.coerceAtLeast(1)).coerceIn(1, 2048).toInt()
                            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                            bitmap.eraseColor(android.graphics.Color.WHITE)
                            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY); save(bitmap)
                        }
                    } }
                    fields["analysis_scope"] = JsonPrimitive("FIRST_PAGE_PREVIEW_NO_TEXT_EXTRACTION")
                }
                else -> fields["analysis_scope"] = JsonPrimitive("FINGERPRINT_ONLY")
            }
        } catch (e: kotlinx.coroutines.CancellationException) { throw e }
        catch (_: Exception) { fields["decoder_status"] = JsonPrimitive("UNSUPPORTED_OR_DAMAGED") }
        return MediaInspection(uri.toString(), name.take(150), mime, size, JsonObject(fields), preview)
    }
}
