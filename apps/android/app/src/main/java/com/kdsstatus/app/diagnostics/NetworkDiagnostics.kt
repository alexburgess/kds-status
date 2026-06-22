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
import java.io.File
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket
import java.util.Locale
import kotlin.math.roundToInt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext

class NetworkDiagnostics(private val context: Context) {
    fun readLocalMacAddress(): String? = readNetworkState().localMacAddress

    suspend fun run(config: DeviceConfigResponse): StatusReportPayload = coroutineScope {
        val networkState = readNetworkState()
        val internet = async { checkInternet() }
        val printers = config.printers.map { printer -> async { checkPrinter(printer) } }
        val squareKds = readSquareKds(config)

        StatusReportPayload(
            localIp = networkState.localIp,
            localMacAddress = networkState.localMacAddress,
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
            localMacAddress = null,
            transport = "offline",
            diagnostics = listOf("No active network")
        )

        val capabilities = manager.getNetworkCapabilities(activeNetwork)
        val linkProperties = manager.getLinkProperties(activeNetwork)
        val interfaceName = linkProperties?.interfaceName
        val localIp = linkProperties
            ?.linkAddresses
            ?.map { it.address }
            ?.firstOrNull { address -> !address.isLoopbackAddress && address is Inet4Address }
            ?.hostAddress
        val localMacAddress = interfaceName?.let(::readInterfaceMacAddress)

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
            if (localMacAddress == null) add("MAC address is unavailable on this Android build or network interface")
            if (capabilities == null) add("No network capabilities available")
        }

        return NetworkState(
            localIp = localIp,
            localMacAddress = localMacAddress,
            transport = transport,
            diagnostics = diagnostics
        )
    }

    private suspend fun checkInternet(): InternetCheckPayload = withContext(Dispatchers.IO) {
        val result = checkSocket(host = "clients3.google.com", port = 443, timeoutMs = 2500)
        InternetCheckPayload(ok = result.ok, latencyMs = result.latencyMs, error = result.error)
    }

    private suspend fun checkPrinter(printer: PrinterTarget): PrinterCheckPayload = withContext(Dispatchers.IO) {
        val port = if (printer.port in 1..65535) printer.port else 9100
        val result = checkSocket(printer.host, port, timeoutMs = 2500)
        val macAddress = printer.macAddress ?: readArpMacAddress(printer.host)

        PrinterCheckPayload(
            printerId = printer.id,
            name = printer.name,
            host = printer.host,
            port = port,
            macAddress = macAddress,
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
        val availableVersion = config.squareKds.availableVersion ?: config.squareKds.expectedVersion
        val lookupError = config.squareKds.versionLookupError

        if (packageName.isNullOrBlank()) {
            return SquareKdsCheckPayload(
                packageName = null,
                availableVersion = availableVersion,
                expectedVersion = availableVersion,
                versionStatus = "not_configured",
                error = lookupError
            )
        }

        return try {
            @Suppress("DEPRECATION")
            val packageInfo = context.packageManager.getPackageInfo(packageName, 0)
            val installedVersion = packageInfo.versionName
            val status = when {
                availableVersion.isNullOrBlank() -> "unknown"
                installedVersion == availableVersion -> "match"
                else -> "mismatch"
            }

            SquareKdsCheckPayload(
                packageName = packageName,
                installedVersion = installedVersion,
                availableVersion = availableVersion,
                expectedVersion = availableVersion,
                versionStatus = status,
                error = if (status == "unknown") lookupError ?: "Play Store version was not available" else lookupError
            )
        } catch (notFound: PackageManager.NameNotFoundException) {
            SquareKdsCheckPayload(
                packageName = packageName,
                availableVersion = availableVersion,
                expectedVersion = availableVersion,
                versionStatus = "not_installed",
                error = "Package is not installed or is not visible to this app"
            )
        } catch (error: SecurityException) {
            SquareKdsCheckPayload(
                packageName = packageName,
                availableVersion = availableVersion,
                expectedVersion = availableVersion,
                versionStatus = "unknown",
                error = error.message ?: lookupError ?: "Package visibility denied"
            )
        }
    }

    private fun elapsedMs(startNanos: Long): Int =
        ((System.nanoTime() - startNanos) / 1_000_000.0).roundToInt()

    private fun readInterfaceMacAddress(interfaceName: String): String? =
        runCatching {
            NetworkInterface.getByName(interfaceName)
                ?.hardwareAddress
                ?.takeIf { bytes -> bytes.isNotEmpty() }
                ?.joinToString(":") { byte -> "%02x".format(byte) }
                ?.takeUnless { mac -> mac == "02:00:00:00:00:00" }
        }.getOrNull()

    private fun readArpMacAddress(host: String): String? =
        runCatching {
            File("/proc/net/arp")
                .takeIf { it.canRead() }
                ?.readLines()
                ?.asSequence()
                ?.drop(1)
                ?.map { line -> line.trim().split(Regex("\\s+")) }
                ?.firstOrNull { fields -> fields.size >= 4 && fields[0] == host }
                ?.get(3)
                ?.lowercase(Locale.US)
                ?.takeIf { mac -> mac.matches(Regex("([0-9a-f]{2}:){5}[0-9a-f]{2}")) }
                ?.takeUnless { mac -> mac == "00:00:00:00:00:00" }
        }.getOrNull()
}

private data class NetworkState(
    val localIp: String?,
    val localMacAddress: String?,
    val transport: String,
    val diagnostics: List<String>
)

private data class SocketCheckResult(
    val ok: Boolean,
    val latencyMs: Int?,
    val error: String?
)
