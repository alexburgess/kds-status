package com.kdsstatus.app

import android.os.Bundle
import androidx.annotation.DrawableRes
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
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
    when (state) {
        is ScreenState.Ready -> ReadyScreen(state, onRefresh)
        else -> {
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
                    is ScreenState.Ready -> Unit
                }
            }
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
    Row(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4F4F6))
    ) {
        StationOverviewPanel(
            config = state.remoteConfig,
            report = state.report,
            postError = state.postError,
            configCollectedAtMillis = state.configCollectedAtMillis,
            isUsingCachedConfig = state.isUsingCachedConfig,
            configWarning = state.configWarning,
            onRefresh = onRefresh,
            modifier = Modifier
                .width(430.dp)
                .fillMaxHeight()
        )
        ConfigurationWorkspace(
            config = state.remoteConfig,
            report = state.report,
            modifier = Modifier
                .weight(1f)
                .fillMaxHeight()
        )
    }
}

@Composable
private fun StationOverviewPanel(
    config: DeviceConfigResponse,
    report: StatusReportPayload,
    postError: String?,
    configCollectedAtMillis: Long,
    isUsingCachedConfig: Boolean,
    configWarning: String?,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .background(Color.White)
            .padding(horizontal = 28.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp)
    ) {
        Text(
            config.displayName,
            color = Color(0xFF050505),
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis
        )

        InfoPillSection(report)

        ConnectivityCard(
            title = "CONNECTIVITY OF THIS DEVICE",
            titleIconRes = R.drawable.fa_network_wired,
            ok = report.internet.ok,
            message = if (report.internet.ok) {
                "THIS SCREEN IS CONNECTED TO\nTHE INTERNET"
            } else {
                "THIS SCREEN CANNOT REACH\nTHE INTERNET"
            },
            detail = report.internet.error,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        )

        val printer = report.printerChecks.firstOrNull()
        val printersOk = when {
            report.printerChecks.isEmpty() -> null
            report.printerChecks.all { printerCheck -> printerCheck.ok } -> true
            else -> false
        }
        ConnectivityCard(
            title = "PRINTER CONNECTIVITY",
            titleIconRes = R.drawable.fa_print,
            ok = printersOk,
            message = printerConnectivityMessage(printer),
            detail = printerConnectivityDetail(printer),
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        )

        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                "${if (isUsingCachedConfig) "Cached" else "Collected"} config ${StatusFormatter.configCollectedAt(configCollectedAtMillis)}",
                color = Color(0xFF5F6368),
                fontSize = 12.sp
            )
            postError?.takeUnless { error -> error.contains("Preview only", ignoreCase = true) }?.let { error ->
                Text("Report upload failed: $error", color = Color(0xFF9A620B), fontSize = 12.sp)
            }
            configWarning?.let { warning ->
                Text(warning, color = Color(0xFF9A620B), fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }

        Button(
            onClick = onRefresh,
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF111111)),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Run diagnostics again")
        }
    }
}

@Composable
private fun ConfigurationWorkspace(
    config: DeviceConfigResponse,
    report: StatusReportPayload,
    modifier: Modifier = Modifier
) {
    val pages = remember(config.expectedSettings, config.printers) {
        buildConfigurationPages(config)
    }
    var selectedPageIndex by remember { mutableStateOf(0) }
    val selectedPage = pages[selectedPageIndex.coerceIn(pages.indices)]

    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 28.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            pages.forEachIndexed { index, page ->
                FilterChip(
                    selected = selectedPageIndex == index,
                    onClick = { selectedPageIndex = index },
                    label = {
                        Text(
                            page.title,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    },
                    shape = CircleShape,
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Color.Black,
                        selectedLabelColor = Color.White,
                        containerColor = Color(0xFFE0E0E0),
                        labelColor = Color(0xFF4D4A58)
                    ),
                    border = null,
                )
            }
        }

        Image(
            painter = painterResource(selectedPage.imageRes),
            contentDescription = "${selectedPage.title} Square KDS settings screenshot",
            contentScale = ContentScale.Fit,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(selectedPage.aspectRatio)
                .clip(RoundedCornerShape(2.dp))
                .background(Color.White)
        )

        ConfigurationDetails(page = selectedPage, report = report)
    }
}

@Composable
private fun InfoPillSection(report: StatusReportPayload) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InfoPill(R.drawable.fa_network_wired, report.localMacAddress ?: "Unavailable", "MAC address")
            InfoPill(R.drawable.fa_globe, report.localIp ?: "Unknown", "IP address")
        }
        Row {
            InfoPill(R.drawable.fa_tablet_screen_button, squareKdsVersionPill(report), "Square KDS version")
        }
    }
}

