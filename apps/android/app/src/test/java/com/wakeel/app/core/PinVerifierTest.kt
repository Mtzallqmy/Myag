package com.wakeel.app.core

import org.junit.Assert.*
import org.junit.Test

class PinVerifierTest {
    @Test fun wrongPinAndDifferentSaltDoNotUnlock() {
        val salt = ByteArray(16) { it.toByte() }
        val expected = PinVerifier.derive("730192", salt)
        assertTrue(PinVerifier.matches("730192", salt, expected))
        assertFalse(PinVerifier.matches("730193", salt, expected))
        assertFalse(PinVerifier.matches("730192", ByteArray(16) { (it + 1).toByte() }, expected))
    }
    @Test fun malformedPinsAreRejected() {
        listOf("", "12345", "1234567890123", "abcdef", "١٢٣٤٥٦").forEach { assertFalse(PinVerifier.valid(it)) }
        assertTrue(PinVerifier.valid("123456"))
        assertTrue(PinVerifier.valid("123456789012"))
    }
}
