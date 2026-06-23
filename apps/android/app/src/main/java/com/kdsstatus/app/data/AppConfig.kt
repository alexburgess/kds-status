package com.kdsstatus.app.data

data class AppConfig(
    val deviceId: String,
    val deviceSecret: String,
    val apiBaseUrl: String,
    val missingKeys: List<String> = emptyList()
) {
    val isComplete: Boolean = missingKeys.isEmpty()
}

object AppConfigParser {
    const val DEFAULT_DEVICE_SECRET = "kds-status-internal-v1"
    const val DEFAULT_API_BASE_URL = "http://10.20.12.100:3001"

    fun parse(values: Map<String, String?>): AppConfig {
        val deviceId = values["device_id"].orEmpty().trim()
        val deviceSecret = values["device_secret"].orEmpty().trim().ifBlank { DEFAULT_DEVICE_SECRET }
        val apiBaseUrl = values["api_base_url"].orEmpty().trim().ifBlank { DEFAULT_API_BASE_URL }.trimEnd('/')

        val missing = buildList {
            if (deviceSecret.isBlank()) add("device_secret")
            if (apiBaseUrl.isBlank()) add("api_base_url")
        }

        return AppConfig(
            deviceId = deviceId,
            deviceSecret = deviceSecret,
            apiBaseUrl = apiBaseUrl,
            missingKeys = missing
        )
    }

    fun builtIn(): AppConfig = parse(emptyMap())
}
