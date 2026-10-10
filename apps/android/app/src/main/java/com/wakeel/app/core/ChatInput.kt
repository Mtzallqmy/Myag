package com.wakeel.app.core

object ChatInput {
    const val MAX_CHARS = 32_000
    fun fits(message: String, attachment: String = ""): Boolean = message.length.toLong() + attachment.length + (if (attachment.isEmpty()) 0 else 2) <= MAX_CHARS
    fun combine(message: String, attachment: String = ""): String {
        require(fits(message, attachment)) { "MESSAGE_TOO_LARGE" }
        return message + if (attachment.isEmpty()) "" else "\n\n" + attachment
    }
}
