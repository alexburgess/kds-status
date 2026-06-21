package com.kdsstatus.app.diagnostics

import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.kdsstatus.app.BuildConfig
import com.kdsstatus.app.data.DeviceConfigResponse
import com.kdsstatus.app.data.InternetCheckPayload
import com.kdsstatus.app.data.PrinterCheckPayload
import com.kdsstatus.app.data.PrinterTarget
import com.kdsstatus.app.data.SquareKdsCheckPayload
import com.kdsstatus.app.data.StatusReportPayload
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.math.roundToInt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext

class NetworkDiagnostics(private val context: Context) {
    suspend fun run(config: DeviceConfigResponse): StatusReportPayload = coroutineScope {
        val networkState = readNetworkState()
        val internet = async { checkInternet() }
        val printers = config.printers.map { printer -> async { checkPrinter(printer) } }
        val squareKds = readSquareKds(config)

        StatusReportPayload(
            localIp = networkState.localIp,
            activeTransport = networkState.transport,
            internet = internet.await(),
            printerChecks = printers.awaitAll(),
            squareKds = squareKds,
            appVersion = BuildConfig.VERSION_NAME,
            diagnostics = networkState.diagnostics
        )
    }

    private fun readNetworkState(): NetworkState {
        val manager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val activeNetwork = manager.activeNetwork ?: return NetworkState(
            localIp = null,
            transport = "offline",
            diagnostics = listOf("No active network")
        )

        val capabilities = manager.getNetworkCapabilities(activeNetwork)
        val linkProperties = manager.getLinkProperties(activeNetwork)
        val localIp = linkProperties
            ?.linkAddresses
            ?.map { it.address }
            ?.firstOrNull { address -> !address.isLoopbackAddress && address is Inet4Address }
            ?.hostAddress

        val transport = when {
            capabilities == null -> "unknown"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN) -> "vpn"
            else -> "unknown"
        }

        val diagnostics = buildList {
            if (localIp == null) add("No IPv4 address found on active network")
            if (capabilities == null) add("No network capabilities available")
        }

        return NetworkState(localIp = localIp, transport = transport, diagnostics = diagnostics)
    }

    private suspend fun checkInternet(): InternetCheckPayload = withContext(Dispatchers.IO) {
        val result = checkSocket(host = "clients3.google.com", port = 443, timeoutMs = 2500)
        InternetCheckPayload(ok = result.ok, latencyMs = result.latencyMs, error = result.error)
    }

    private suspend fun checkPrinter(printer: PrinterTarget): PrinterCheckPayload = withContext(Dispatchers.IO) {
        val port = if (printer.port in 1..65535) printer.port else 9100
        val result = checkSocket(printer.host, port, timeoutMs = 2500)

        PrinterCheckPayload(
            printerId = printer.id,
            name = printer.name,
            host = printer.host,
            port = port,
            ok = result.ok,
            latencyMs = result.latencyMs,
            error = result.error
        )
    }

    private fun checkSocket(host: String, port: Int, timeoutMs: Int): SocketCheckResult {
        val start = System.nanoTime()

        return try {
            Socket().use { socket ->
                socket.connect(InetSocketAddress(host, port), timeoutMs)
            }
            SocketCheckResult(ok = true, latencyMs = elapsedMs(start), error = null)
        } catch (error: Exception) {
            SocketCheckResult(ok = false, latencyMs = elapsedMs(start), error = error.message ?: error::class.java.simpleName)
        }
    }

    private fun readSquareKds(config: DeviceConfigResponse): SquareKdsCheckPayload {
        val packageName = config.squareKds.packageName
        val expectedVersion = config.squareKds.expectedVersion

        if (packageName.isNullOrBlank()) {
            return SquareKdsCheckPayload(
                packageName = null,
                expectedVersion = expectedVersion,
                versionStatus = "not_configured"
            )
        }

        return try {
            @Suppress("DEPRECATION")
            val packageInfo = context.packageManager.getPackageInfo(packageName, 0)
            val installedVersion = packageInfo.versionName
            val status = when {
                expectedVersion.isNullOrBlank() -> "unknown"
                installedVersion == expectedVersion -> "match"
                else -> "mismatch"
            }

            SquareKdsCheckPayload(
                packageName = packageName,
                installedVersion = installedVersion,
                expectedVersion = expectedVersion,
                versionStatus = status
            )
        } catch (notFound: PackageManager.NameNotFoundException) {
            SquareKdsCheckPayload(
                packageName = packageName,
                expectedVersion = expectedVersion,
                versionStatus = "not_installed",
                error = "Package is not installed or is not visible to this app"
            )
        } catch (error: SecurityException) {
            SquareKdsCheckPayload(
                packageName = packageName,
                expectedVersion = expectedVersion,
                versionStatus = "unknown",
                error = error.message ?: "Package visibility denied"
            )
        }
    }

    private fun elapsedMs(startNanos: Long): Int =
        ((System.nanoTime() - startNanos) / 1_000_000.0).roundToInt()
}

private data class NetworkState(
    val localIp: String?,
    val transport: String,
    val diagnostics: List<String>
)

private data class SocketCheckResult(
    val ok: Boolean,
    val latencyMs: Int?,
    val error: String?
)
