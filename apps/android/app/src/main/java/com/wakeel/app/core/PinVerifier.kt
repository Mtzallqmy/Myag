package com.wakeel.app.core

import java.security.MessageDigest
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

object PinVerifier {
    fun normalize(input: String): String = input.mapNotNull { c -> Character.digit(c, 10).takeIf { it >= 0 }?.let { ('0'.code + it).toChar() } }.joinToString("").take(12)
    fun valid(pin: String) = pin.length in 6..12 && pin.all { it in '0'..'9' }
    fun derive(pin: String, salt: ByteArray): ByteArray {
        require(valid(pin))
        val spec = PBEKeySpec(pin.toCharArray(), salt, 210_000, 256)
        return try { SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded } finally { spec.clearPassword() }
    }
    fun matches(pin: String, salt: ByteArray, expected: ByteArray): Boolean = valid(pin) && MessageDigest.isEqual(derive(pin, salt), expected)
}
