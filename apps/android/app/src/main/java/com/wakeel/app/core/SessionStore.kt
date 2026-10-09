package com.wakeel.app.core

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

private val Context.store by preferencesDataStore("wakeel_settings")
@Serializable
data class SessionUser(val id: String)
@Serializable
data class Session(val access_token: String, val refresh_token: String, val expires_at: Long = 0, val user: SessionUser? = null)

@Singleton
class SessionStore @Inject constructor(@ApplicationContext private val context: Context) {
    private val sessionKey = stringPreferencesKey("encrypted_session")
    private val json = Json { ignoreUnknownKeys = true }
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey("wakeel_session_v1", null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("wakeel_session_v1", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build())
        }.generateKey()
    }
    suspend fun save(session: Session) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val encrypted = cipher.iv + cipher.doFinal(json.encodeToString(session).toByteArray(Charsets.UTF_8))
        context.store.edit { it[sessionKey] = Base64.encodeToString(encrypted, Base64.NO_WRAP) }
    }
    suspend fun read(): Session? {
        val encoded = context.store.data.first()[sessionKey] ?: return null
        return try {
            val bytes = Base64.decode(encoded, Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12))) }
            json.decodeFromString<Session>(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
        } catch (_: Exception) { clear(); null }
    }
    suspend fun clear() { context.store.edit { it.remove(sessionKey) } }
    suspend fun setting(name: String, value: Boolean) { context.store.edit { it[booleanPreferencesKey(name)] = value } }
    suspend fun setting(name: String): Boolean = context.store.data.first()[booleanPreferencesKey(name)] ?: false
}
