package com.wakeel.app.core

import org.junit.Assert.*
import org.junit.Test

class LocalSearchTest {
    @Test fun returnsCorrectFilesAndLineNumbersForArabicAndCode() {
        val files = listOf("src/probe.kt" to "// تعليق عربي\nfun probe() = 42\n", "notes.txt" to "ملاحظات\nتعليق عربي\n")
        assertEquals(listOf(1, 2), LocalSearch.find(files, "تعليق عربي").map { it.line })
        val code = LocalSearch.find(files, "probe")
        assertEquals(listOf("file", "text"), code.map { it.kind })
        assertEquals(2, code.last().line)
    }
    @Test fun blankQueriesAndResultLimitsDoNotProduceFalseResults() {
        val files = listOf("notes.txt" to (1..500).joinToString("\n") { "match $it" })
        assertTrue(LocalSearch.find(files, " ").isEmpty())
        assertEquals(200, LocalSearch.find(files, "match").size)
        assertTrue(LocalSearch.find(files, "absent").isEmpty())
        assertEquals(240, LocalSearch.find(listOf("a.kt" to "x".repeat(500)), "x").first().preview.length)
    }
}
