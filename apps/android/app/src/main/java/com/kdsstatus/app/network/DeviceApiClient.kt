package com.kdsstatus.app.network

import com.kdsstatus.app.data.AppConfig
import com.kdsstatus.app.data.DeviceConfigResponse
import com.kdsstatus.app.data.StatusReportPayload
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class DeviceApiClient(
    private val appConfig: AppConfig,
    private val deviceMacAddress: String?
) {
    private val json = Json {
        ignoreUnknownKeys = true
    }

    suspend fun fetchConfig(): Result<DeviceConfigResponse> = withContext(Dispatchers.IO) {
        runCatching {
            val connection = openConnection("/api/device/config", "GET")
            connection.inputStream.bufferedReader().use { body ->
                json.decodeFromString<DeviceConfigResponse>(body.readText())
            }
        }
    }

    suspend fun postStatus(payload: StatusReportPayload): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val connection = openConnection("/api/device/status", "POST")
            connection.setRequestProperty("Content-Type", "application/json")
            connection.doOutput = true
            connection.outputStream.use { output ->
                output.write(json.encodeToString(payload).toByteArray())
            }

            if (connection.responseCode !in 200..299) {
                val errorBody = connection.errorStream?.bufferedReader()?.use { it.readText() }
                error("Status report failed: HTTP ${connection.responseCode} ${errorBody.orEmpty()}")
            }
        }
    }

    private fun openConnection(path: String, method: String): HttpURLConnection {
        val url = URL("${appConfig.apiBaseUrl}$path")
        return (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 5000
            readTimeout = 5000
            if (appConfig.deviceId.isNotBlank()) {
                setRequestProperty("X-Device-Id", appConfig.deviceId)
            }
            if (!deviceMacAddress.isNullOrBlank()) {
                setRequestProperty("X-Device-Mac-Address", deviceMacAddress)
            }
            setRequestProperty("X-Device-Secret", appConfig.deviceSecret)
        }
    }
}
