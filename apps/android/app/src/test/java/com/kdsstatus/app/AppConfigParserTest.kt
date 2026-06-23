package com.kdsstatus.app

import com.kdsstatus.app.data.AppConfigParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AppConfigParserTest {
    @Test
    fun parsesOptionalOverrides() {
        val config = AppConfigParser.parse(
            mapOf(
                "device_id" to "expo-line-01",
                "api_base_url" to "https://kds.example.com/"
            )
        )

        assertTrue(config.isComplete)
        assertEquals("expo-line-01", config.deviceId)
        assertEquals("https://kds.example.com", config.apiBaseUrl)
        assertEquals(AppConfigParser.DEFAULT_DEVICE_SECRET, config.deviceSecret)
    }

    @Test
    fun usesBuiltInDefaultsWhenNoManagedConfigExists() {
        val config = AppConfigParser.parse(emptyMap())

        assertTrue(config.isComplete)
        assertEquals("", config.deviceId)
        assertEquals(AppConfigParser.DEFAULT_API_BASE_URL, config.apiBaseUrl)
        assertEquals(AppConfigParser.DEFAULT_DEVICE_SECRET, config.deviceSecret)
    }
}
