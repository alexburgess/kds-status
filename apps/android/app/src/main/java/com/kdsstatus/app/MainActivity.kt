package com.kdsstatus.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kdsstatus.app.data.AppConfig
import com.kdsstatus.app.data.DeviceConfigCache
import com.kdsstatus.app.data.DeviceConfigResponse
import com.kdsstatus.app.data.ExpectedSetting
import com.kdsstatus.app.data.InternetCheckPayload
import com.kdsstatus.app.data.ManagedConfigRepository
import com.kdsstatus.app.data.PrinterCheckPayload
import com.kdsstatus.app.data.PrinterTarget
import com.kdsstatus.app.data.SquareKdsCheckPayload
import com.kdsstatus.app.data.SquareKdsDefinition
import com.kdsstatus.app.data.StatusReportPayload
import com.kdsstatus.app.diagnostics.NetworkDiagnostics
import com.kdsstatus.app.network.DeviceApiClient
import com.kdsstatus.app.ui.StatusFormatter

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val configRepository = ManagedConfigRepository(this)
        val configCache = DeviceConfigCache(this)
        val diagnostics = NetworkDiagnostics(this)

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFF6F8FB)) {
                    KdsStatusApp(
                        readConfig = configRepository::readConfig,
                        configCache = configCache,
                        diagnostics = diagnostics
                    )
                }
            }
        }
    }
}

@Composable
private fun KdsStatusApp(
    readConfig: () -> AppConfig,
    configCache: DeviceConfigCache,
    diagnostics: NetworkDiagnostics
) {
    var state by remember { mutableStateOf<ScreenState>(ScreenState.Loading) }

    suspend fun refresh() {
        val appConfig = readConfig()
        if (!appConfig.isComplete) {
            state = ScreenState.MissingConfig(appConfig)
            return
        }

        val deviceMacAddress = diagnostics.readLocalMacAddress()
        if (appConfig.deviceId.isBlank() && deviceMacAddress.isNullOrBlank()) {
            state = ScreenState.MissingConfig(
                appConfig.copy(missingKeys = appConfig.missingKeys + "device_id or readable Ethernet MAC address")
            )
            return
        }

        val api = DeviceApiClient(appConfig, deviceMacAddress)
        val fetchedConfig = api.fetchConfig()
        val cachedConfig = if (fetchedConfig.isSuccess) {
            configCache.save(fetchedConfig.getOrThrow())
        } else {
            configCache.read()
        }

        if (cachedConfig == null) {
            val message = fetchedConfig.exceptionOrNull()?.message.orEmpty()
            state = ScreenState.Error("Could not fetch device config and no cached config is available: $message")
            return
        }

        val remoteConfig = cachedConfig.config
        val configWarning = fetchedConfig.exceptionOrNull()?.message?.let { error ->
            "Using cached configuration because the dashboard could not be reached: $error"
        }
        val report = diagnostics.run(remoteConfig)
        val postError = api.postStatus(report).exceptionOrNull()

        state = ScreenState.Ready(
            appConfig = appConfig,
            remoteConfig = remoteConfig,
            report = report,
            postError = postError?.message,
            configCollectedAtMillis = cachedConfig.collectedAtMillis,
            isUsingCachedConfig = fetchedConfig.isFailure,
            configWarning = configWarning
        )
    }

    LaunchedEffect(Unit) {
        refresh()
    }

    StatusContent(
        state = state,
        onRefresh = {
            state = ScreenState.Loading
        },
        onPreview = {
            state = ScreenState.Ready(
                appConfig = AppConfig(
                    deviceId = "preview-kds",
                    deviceSecret = "",
                    apiBaseUrl = ""
                ),
                remoteConfig = previewDeviceConfig(),
                report = previewStatusReport(),
                postError = "Preview only. No dashboard upload was attempted.",
                configCollectedAtMillis = System.currentTimeMillis(),
                isUsingCachedConfig = false,
                configWarning = null
            )
        }
    )

    if (state == ScreenState.Loading) {
        LaunchedEffect(state) {
            refresh()
        }
    }
}

@Composable
private fun StatusContent(
    state: ScreenState,
    onRefresh: () -> Unit,
    onPreview: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("KDS Status", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Color(0xFF14202B))

        when (state) {
            ScreenState.Loading -> LoadingCard()
            is ScreenState.MissingConfig -> MissingConfigCard(state.config, onPreview)
            is ScreenState.Error -> ErrorCard(state.message, onRefresh)
            is ScreenState.Ready -> ReadyScreen(state, onRefresh)
        }
    }
}

