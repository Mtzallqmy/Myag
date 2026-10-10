package com.wakeel.app.core

import java.io.InputStream
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.security.MessageDigest
import kotlinx.serialization.json.*

data class FileFinding(val kind: String, val line: Int)
data class FileInspection(val language: String, val sha256: String, val bytes: Int, val lines: Int, val symbols: List<String>, val findings: List<FileFinding>, val frameworks: List<String>, val jsonValid: Boolean?)
object FileInspector {
    const val MAX_BYTES = 600_000
    private val secrets = listOf(
        Regex("\\b(?:sk-|nvapi-|ghp_|github_pat_)[A-Za-z0-9_-]{16,}"),
        Regex("\\b[0-9]{6,}:[A-Za-z0-9_-]{30,}"),
        Regex("\\beyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}"),
        Regex("(?i)(?:api[_-]?key|password|secret|token)\\s*[:=]\\s*[\"']?[^\\s\"']{8,}"),
        Regex("-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]*?-----END [A-Z ]*PRIVATE KEY-----")
    )
    fun readBounded(stream: InputStream, limit: Int = MAX_BYTES): ByteArray {
        require(limit in 1..4_000_000)
        val output = java.io.ByteArrayOutputStream()
        val buffer = ByteArray(8192)
        while (true) {
            val n = stream.read(buffer)
            if (n < 0) break
            if (output.size() + n > limit) throw IllegalArgumentException("FILE_TOO_LARGE")
            output.write(buffer, 0, n)
        }
        return output.toByteArray()
    }
    fun decode(bytes: ByteArray): String {
        require(bytes.size <= MAX_BYTES) { "FILE_TOO_LARGE" }
        require(!bytes.contains(0.toByte())) { "BINARY_FILE" }
        return try { Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString().removePrefix("\uFEFF") }
        catch (_: java.nio.charset.CharacterCodingException) { throw IllegalArgumentException("UNSUPPORTED_ENCODING") }
    }
    fun redact(text: String): String = secrets.fold(text) { value, pattern -> pattern.replace(value, "[REDACTED]") }
    fun inspect(path: String, text: String): FileInspection {
        val bytes = text.toByteArray()
        require(bytes.size <= MAX_BYTES) { "FILE_TOO_LARGE" }
        val ext = path.substringAfterLast('.').lowercase()
        val language = mapOf("kt" to "Kotlin", "kts" to "Kotlin", "java" to "Java", "py" to "Python", "ts" to "TypeScript", "tsx" to "TypeScript", "js" to "JavaScript", "jsx" to "JavaScript", "rs" to "Rust", "go" to "Go", "json" to "JSON", "sql" to "SQL", "md" to "Markdown", "yaml" to "YAML", "yml" to "YAML", "html" to "HTML", "css" to "CSS", "sh" to "Shell")[ext] ?: "Text"
        val symbols = mutableListOf<String>(); val findings = mutableListOf<FileFinding>()
        val symbol = Regex("\\b(?:fun|def|function|class|interface|struct|enum)\\s+([A-Za-z_][A-Za-z0-9_]*)")
        var count = 0
        text.lineSequence().forEach { line ->
            count++
            if (symbols.size < 100) symbol.find(line)?.groupValues?.get(1)?.let { symbols += "$count · $it" }
            if (findings.size < 100 && secrets.any { it.containsMatchIn(line) }) findings += FileFinding("SECRET", count)
            if (findings.size < 100 && Regex("\\b(?:eval|exec)\\s*\\(").containsMatchIn(line)) findings += FileFinding("DYNAMIC_EXECUTION", count)
            if (findings.size < 100 && line.contains("http://")) findings += FileFinding("CLEARTEXT_URL", count)
            if (findings.size < 100 && Regex("\\b(?:TODO|FIXME)\\b").containsMatchIn(line)) findings += FileFinding("TODO", count)
        }
        if (text.contains("-----BEGIN") && text.contains("PRIVATE KEY-----") && findings.none { it.kind == "SECRET" }) findings += FileFinding("SECRET", 1)
        val frameworks = listOf("React" to "react", "Compose" to "androidx.compose", "Fastify" to "fastify", "Supabase" to "supabase", "Django" to "django", "Flutter" to "flutter", "Spring" to "org.springframework").filter { (_, marker) -> text.contains(marker, ignoreCase = true) }.map { it.first }
        val jsonValid = if (language == "JSON") runCatching { Json.parseToJsonElement(text) }.isSuccess else null
        return FileInspection(language, MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }, bytes.size, count, symbols, findings, frameworks, jsonValid)
    }
    fun process(text: String, action: String): String = when (action) {
        "JSON" -> Json { prettyPrint = true }.encodeToString(JsonElement.serializer(), Json.parseToJsonElement(text))
        "REDACT" -> redact(text)
        "TRIM" -> text.lineSequence().joinToString("\n") { it.trimEnd() }
        else -> throw IllegalArgumentException("UNKNOWN_PROCESSOR")
    }
}
