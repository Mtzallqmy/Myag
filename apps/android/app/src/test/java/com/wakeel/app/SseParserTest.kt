package com.wakeel.app

import com.wakeel.app.core.SseParser
import org.junit.Assert.*
import org.junit.Test

class SseParserTest {
    @Test fun deliversOnlyCompleteEventsAndPreservesArabic() {
        val events = mutableListOf<Pair<String, String>>()
        val parser = SseParser { type, data -> events.add(type to data) }
        parser.line("event: delta"); parser.line("data: {\"text\":\"مرحبا\"}")
        assertTrue(events.isEmpty()); parser.line("")
        assertEquals(listOf("delta" to "{\"text\":\"مرحبا\"}"), events)
    }
    @Test fun handlesCrLfCommentsAndMultipleDataLines() {
        val events = mutableListOf<Pair<String, String>>()
        val parser = SseParser { type, data -> events.add(type to data) }
        listOf(": keepalive\r", "event: custom\r", "data: first\r", "data: second\r", "\r", "data: next", "").forEach(parser::line)
        assertEquals(listOf("custom" to "first\nsecond", "message" to "next"), events)
    }
}