@Composable
private fun LoadingCard() {
    StatusCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(color = Color(0xFF0F6D7A), strokeWidth = 3.dp)
            Spacer(Modifier.width(14.dp))
            Text("Running diagnostics...", fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun MissingConfigCard(config: AppConfig, onPreview: () -> Unit) {
    StatusCard {
        Text("Setup required", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(StatusFormatter.missingConfigMessage(config.missingKeys), color = Color(0xFFB42318))
        Spacer(Modifier.height(8.dp))
        Text("Set device_secret and api_base_url in Miradore. device_id is optional when Ethernet MAC is available.")
        Spacer(Modifier.height(12.dp))
        Button(
            onClick = onPreview,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F6D7A)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Preview device screen")
        }
    }
}

@Composable
private fun ErrorCard(message: String, onRefresh: () -> Unit) {
    StatusCard {
        Text("Could not complete diagnostics", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(message, color = Color(0xFFB42318))
        Spacer(Modifier.height(12.dp))
        Button(onClick = onRefresh, colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F6D7A))) {
            Text("Retry")
        }
    }
}

@Composable
private fun ReadyScreen(state: ScreenState.Ready, onRefresh: () -> Unit) {
    HeaderCard(
        config = state.remoteConfig,
        report = state.report,
        postError = state.postError,
        configCollectedAtMillis = state.configCollectedAtMillis,
        isUsingCachedConfig = state.isUsingCachedConfig,
        configWarning = state.configWarning
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        ThisDevicePanel(
            report = state.report,
            modifier = Modifier.weight(1f)
        )
        ConnectedDevicesPanel(
            report = state.report,
            modifier = Modifier.weight(1f)
        )
        SquareKdsConfigurationPanel(
            config = state.remoteConfig,
            report = state.report,
            modifier = Modifier.weight(1f)
        )
    }

    Button(
        onClick = onRefresh,
        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F6D7A)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Text("Run diagnostics again")
    }
}

@Composable
private fun HeaderCard(
    config: DeviceConfigResponse,
    report: StatusReportPayload,
    postError: String?,
    configCollectedAtMillis: Long,
    isUsingCachedConfig: Boolean,
    configWarning: String?
) {
    StatusCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(config.displayName, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                Text("${config.locationName} · ${config.role}", color = Color(0xFF5F6F7E))
            }
            StatusRow(
                label = "Report",
                value = if (postError == null) "Uploaded" else "Upload failed: $postError",
                modifier = Modifier.weight(1.6f)
            )
            StatusRow("App version", report.appVersion, modifier = Modifier.weight(0.9f))
        }
        StatusRow(
            "Configuration",
            "${if (isUsingCachedConfig) "Cached" else "Collected"} ${StatusFormatter.configCollectedAt(configCollectedAtMillis)}"
        )
        configWarning?.let { warning ->
            Text(warning, color = Color(0xFF9A620B), fontSize = 13.sp)
        }
        if (config.notes.isNotBlank()) {
            Text(config.notes, color = Color(0xFF263847))
        }
    }
}

@Composable
private fun ThisDevicePanel(report: StatusReportPayload, modifier: Modifier = Modifier) {
    StatusCard(modifier = modifier) {
        PanelTitle("THIS DEVICE")
        StatusRow("MAC Address", report.localMacAddress ?: "Unavailable")
        StatusRow("IP Address", report.localIp ?: "Unknown")
        StatusRow("Connection", StatusFormatter.transportLabel(report.activeTransport))
        StatusDotRow(
            label = "Can connect to internet",
            value = if (report.internet.ok) "Yes (${report.internet.latencyMs ?: 0} ms)" else report.internet.error ?: "No",
            ok = report.internet.ok
        )
        report.diagnostics.forEach { diagnostic ->
            Text(diagnostic, color = Color(0xFF9A620B), fontSize = 13.sp)
        }
    }
}

