package com.kdsstatus.app.ui

object StatusFormatter {
    fun missingConfigMessage(keys: List<String>): String =
        if (keys.isEmpty()) "Managed configuration is complete."
        else "Missing managed configuration: ${keys.joinToString(", ")}"

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
