package com.wakeel.app.core
import org.junit.Assert.*
import org.junit.Test
class FileInspectorTest {
 @Test fun recognizesSymbolsAndWarningsWithoutIncludingSecretInFindings() {
  val token = "123456:" + "x".repeat(35)
  val text = "import androidx.compose\nfun hello() = 1\ntoken=$token\n// TODO improve\n"
  val report = FileInspector.inspect("probe.kt", text)
  assertEquals("Kotlin", report.language); assertEquals(listOf("2 · hello"), report.symbols)
  assertTrue(report.frameworks.contains("Compose")); assertTrue(report.findings.any { it.kind == "SECRET" && it.line == 3 })
  assertFalse(FileInspector.redact(text).contains(token)); assertEquals(64, report.sha256.length)
 }
 @Test fun rejectsOversizeBinaryAndInvalidUtf8WithoutPartialImport() {
  assertThrows(IllegalArgumentException::class.java) { FileInspector.readBounded(ByteArray(20).inputStream(), 10) }
  assertThrows(IllegalArgumentException::class.java) { FileInspector.decode(byteArrayOf(0, 1)) }
  assertThrows(IllegalArgumentException::class.java) { FileInspector.decode(byteArrayOf(0xC3.toByte(), 0x28)) }
  assertEquals("نص", FileInspector.decode("نص".toByteArray()))
 }
 @Test fun formattingPreservesJsonDataAndOriginalIsImmutable() {
  val original = "{\"n\":1,\"text\":\"عربي\"}"
  val output = FileInspector.process(original, "JSON")
  assertTrue(output.contains("\n")); assertEquals(kotlinx.serialization.json.Json.parseToJsonElement(original), kotlinx.serialization.json.Json.parseToJsonElement(output))
  assertEquals("a\nb", FileInspector.process("a  \nb\t", "TRIM"))
  assertFalse(FileInspector.inspect("bad.json", "{").jsonValid!!)
 }
}
