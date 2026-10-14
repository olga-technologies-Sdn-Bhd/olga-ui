package com.olgamobile.ble

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.LocationManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import java.security.SecureRandom

/**
 * Bluetooth proximity discovery, phase 1. While started, the phone advertises
 * the Ol-ga service UUID and scans for other phones advertising it.
 *
 * What goes over the air, and nothing else:
 *  - advertising packet: the 128-bit service UUID;
 *  - scan response: service data for that UUID, an 8-byte random session token.
 * No name, member ID or account detail is sent, the phone's Bluetooth name is
 * left out, and the token is new every time discovery starts.
 *
 * iOS can't advertise service data, so an iPhone puts the same token in the
 * advertised local name as 16 hex characters; scans here accept either.
 *
 * Phones also connect briefly (OlgaGatt) to read each other's card and to
 * deliver Nearby messages, and post local notifications (OlgaNotifier).
 *
 * Foreground only: JS calls stop() when the app leaves the foreground. All
 * state is touched on the main thread.
 */
class OlgaBleModule(private val context: ReactApplicationContext) : NativeOlgaBleSpec(context) {

  companion object {
    const val NAME = NativeOlgaBleSpec.NAME
    private const val TAG = "OlgaBle"
    private const val TOKEN_BYTES = 8
    private val TOKEN_HEX = Regex("^[0-9a-f]{16}$")
    // Send each device to JS at most this often (RSSI updates arrive many times a second).
    private const val SIGHTING_INTERVAL_MS = 1000L
  }

  private val main = Handler(Looper.getMainLooper())
  private val random = SecureRandom()
  private val adapter: BluetoothAdapter? =
    (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

  private var serviceUuid: ParcelUuid? = null
  private var token: ByteArray? = null
  private var tokenHex = ""
  private var advertising = false
  private var advertiseRequested = false
  private var scanning = false
  private var error = ""
  private var receiverRegistered = false
  private val lastSent = HashMap<String, Long>()
  // The device last seen advertising each token, to connect to it.
  private val devices = HashMap<String, BluetoothDevice>()
  private val gatt = OlgaGatt(context, main) { payload ->
    emit { emitOnMessage(Arguments.createMap().apply { putString("payload", payload) }) }
  }
  private val notifier = OlgaNotifier(context)

  // A tap on one of our notifications while Ol-ga is running arrives as a new intent.
  private val openedListener =
    object : BaseActivityEventListener() {
      override fun onNewIntent(intent: Intent) {
        val id = intent.getStringExtra(OlgaNotifier.EXTRA_NOTIFICATION_ID) ?: return
        intent.removeExtra(OlgaNotifier.EXTRA_NOTIFICATION_ID)
        context.currentActivity?.intent?.removeExtra(OlgaNotifier.EXTRA_NOTIFICATION_ID)
        emit { emitOnNotificationOpened(Arguments.createMap().apply { putString("id", id) }) }
      }
    }

  init {
    context.addActivityEventListener(openedListener)
  }

  override fun getName() = NAME

  override fun start(serviceUuid: String) {
    main.post { startOnMain(serviceUuid) }
  }

  override fun stop() {
    main.post { stopOnMain() }
  }

  override fun getStatus(promise: Promise) {
    main.post { promise.resolve(statusMap()) }
  }

  override fun setCard(card: String) {
    gatt.setCard(card)
  }

  override fun readCard(token: String, promise: Promise) {
    main.post {
      val device = devices[token] ?: return@post promise.reject("NOT_NEARBY", "That phone isn't nearby")
      gatt.readCard(device, result(promise))
    }
  }

  override fun sendMessage(token: String, payload: String, promise: Promise) {
    main.post {
      val device = devices[token] ?: return@post promise.reject("NOT_NEARBY", "That phone isn't nearby")
      gatt.send(device, payload, result(promise))
    }
  }

  override fun showNotification(id: String, title: String, body: String, initials: String, color: String) {
    main.post { notifier.show(id, title, body, initials, color) }
  }

  override fun requestNotificationPermission(promise: Promise) {
    // Android 13+ asks at runtime from JS (POST_NOTIFICATIONS); this answers.
    promise.resolve(notifier.canNotify())
  }

  override fun consumeOpenedNotification(promise: Promise) {
    // Cold start: the launch intent still carries the id.
    val intent = context.currentActivity?.intent
    val id = intent?.getStringExtra(OlgaNotifier.EXTRA_NOTIFICATION_ID) ?: ""
    intent?.removeExtra(OlgaNotifier.EXTRA_NOTIFICATION_ID)
    promise.resolve(id)
  }

  private fun result(promise: Promise) =
    object : OlgaGatt.Result {
      override fun ok(value: String?) = promise.resolve(value)
      override fun error(message: String) = promise.reject("BLE_FAILED", message)
    }

  override fun invalidate() {
    context.removeActivityEventListener(openedListener)
    main.post { stopOnMain() }
    super.invalidate()
  }

  private fun startOnMain(uuid: String) {
    if (token != null) return // already running: never two scans or two advertisements
    val parsed =
      try {
        ParcelUuid.fromString(uuid)
      } catch (e: IllegalArgumentException) {
        error = "Invalid service UUID"
        emitStatus()
        return
      }
    serviceUuid = parsed
    token = ByteArray(TOKEN_BYTES).also { random.nextBytes(it) }
    tokenHex = token!!.toHex()
    error = ""
    if (!receiverRegistered) {
      ContextCompat.registerReceiver(
        context,
        stateReceiver,
        IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED),
        ContextCompat.RECEIVER_NOT_EXPORTED,
      )
      receiverRegistered = true
    }
    begin()
  }