@Composable
private fun InfoPill(
    @DrawableRes iconRes: Int,
    value: String,
    contentDescription: String
) {
    AssistChip(
        onClick = {},
        label = {
            Row(
                horizontalArrangement = Arrangement.spacedBy(7.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    painter = painterResource(iconRes),
                    contentDescription = contentDescription,
                    tint = Color(0xFF3C4043),
                    modifier = Modifier.size(13.dp)
                )
                Text(
                    value,
                    color = Color(0xFF3C4043),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        },
        shape = CircleShape,
        colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFF0F0F0)),
        border = null,
        modifier = Modifier.height(34.dp)
    )
}

@Composable
private fun ConnectivityCard(
    title: String,
    @DrawableRes titleIconRes: Int,
    ok: Boolean?,
    message: String,
    detail: String?,
    modifier: Modifier = Modifier
) {
    val statusColor = when (ok) {
        true -> Color(0xFF34C759)
        false -> Color(0xFFE5484D)
        null -> Color(0xFFFFB020)
    }

    Card(
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF4F4F4)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
        modifier = modifier
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(14.dp)
                    .background(statusColor)
            )
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 18.dp, vertical = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceEvenly
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        painter = painterResource(titleIconRes),
                        contentDescription = null,
                        tint = Color(0xFF1F1F1F),
                        modifier = Modifier.size(14.dp)
                    )
                    Text(
                        title,
                        color = Color(0xFF1F1F1F),
                        fontSize = 14.sp,
                        letterSpacing = 3.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        textAlign = TextAlign.Center
                    )
                }
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .background(statusColor, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        painter = painterResource(statusIconRes(ok)),
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(48.dp)
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        message,
                        color = Color(0xFF1F1F1F),
                        fontSize = 14.sp,
                        letterSpacing = 2.sp,
                        lineHeight = 19.sp,
                        textAlign = TextAlign.Center,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                    detail?.takeIf { it.isNotBlank() }?.let {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            it,
                            color = Color(0xFF6F6F6F),
                            fontSize = 11.sp,
                            lineHeight = 15.sp,
                            textAlign = TextAlign.Center,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ConfigurationDetails(page: ConfigurationPageSpec, report: StatusReportPayload) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text("Configuration for this page:", color = Color(0xFF1F1F1F), fontSize = 14.sp, fontWeight = FontWeight.Bold)
        if (page.settings.isEmpty()) {
            AssistChip(
                onClick = {},
                label = { Text("No supplied configuration details") },
                shape = CircleShape,
                colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFEDEDED)),
                border = null
            )
        } else {
            page.settings.forEach { setting ->
                ConfigurationChoiceRow(setting)
            }
        }
        report.squareKds.error?.let { error ->
            Text(error, color = Color(0xFF9A620B), fontSize = 12.sp)
        }
    }
}

@Composable
private fun ConfigurationChoiceRow(setting: ExpectedSetting) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(setting.setting, color = Color(0xFF3C4043), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            val options = optionsForSetting(setting)
            if (options.isEmpty()) {
                AssistChip(
                    onClick = {},
                    label = { Text(setting.expected) },
                    shape = CircleShape,
                    colors = AssistChipDefaults.assistChipColors(containerColor = Color(0xFFEDEDED)),
                    border = null
                )
            } else {
                options.forEach { option ->
                    val selected = isOptionSelected(option, setting.expected)
                    FilterChip(
                        selected = selected,
                        onClick = {},
                        label = { Text(option, fontWeight = FontWeight.SemiBold) },
                        shape = CircleShape,
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = Color(0xFF222222),
                            selectedLabelColor = Color.White,
                            containerColor = Color(0xFFEDEDED),
                            labelColor = Color(0xFF6F6F6F)
                        ),
                        border = null
                    )
                }
            }
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

private data class ConfigurationPageSpec(
    val title: String,
    val imageRes: Int,
    val aspectRatio: Float,
    val settings: List<ExpectedSetting>
)

