package com.kdsstatus.app

import com.kdsstatus.app.ui.StatusFormatter
import org.junit.Assert.assertEquals
import org.junit.Test

class StatusFormatterTest {
    @Test
    fun formatsTransportNames() {
        assertEquals("Wi-Fi", StatusFormatter.transportLabel("wifi"))
        assertEquals("Ethernet", StatusFormatter.transportLabel("ethernet"))
        assertEquals("Unknown", StatusFormatter.transportLabel("something-new"))
    }

    @Test
    fun formatsMissingManagedConfig() {
        assertEquals(
            "Missing managed configuration: device_secret, api_base_url",
            StatusFormatter.missingConfigMessage(listOf("device_secret", "api_base_url"))
        )
    }

    @Test
    fun formatsSquareKdsStatus() {
        assertEquals("Installed 6.0.1", StatusFormatter.squareKdsLabel("match", "6.0.1"))
        assertEquals("Package not configured", StatusFormatter.squareKdsLabel("not_configured", null))
    }
}
