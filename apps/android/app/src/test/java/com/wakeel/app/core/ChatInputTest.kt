package com.wakeel.app.core

import org.junit.Assert.*
import org.junit.Test
class ChatInputTest {
    @Test fun acceptsExactBoundaryWithoutDroppingAttachment() {
        val message = "m".repeat(1_998); val file = "f".repeat(30_000)
        assertTrue(ChatInput.fits(message, file)); assertEquals(32_000, ChatInput.combine(message, file).length)
        assertFalse(ChatInput.fits(message + "m", file))
    }
    @Test fun rejectsOversizedTextAndPreservesNormalInput() {
        assertEquals("مرحبا", ChatInput.combine("مرحبا")); assertFalse(ChatInput.fits("x".repeat(32_001)))
        try { ChatInput.combine("x".repeat(32_001)); fail("must reject") } catch (_: IllegalArgumentException) { }
    }
}
