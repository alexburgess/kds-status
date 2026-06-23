package com.kdsstatus.app

import com.kdsstatus.app.ui.StatusFormatter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class StatusFormatterTest {
    @Test
    fun formatsTransportNames() {
        assertEquals("Wi-Fi", StatusFormatter.transportLabel("wifi"))
        assertEquals("Ethernet", StatusFormatter.transportLabel("ethernet"))
        assertEquals("Unknown", StatusFormatter.transportLabel("something-new"))
    }

    @Test
    fun formatsMissingAppSetup() {
        assertEquals(
            "Missing app setup: readable device MAC address",
            StatusFormatter.missingConfigMessage(listOf("readable device MAC address"))
        )
    }

    @Test
    fun formatsConfigCollectedAt() {
        assertTrue(StatusFormatter.configCollectedAt(1_782_000_000_000).isNotBlank())
    }

    @Test
    fun formatsSquareKdsStatus() {
        assertEquals("Installed 6.0.1", StatusFormatter.squareKdsLabel("match", "6.0.1"))
        assertEquals("Package not configured", StatusFormatter.squareKdsLabel("not_configured", null))
    }
}
