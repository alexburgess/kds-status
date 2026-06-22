package com.kdsstatus.app.ui

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

object StatusFormatter {
    private val configTimestampFormatter = DateTimeFormatter.ofPattern("MMM d, h:mm a")
        .withZone(ZoneId.systemDefault())

    fun missingConfigMessage(keys: List<String>): String =
        if (keys.isEmpty()) "Managed configuration is complete."
        else "Missing managed configuration: ${keys.joinToString(", ")}"

    fun configCollectedAt(epochMillis: Long): String =
        configTimestampFormatter.format(Instant.ofEpochMilli(epochMillis))

    fun transportLabel(transport: String): String = when (transport) {
        "wifi" -> "Wi-Fi"
        "ethernet" -> "Ethernet"
        "cellular" -> "Cellular"
        "vpn" -> "VPN"
        "offline" -> "Offline"
        else -> "Unknown"
    }

    fun squareKdsLabel(versionStatus: String, installedVersion: String?): String = when (versionStatus) {
        "match" -> "Installed $installedVersion"
        "mismatch" -> "Version mismatch: ${installedVersion ?: "unknown"}"
        "not_installed" -> "Not installed or not visible"
        "not_configured" -> "Package not configured"
        else -> "Unknown"
    }
}
