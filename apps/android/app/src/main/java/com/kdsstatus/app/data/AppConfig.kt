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
    const val DEVICE_ID = "device_id"
    const val DEVICE_SECRET = "device_secret"
    const val API_BASE_URL = "api_base_url"

    fun parse(values: Map<String, String?>): AppConfig {
        val deviceId = values[DEVICE_ID].orEmpty().trim()
        val deviceSecret = values[DEVICE_SECRET].orEmpty().trim()
        val apiBaseUrl = values[API_BASE_URL].orEmpty().trim().trimEnd('/')

        val missing = buildList {
            if (deviceSecret.isBlank()) add(DEVICE_SECRET)
            if (apiBaseUrl.isBlank()) add(API_BASE_URL)
        }

        return AppConfig(
            deviceId = deviceId,
            deviceSecret = deviceSecret,
            apiBaseUrl = apiBaseUrl,
            missingKeys = missing
        )
    }
}