  private fun stopOnMain() {
    if (receiverRegistered) {
      try {
        context.unregisterReceiver(stateReceiver)
      } catch (e: IllegalArgumentException) {
        // already gone
      }
      receiverRegistered = false
    }
    halt()
    gatt.close()
    devices.clear()
    token = null
    tokenHex = ""
    serviceUuid = null
    error = ""
    lastSent.clear()
    emitStatus()
  }

  /** Starts advertising and scanning if Bluetooth allows it right now. */
  private fun begin() {
    val bt = adapter
    if (bt == null || !bt.isEnabled || !hasPermissions()) {
      emitStatus()
      return
    }
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S && !locationOn()) {
      error = "Location is off. Android 11 and older only report Bluetooth devices with Location on."
    }
    if (!gatt.open(serviceUuid!!.uuid)) error = "Couldn't open the Nearby service"
    startAdvertising(bt)
    startScanning(bt)
    emitStatus()
  }

  /** Stops both; safe to call when Bluetooth is already off. */
  private fun halt() {
    val bt = adapter
    try {
      if (scanning) bt?.bluetoothLeScanner?.stopScan(scanCallback)
    } catch (e: Exception) {
      Log.w(TAG, "stopScan failed: ${e.message}")
    }
    try {
      if (advertiseRequested) bt?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
    } catch (e: Exception) {
      Log.w(TAG, "stopAdvertising failed: ${e.message}")
    }
    scanning = false
    advertising = false
    advertiseRequested = false
  }

  private fun startAdvertising(bt: BluetoothAdapter) {
    if (advertiseRequested) return
    val uuid = serviceUuid ?: return
    val advertiser = bt.bluetoothLeAdvertiser
    if (advertiser == null || !bt.isMultipleAdvertisementSupported) {
      error = "This phone can't advertise over Bluetooth LE; it can still find others."
      return
    }
    val settings =
      AdvertiseSettings.Builder()
        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_BALANCED)
        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
        .setConnectable(true) // others connect to read the card and deliver messages
        .setTimeout(0)
        .build()
    // 3 (flags) + 18 (128-bit UUID) bytes; the token goes in the scan
    // response: 2 + 16 + 8 = 26 of 31 bytes.
    val data = AdvertiseData.Builder().addServiceUuid(uuid).setIncludeDeviceName(false).setIncludeTxPowerLevel(false).build()
    val response =
      AdvertiseData.Builder().addServiceData(uuid, token).setIncludeDeviceName(false).setIncludeTxPowerLevel(false).build()
    try {
      advertiser.startAdvertising(settings, data, response, advertiseCallback)
      advertiseRequested = true
    } catch (e: SecurityException) {
      error = "Bluetooth advertise permission missing"
    } catch (e: Exception) {
      error = "Advertising failed: ${e.message}"
    }
  }

  private fun startScanning(bt: BluetoothAdapter) {
    if (scanning) return
    val uuid = serviceUuid ?: return
    val scanner = bt.bluetoothLeScanner
    if (scanner == null) {
      error = "Bluetooth LE scanning isn't available"
      return
    }
    val filters = listOf(ScanFilter.Builder().setServiceUuid(uuid).build())
    // Low latency: balanced mode let 10 s or more pass between sightings of a
    // phone right next to this one. It only runs while the app is open and
    // the member is live.
    val settings =
      ScanSettings.Builder()
        .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
        .setCallbackType(ScanSettings.CALLBACK_TYPE_ALL_MATCHES)
        .setReportDelay(0)
        .build()
    try {
      scanner.startScan(filters, settings, scanCallback)
      scanning = true
    } catch (e: SecurityException) {
      error = "Bluetooth scan permission missing"
    } catch (e: Exception) {
      error = "Scanning failed: ${e.message}"
    }
  }

  private val advertiseCallback =
    object : AdvertiseCallback() {
      override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
        main.post {
          if (!advertiseRequested) return@post
          advertising = true
          emitStatus()
        }
      }

      override fun onStartFailure(errorCode: Int) {
        main.post {
          if (errorCode == ADVERTISE_FAILED_ALREADY_STARTED) {
            advertising = true
          } else {
            advertiseRequested = false
            advertising = false
            error = "Advertising failed: ${advertiseError(errorCode)}"
          }
          emitStatus()
        }
      }
    }

  private val scanCallback =
    object : ScanCallback() {
      override fun onScanResult(callbackType: Int, result: ScanResult) {
        main.post { onSighting(result) }
      }

      override fun onBatchScanResults(results: MutableList<ScanResult>) {
        main.post { results.forEach { onSighting(it) } }
      }

      override fun onScanFailed(errorCode: Int) {
        main.post {
          scanning = false
          error = "Scanning failed (code $errorCode)"
          emitStatus()
        }
      }
    }

  private fun onSighting(result: ScanResult) {
    val uuid = serviceUuid ?: return
    val record = result.scanRecord ?: return
    // Android phones send the token as service data; iPhones as the local name.
    val other =
      record.getServiceData(uuid)?.takeIf { it.size == TOKEN_BYTES }?.toHex()
        ?: record.deviceName?.lowercase()?.takeIf { TOKEN_HEX.matches(it) }
        ?: return // the scan response hasn't arrived yet; the next result will carry it
    if (other == tokenHex) return
    devices[other] = result.device
    val now = System.currentTimeMillis()
    if (now - (lastSent[other] ?: 0L) < SIGHTING_INTERVAL_MS) return
    lastSent[other] = now
    emit {
      emitOnSighting(
        Arguments.createMap().apply {
          putString("token", other)
          putInt("rssi", result.rssi)
          putDouble("seenAt", now.toDouble())
        }
      )
    }
  }

  private val stateReceiver =
    object : BroadcastReceiver() {
      override fun onReceive(c: Context, intent: Intent) {
        val state = intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)
        main.post {
          if (token == null) return@post
          when (state) {
            BluetoothAdapter.STATE_ON -> {
              error = ""
              begin()
            }
            BluetoothAdapter.STATE_TURNING_OFF, BluetoothAdapter.STATE_OFF -> {
              halt()
              gatt.close() // reopened by begin() when Bluetooth is back
              devices.clear()
              lastSent.clear()
              emitStatus()
            }
          }
        }
      }
    }

  private fun hasPermissions(): Boolean {
    val needed =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT)
      } else {
        listOf(Manifest.permission.ACCESS_FINE_LOCATION)
      }
    return needed.all { ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED }
  }

  private fun locationOn(): Boolean {
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return true
    return LocationManagerCompat.isLocationEnabled(manager)
  }

  private fun bluetoothState(): String {
    val bt = adapter ?: return "unsupported"
    if (!context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE)) return "unsupported"
    if (!hasPermissions()) return "unauthorized"
    return if (bt.isEnabled) "on" else "off"
  }

  private fun statusMap(): WritableMap =
    Arguments.createMap().apply {
      putString("bluetooth", bluetoothState())
      putBoolean("advertising", advertising)
      putBoolean("scanning", scanning)
      putString("error", error)
      putString("token", tokenHex)
    }

  private fun emitStatus() {
    val status = statusMap()
    emit { emitOnStatus(status) }
  }

  // The emitter isn't wired up until JS subscribes; nothing is lost because
  // JS reads getStatus() after start().
  private fun emit(send: () -> Unit) {
    try {
      send()
    } catch (e: Exception) {
      Log.w(TAG, "event not delivered: ${e.message}")
    }
  }

  private fun advertiseError(code: Int) =
    when (code) {
      AdvertiseCallback.ADVERTISE_FAILED_DATA_TOO_LARGE -> "data too large"
      AdvertiseCallback.ADVERTISE_FAILED_TOO_MANY_ADVERTISERS -> "too many advertisers"
      AdvertiseCallback.ADVERTISE_FAILED_INTERNAL_ERROR -> "internal error"
      AdvertiseCallback.ADVERTISE_FAILED_FEATURE_UNSUPPORTED -> "not supported"
      else -> "code $code"
    }

  private fun ByteArray.toHex() = joinToString("") { "%02x".format(it) }
}
