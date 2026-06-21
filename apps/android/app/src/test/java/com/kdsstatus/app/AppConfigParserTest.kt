package com.kdsstatus.app

import com.kdsstatus.app.data.AppConfigParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppConfigParserTest {
    @Test
    fun parsesCompleteManagedConfig() {
        val config = AppConfigParser.parse(
            mapOf(
                "device_id" to "expo-line-01",
                "device_secret" to "demo-secret",
                "api_base_url" to "https://kds.example.com/"
            )
        )

        assertTrue(config.isComplete)
        assertEquals("expo-line-01", config.deviceId)
        assertEquals("https://kds.example.com", config.apiBaseUrl)
    }

    @Test
    fun reportsMissingKeys() {
        val config = AppConfigParser.parse(mapOf("device_id" to "expo-line-01"))

        assertEquals(listOf("device_secret", "api_base_url"), config.missingKeys)
    }
}
