package com.kdsstatus.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kdsstatus.app.data.AppConfig
import com.kdsstatus.app.data.DeviceConfigResponse
import com.kdsstatus.app.data.ManagedConfigRepository
import com.kdsstatus.app.data.StatusReportPayload
import com.kdsstatus.app.diagnostics.NetworkDiagnostics
import com.kdsstatus.app.network.DeviceApiClient
import com.kdsstatus.app.ui.StatusFormatter

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val configRepository = ManagedConfigRepository(this)
        val diagnostics = NetworkDiagnostics(this)

        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFF6F8FB)) {
                    KdsStatusApp(
                        readConfig = configRepository::readConfig,
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
    diagnostics: NetworkDiagnostics
) {
    var state by remember { mutableStateOf<ScreenState>(ScreenState.Loading) }

    suspend fun refresh() {
        val appConfig = readConfig()
        if (!appConfig.isComplete) {
            state = ScreenState.MissingConfig(appConfig)
            return
        }

        val api = DeviceApiClient(appConfig)
        val remoteConfig = api.fetchConfig().getOrElse { error ->
            state = ScreenState.Error("Could not fetch device config: ${error.message.orEmpty()}")
            return
        }

        val report = diagnostics.run(remoteConfig)
        val postError = api.postStatus(report).exceptionOrNull()

        state = ScreenState.Ready(
            appConfig = appConfig,
            remoteConfig = remoteConfig,
            report = report,
            postError = postError?.message
        )
    }

    LaunchedEffect(Unit) {
        refresh()
    }

    StatusContent(
        state = state,
        onRefresh = {
            state = ScreenState.Loading
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
    onRefresh: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(22.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("KDS Status", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = Color(0xFF14202B))

        when (state) {
            ScreenState.Loading -> LoadingCard()
            is ScreenState.MissingConfig -> MissingConfigCard(state.config)
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
private fun MissingConfigCard(config: AppConfig) {
    StatusCard {
        Text("Setup required", fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(StatusFormatter.missingConfigMessage(config.missingKeys), color = Color(0xFFB42318))
        Spacer(Modifier.height(8.dp))
        Text("Set device_id, device_secret, and api_base_url in Miradore managed app configuration.")
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
    HeaderCard(state.remoteConfig, state.report, state.postError)
    NetworkCard(state.report)
    PrinterCard(state.report)
    SquareKdsCard(state.report)
    ExpectedSetupCard(state.remoteConfig)

    Button(
        onClick = onRefresh,
        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F6D7A)),
        modifier = Modifier.fillMaxWidth()
    ) {
        Text("Run diagnostics again")
    }
}

@Composable
private fun HeaderCard(config: DeviceConfigResponse, report: StatusReportPayload, postError: String?) {
    StatusCard {
        Text(config.displayName, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text("${config.locationName} · ${config.role}", color = Color(0xFF5F6F7E))
        Spacer(Modifier.height(12.dp))
        StatusRow("Report", if (postError == null) "Uploaded" else "Upload failed: $postError")
        StatusRow("App version", report.appVersion)
        if (config.notes.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(config.notes, color = Color(0xFF263847))
        }
    }
}

@Composable
private fun NetworkCard(report: StatusReportPayload) {
    StatusCard {
        SectionTitle("Network")
        StatusRow("Local IP", report.localIp ?: "Unknown")
        StatusRow("Connection", StatusFormatter.transportLabel(report.activeTransport))
        StatusRow(
            label = "Internet",
            value = if (report.internet.ok) "Reachable (${report.internet.latencyMs ?: 0} ms)"
            else report.internet.error ?: "Failed"
        )
        report.diagnostics.forEach { diagnostic ->
            Text(diagnostic, color = Color(0xFF9A620B), fontSize = 13.sp)
        }
    }
}

@Composable
private fun PrinterCard(report: StatusReportPayload) {
    StatusCard {
        SectionTitle("Printers")
        if (report.printerChecks.isEmpty()) {
            Text("No printer expected for this screen.", color = Color(0xFF5F6F7E))
        } else {
            report.printerChecks.forEach { printer ->
                StatusRow(
                    label = printer.name,
                    value = if (printer.ok) "${printer.host}:${printer.port} reachable"
                    else "${printer.host}:${printer.port} ${printer.error ?: "failed"}"
                )
            }
        }
    }
}

@Composable
private fun SquareKdsCard(report: StatusReportPayload) {
    StatusCard {
        SectionTitle("Square KDS")
        StatusRow(
            label = "Version",
            value = StatusFormatter.squareKdsLabel(
                report.squareKds.versionStatus,
                report.squareKds.installedVersion
            )
        )
        report.squareKds.error?.let { error ->
            Text(error, color = Color(0xFF9A620B), fontSize = 13.sp)
        }
    }
}

@Composable
private fun ExpectedSetupCard(config: DeviceConfigResponse) {
    StatusCard {
        SectionTitle("Expected Setup")
        config.expectedSettings.forEach { item ->
            StatusRow(label = "${item.section}: ${item.setting}", value = item.expected)
        }
    }
}

@Composable
private fun StatusCard(content: @Composable ColumnScope.() -> Unit) {
    Card(
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
            content = content
        )
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color(0xFF14202B))
    Spacer(Modifier.height(4.dp))
}

@Composable
private fun StatusRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF7FAFC), RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 9.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = Color(0xFF5F6F7E), fontSize = 13.sp, modifier = Modifier.weight(1f))
        Text(value, color = Color(0xFF14202B), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
    }
}

private sealed interface ScreenState {
    data object Loading : ScreenState
    data class MissingConfig(val config: AppConfig) : ScreenState
    data class Error(val message: String) : ScreenState
    data class Ready(
        val appConfig: AppConfig,
        val remoteConfig: DeviceConfigResponse,
        val report: StatusReportPayload,
        val postError: String?
    ) : ScreenState
}