@Composable
private fun ConnectedDevicesPanel(report: StatusReportPayload, modifier: Modifier = Modifier) {
    StatusCard(modifier = modifier) {
        PanelTitle("CONNECTED DEVICES")
        if (report.printerChecks.isEmpty()) {
            Text("No printer expected for this KDS screen.", color = Color(0xFF5F6F7E), fontSize = 14.sp)
        } else {
            report.printerChecks.forEach { printer ->
                Text(printer.name, color = Color(0xFF14202B), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                StatusRow("Printer MAC Address", printer.macAddress ?: "Unavailable")
                StatusRow("Printer IP Address", "${printer.host}:${printer.port}")
                StatusDotRow(
                    label = "Can this KDS reach it",
                    value = if (printer.ok) "Yes (${printer.latencyMs ?: 0} ms)" else printer.error ?: "No",
                    ok = printer.ok
                )
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun SquareKdsConfigurationPanel(
    config: DeviceConfigResponse,
    report: StatusReportPayload,
    modifier: Modifier = Modifier
) {
    StatusCard(modifier = modifier) {
        PanelTitle("SQUARE KDS CONFIGURATION")
        SettingGroup("Kitchen Routing", config.expectedSettings.filterForSection("Kitchen Routing", "routing"))
        SettingGroup("Sources", config.expectedSettings.filterForSection("Sources", "source"))
        val versionOk = when (report.squareKds.versionStatus) {
            "match" -> true
            "mismatch", "not_installed" -> false
            else -> null
        }
        StatusRow(
            label = "Installed version",
            value = StatusFormatter.squareKdsLabel(
                report.squareKds.versionStatus,
                report.squareKds.installedVersion
            )
        )
        StatusRow(
            "Available version",
            report.squareKds.availableVersion ?: report.squareKds.expectedVersion ?: "Unable to retrieve"
        )
        StatusDotRow(
            label = "Version current",
            value = when (report.squareKds.versionStatus) {
                "match" -> "Yes"
                "mismatch" -> "No"
                "not_installed" -> "Square KDS not visible"
                "not_configured" -> "Package not configured"
                else -> "Play Store lookup unavailable"
            },
            ok = versionOk
        )
        report.squareKds.error?.let { error ->
            Text(error, color = Color(0xFF9A620B), fontSize = 13.sp)
        }
    }
}

@Composable
private fun SettingGroup(title: String, settings: List<ExpectedSetting>) {
    Text(title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFF14202B))
    if (settings.isEmpty()) {
        Text("Not configured", color = Color(0xFF5F6F7E), fontSize = 13.sp)
    } else {
        settings.forEach { item ->
            StatusRow(label = item.setting, value = item.expected)
        }
    }
    Spacer(Modifier.height(8.dp))
}

@Composable
private fun StatusCard(
    modifier: Modifier = Modifier.fillMaxWidth(),
    content: @Composable ColumnScope.() -> Unit
) {
    Card(
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
            content = content
        )
    }
}

@Composable
private fun PanelTitle(text: String) {
    Text(text, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Color(0xFF14202B))
    Spacer(Modifier.height(6.dp))
}

@Composable
private fun StatusRow(label: String, value: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(Color(0xFFF7FAFC), RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = Color(0xFF5F6F7E), fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(
            value,
            color = Color(0xFF14202B),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1.2f),
            textAlign = TextAlign.End
        )
    }
}

@Composable
private fun StatusDotRow(label: String, value: String, ok: Boolean?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF7FAFC), RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        StatusDot(ok)
        Spacer(Modifier.width(8.dp))
        Text(label, color = Color(0xFF5F6F7E), fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(
            value,
            color = Color(0xFF14202B),
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1.2f),
            textAlign = TextAlign.End
        )
    }
}

@Composable
private fun StatusDot(ok: Boolean?) {
    val color = when (ok) {
        true -> Color(0xFF138A5E)
        false -> Color(0xFFB42318)
        null -> Color(0xFF9A620B)
    }

    Box(
        modifier = Modifier
            .size(10.dp)
            .background(color, RoundedCornerShape(999.dp))
    )
}

private fun previewDeviceConfig() = DeviceConfigResponse(
    deviceId = "preview-kds",
    displayName = "Expo Line 01",
    locationName = "Downtown Kitchen",
    role = "Expo screen",
    notes = "Preview data. Real tablets load this from the dashboard using their assigned deviceId.",
    squareKds = SquareKdsDefinition(
        packageName = "com.squareup.rst.kds",
        availableVersion = "7.12",
        expectedVersion = "7.12",
        versionSource = "play-store"
    ),
    expectedSettings = listOf(
        ExpectedSetting("Kitchen Routing", "Routing mode", "Expo controls entire order"),
        ExpectedSetting("Kitchen Routing", "Station filter", "All items"),
        ExpectedSetting("Sources", "Accepted sources", "POS, Online, Delivery"),
        ExpectedSetting("Sources", "Order visibility", "All open tickets")
    ),
    printers = listOf(
        PrinterTarget(
            id = "preview-printer",
            name = "Hot line printer",
            host = "192.168.20.61",
            port = 9100,
            macAddress = "00:11:32:aa:bb:61"
        )
    )
)

private fun previewStatusReport() = StatusReportPayload(
    localIp = "192.168.20.44",
    localMacAddress = "02:00:00:12:34:44",
    activeTransport = "ethernet",
    internet = InternetCheckPayload(ok = true, latencyMs = 41),
    printerChecks = listOf(
        PrinterCheckPayload(
            printerId = "preview-printer",
            name = "Hot line printer",
            host = "192.168.20.61",
            port = 9100,
            macAddress = "00:11:32:aa:bb:61",
            ok = true,
            latencyMs = 8
        )
    ),
    squareKds = SquareKdsCheckPayload(
        packageName = "com.squareup.rst.kds",
        installedVersion = "7.12",
        availableVersion = "7.12",
        expectedVersion = "7.12",
        versionStatus = "match"
    ),
    appVersion = BuildConfig.VERSION_NAME,
    diagnostics = listOf("Preview mode is using sample data.")
)

private fun List<ExpectedSetting>.filterForSection(section: String, keyword: String): List<ExpectedSetting> =
    filter { setting ->
        setting.section.equals(section, ignoreCase = true) ||
            setting.section.contains(keyword, ignoreCase = true) ||
            setting.setting.contains(keyword, ignoreCase = true)
    }

private sealed interface ScreenState {
    data object Loading : ScreenState
    data class MissingConfig(val config: AppConfig) : ScreenState
    data class Error(val message: String) : ScreenState
    data class Ready(
        val appConfig: AppConfig,
        val remoteConfig: DeviceConfigResponse,
        val report: StatusReportPayload,
        val postError: String?,
        val configCollectedAtMillis: Long,
        val isUsingCachedConfig: Boolean,
        val configWarning: String?
    ) : ScreenState
}
