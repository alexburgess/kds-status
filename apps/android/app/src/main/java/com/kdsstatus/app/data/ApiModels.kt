package com.kdsstatus.app.data

import kotlinx.serialization.Serializable

@Serializable
data class DeviceConfigResponse(
    val deviceId: String,
    val displayName: String,
    val locationName: String,
    val role: String,
    val notes: String,
    val squareKds: SquareKdsDefinition,
    val fulfillmentMethods: FulfillmentMethodsDefinition? = null,
    val expectedSettings: List<ExpectedSetting>,
    val printers: List<PrinterTarget>
)

@Serializable
data class DeviceClaimOptionsResponse(
    val options: List<DeviceClaimOption>
)

@Serializable
data class DeviceClaimOption(
    val deviceId: String,
    val displayName: String,
    val locationName: String,
    val role: String,
    val macAddress: String? = null,
    val active: Boolean = true
)

@Serializable
data class DeviceClaimRequest(
    val deviceId: String,
    val targetDeviceId: String
)

@Serializable
data class DeviceClaimResponse(
    val ok: Boolean,
    val config: DeviceConfigResponse
)

@Serializable
data class SquareKdsDefinition(
    val packageName: String? = null,
    val availableVersion: String? = null,
    val expectedVersion: String? = null,
    val versionSource: String? = null,
    val versionLookupError: String? = null,
    val versionCheckedAt: String? = null,
    val playStoreUpdatedAt: String? = null
)

@Serializable
data class ExpectedSetting(
    val section: String,
    val setting: String,
    val expected: String
)

@Serializable
data class FulfillmentMethodsDefinition(
    val includeFutureFulfillmentMethods: Boolean = false,
    val methods: List<FulfillmentMethodDefinition> = emptyList()
)

@Serializable
data class FulfillmentMethodDefinition(
    val name: String,
    val enabled: Boolean
)

@Serializable
data class PrinterTarget(
    val id: String,
    val name: String,
    val host: String,
    val port: Int = 9100,
    val macAddress: String? = null,
    val description: String? = null
)

@Serializable
data class StatusReportPayload(
    val localIp: String? = null,
    val localMacAddress: String? = null,
    val activeTransport: String,
    val internet: InternetCheckPayload,
    val printerChecks: List<PrinterCheckPayload>,
    val squareKds: SquareKdsCheckPayload,
    val appVersion: String,
    val diagnostics: List<String>
)

@Serializable
data class InternetCheckPayload(
    val ok: Boolean,
    val latencyMs: Int? = null,
    val error: String? = null
)

@Serializable
data class PrinterCheckPayload(
    val printerId: String? = null,
    val name: String,
    val host: String,
    val port: Int,
    val macAddress: String? = null,
    val ok: Boolean,
    val latencyMs: Int? = null,
    val error: String? = null
)

@Serializable
data class SquareKdsCheckPayload(
    val packageName: String? = null,
    val installedVersion: String? = null,
    val availableVersion: String? = null,
    val expectedVersion: String? = null,
    val versionStatus: String,
    val error: String? = null
)
