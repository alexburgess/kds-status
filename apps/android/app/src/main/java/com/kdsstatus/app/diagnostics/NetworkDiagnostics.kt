package com.kdsstatus.app.diagnostics

import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiInfo
import android.net.wifi.WifiManager
import android.provider.Settings
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

    fun readDeviceIdentity(): DeviceIdentity {
        val macAddress = readLocalMacAddress()
        if (!macAddress.isNullOrBlank()) {
            return DeviceIdentity(
                macAddress = macAddress,
                deviceId = null,
                setupHint = null
            )
        }

        val androidDeviceId = readAndroidDeviceId()
        if (!androidDeviceId.isNullOrBlank()) {
            return DeviceIdentity(
                macAddress = null,
                deviceId = androidDeviceId,
                setupHint = "Android did not expose a device MAC address. Add \"deviceId\": \"$androidDeviceId\" to this screen's JSON definition in the dashboard."
            )
        }

        return DeviceIdentity(
            macAddress = null,
            deviceId = null,
            setupHint = "Android did not expose a device MAC address or fallback Android device ID."
        )
    }

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
        val localMacAddress = readBestLocalMacAddress(interfaceName, capabilities)

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
            if (localMacAddress == null) add("Device MAC address is unavailable from active, Wi-Fi, Ethernet, network capabilities, and known network interfaces")
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

    private fun readBestLocalMacAddress(activeInterfaceName: String?, capabilities: NetworkCapabilities?): String? {
        val candidateInterfaceNames = buildList {
            activeInterfaceName?.let(::add)
            add("eth0")
            add("wlan0")
            add("en0")
        }.distinct()

        candidateInterfaceNames.firstNotNullOfOrNull(::readInterfaceMacAddress)?.let { macAddress ->
            return macAddress
        }

        readNetworkCapabilitiesWifiMacAddress(capabilities)?.let { macAddress ->
            return macAddress
        }

        readWifiManagerMacAddress()?.let { macAddress ->
            return macAddress
        }

        return readEnumeratedInterfaceMacAddress(candidateInterfaceNames)
    }

    private fun readInterfaceMacAddress(interfaceName: String): String? =
        readNetworkInterfaceMacAddress(interfaceName) ?: readSysfsInterfaceMacAddress(interfaceName)

    private fun readNetworkInterfaceMacAddress(interfaceName: String): String? =
        runCatching {
            NetworkInterface.getByName(interfaceName)
                ?.hardwareAddress
                ?.takeIf { bytes -> bytes.isNotEmpty() }
                ?.toMacAddress()
                ?.takeIf(::isUsableMacAddress)
        }.getOrNull()

    private fun readSysfsInterfaceMacAddress(interfaceName: String): String? =
        runCatching {
            File("/sys/class/net/$interfaceName/address")
                .takeIf { file -> file.canRead() }
                ?.readText()
                ?.trim()
                ?.normalizeMacAddress()
                ?.takeIf(::isUsableMacAddress)
        }.getOrNull()

    private fun readWifiManagerMacAddress(): String? =
        runCatching {
            val wifiManager = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
            @Suppress("DEPRECATION")
            wifiManager
                ?.connectionInfo
                ?.macAddress
                ?.normalizeMacAddress()
                ?.takeIf(::isUsableMacAddress)
        }.getOrNull()

    private fun readNetworkCapabilitiesWifiMacAddress(capabilities: NetworkCapabilities?): String? =
        runCatching {
            (capabilities?.transportInfo as? WifiInfo)
                ?.macAddress
                ?.normalizeMacAddress()
                ?.takeIf(::isUsableMacAddress)
        }.getOrNull()

    private fun readEnumeratedInterfaceMacAddress(preferredNames: List<String>): String? =
        runCatching {
            NetworkInterface.getNetworkInterfaces()
                .toList()
                .sortedWith(compareBy<NetworkInterface> { networkInterface ->
                    val preferredIndex = preferredNames.indexOf(networkInterface.name)
                    if (preferredIndex == -1) Int.MAX_VALUE else preferredIndex
                }.thenBy { networkInterface -> networkInterface.name })
                .asSequence()
                .filter { networkInterface -> networkInterface.name != "lo" }
                .mapNotNull { networkInterface -> networkInterface.hardwareAddress?.takeIf { bytes -> bytes.isNotEmpty() }?.toMacAddress() }
                .firstOrNull(::isUsableMacAddress)
        }.getOrNull()

    private fun readAndroidDeviceId(): String? =
        runCatching {
            Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
                ?.trim()
                ?.lowercase(Locale.US)
                ?.takeIf { androidId -> androidId.isNotBlank() && androidId != "9774d56d682e549c" }
                ?.takeIf { androidId -> androidId.matches(Regex("[a-z0-9]+")) }
                ?.let { androidId -> "android-$androidId" }
        }.getOrNull()

    private fun ByteArray.toMacAddress(): String =
        joinToString(":") { byte -> "%02x".format(byte) }

    private fun String.normalizeMacAddress(): String =
        trim().lowercase(Locale.US).replace("-", ":")

    private fun isUsableMacAddress(macAddress: String): Boolean =
        macAddress.matches(Regex("([0-9a-f]{2}:){5}[0-9a-f]{2}")) &&
            macAddress != "02:00:00:00:00:00" &&
            macAddress != "00:00:00:00:00:00" &&
            macAddress != "ff:ff:ff:ff:ff:ff"

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

data class DeviceIdentity(
    val macAddress: String?,
    val deviceId: String?,
    val setupHint: String?
)

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
