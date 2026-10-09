package com.wakeel.app.core

/** Handles CRLF, multi-line data and comments without interpreting arbitrary server text. */
class SseParser(private val onEvent: (String, String) -> Unit) {
    private var event = "message"
    private val data = mutableListOf<String>()
    fun line(raw: String) {
        val line = raw.removeSuffix("\r")
        when {
            line.isEmpty() -> { if (data.isNotEmpty()) onEvent(event, data.joinToString("\n")); event = "message"; data.clear() }
            line.startsWith("event:") -> event = line.substringAfter(':').removePrefix(" ")
            line.startsWith("data:") -> data.add(line.substringAfter(':').removePrefix(" "))
        }
    }
}