private fun buildConfigurationPages(config: DeviceConfigResponse): List<ConfigurationPageSpec> {
    val settings = config.expectedSettings
    val generalSettings = settings.settingsForKeywords("general", "display")
        .ifEmpty {
            listOf(
                ExpectedSetting("General", "Display name", config.displayName),
                ExpectedSetting("General", "Display type", displayTypeForRole(config.role))
            )
        }

    return listOf(
        ConfigurationPageSpec(
            title = "General",
            imageRes = R.drawable.kds_settings_general,
            aspectRatio = 2960f / 1848f,
            settings = generalSettings
        ),
        ConfigurationPageSpec(
            title = "Items & categories",
            imageRes = R.drawable.kds_settings_items_categories,
            aspectRatio = 2960f / 2256f,
            settings = settings.settingsForKeywords("item", "category", "categories")
        ),
        ConfigurationPageSpec(
            title = "Printers",
            imageRes = R.drawable.kds_settings_printers,
            aspectRatio = 2960f / 3436f,
            settings = settings.settingsForKeywords("printer").ifEmpty {
                config.printers.flatMap { printer ->
                    listOf(
                        ExpectedSetting("Printers", "${printer.name} IP", "${printer.host}:${printer.port}"),
                        ExpectedSetting("Printers", "${printer.name} MAC", printer.macAddress ?: "Unavailable")
                    )
                }
            }
        ),
        ConfigurationPageSpec(
            title = "Source & Fulfilment",
            imageRes = R.drawable.kds_settings_source_fulfilment,
            aspectRatio = 2960f / 2212f,
            settings = settings.settingsForKeywords("source", "fulfil", "fulfill")
        ),
        ConfigurationPageSpec(
            title = "Tickets",
            imageRes = R.drawable.kds_settings_tickets,
            aspectRatio = 2960f / 1848f,
            settings = settings.settingsForKeywords("ticket", "coursing", "timer", "alert")
        )
    )
}

private fun List<ExpectedSetting>.settingsForKeywords(vararg keywords: String): List<ExpectedSetting> =
    filter { setting ->
        val searchable = "${setting.section} ${setting.setting}".lowercase()
        keywords.any { keyword -> searchable.contains(keyword.lowercase()) }
    }

private fun displayTypeForRole(role: String): String =
    if (role.contains("prep", ignoreCase = true)) "Prep" else "Expeditor"

private fun optionsForSetting(setting: ExpectedSetting): List<String> {
    val settingName = setting.setting.lowercase()
    val expected = setting.expected.trim()

    return when {
        settingName.contains("display type") -> listOf("Expeditor", "Prep")
        expected.equals("on", ignoreCase = true) || expected.equals("off", ignoreCase = true) -> listOf("On", "Off")
        expected.equals("enabled", ignoreCase = true) || expected.equals("disabled", ignoreCase = true) -> {
            listOf("Enabled", "Disabled")
        }
        expected.equals("yes", ignoreCase = true) || expected.equals("no", ignoreCase = true) -> listOf("Yes", "No")
        expected.contains(",") -> expected.split(",").map { item -> item.trim() }.filter { item -> item.isNotBlank() }
        else -> emptyList()
    }
}

private fun isOptionSelected(option: String, expected: String): Boolean {
    val expectedOptions = expected.split(",").map { item -> item.trim() }
    return expectedOptions.any { item -> item.equals(option, ignoreCase = true) }
}

private fun squareKdsVersionPill(report: StatusReportPayload): String {
    val installedVersion = report.squareKds.installedVersion ?: "Unknown"
    val versionSuffix = when (report.squareKds.versionStatus) {
        "match" -> "latest version"
        "mismatch" -> "update available"
        "not_installed" -> "not visible"
        else -> "check version"
    }

    return "$installedVersion $versionSuffix"
}

@DrawableRes
private fun statusIconRes(ok: Boolean?): Int =
    when (ok) {
        true -> R.drawable.fa_check
        false -> R.drawable.fa_xmark
        null -> R.drawable.fa_question
    }

private fun printerConnectivityMessage(printer: PrinterCheckPayload?): String =
    when {
        printer == null -> "NO PRINTER IS CONFIGURED\nFOR THIS SCREEN"
        printer.ok -> "THIS SCREEN CAN REACH\nTHE PRINTER"
        else -> "THIS SCREEN CANNOT REACH\nTHE PRINTER"
    }

private fun printerConnectivityDetail(printer: PrinterCheckPayload?): String? =
    printer?.let {
        val printerIdentity = "MAC ${it.macAddress ?: "unavailable"}  IP ${it.host}"
        if (it.ok) printerIdentity else listOfNotNull(printerIdentity, it.error).joinToString("\n")
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
        ExpectedSetting("General", "Display type", "Expeditor"),
        ExpectedSetting("Kitchen Routing", "Routing mode", "Expo controls entire order"),
        ExpectedSetting("Kitchen Routing", "Station filter", "All items"),
        ExpectedSetting("Sources", "Accepted sources", "POS, Online, Delivery"),
        ExpectedSetting("Sources", "Order visibility", "All open tickets"),
        ExpectedSetting("Tickets", "No open tickets", "Enabled")
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
