package com.kdsstatus.app.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class DeviceConfigCache(context: Context) {
    private val preferences = context.getSharedPreferences("device_config_cache", Context.MODE_PRIVATE)
    private val json = Json {
        ignoreUnknownKeys = true
    }

    fun read(): CachedDeviceConfig? {
        val raw = preferences.getString(KEY_CONFIG, null) ?: return null
        return runCatching {
            json.decodeFromString<CachedDeviceConfig>(raw)
        }.getOrNull()
    }

    fun save(config: DeviceConfigResponse, collectedAtMillis: Long = System.currentTimeMillis()): CachedDeviceConfig {
        val cached = CachedDeviceConfig(
            collectedAtMillis = collectedAtMillis,
            config = config
        )
        preferences.edit()
            .putString(KEY_CONFIG, json.encodeToString(cached))
            .apply()
        return cached
    }

    private companion object {
        const val KEY_CONFIG = "config"
    }
}

@Serializable
data class CachedDeviceConfig(
    val collectedAtMillis: Long,
    val config: DeviceConfigResponse
)
