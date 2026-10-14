package com.olgamobile.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Build
import android.os.Handler
import android.util.Log
import java.util.UUID

/**
 * The connection half of Nearby discovery. Every phone serves one GATT service
 * (the Ol-ga service UUID) with two characteristics:
 *  - CARD, read: this phone's card (JSON, at most 512 bytes; long reads use offsets);
 *  - INBOX, write: messages from other phones, in frames of
 *    [message id, frame index, frame count, bytes...] so any size fits any MTU.
 * As a client it reads other phones' cards and writes to their inboxes, one
 * connection at a time, each with a timeout. Everything runs on [main].
 *
 * Permissions (BLUETOOTH_CONNECT on Android 12+) are checked by the caller.
 */
@SuppressLint("MissingPermission")
class OlgaGatt(
  private val context: Context,
  private val main: Handler,
  private val onMessage: (String) -> Unit,
) {
  companion object {
    private const val TAG = "OlgaGatt"
    val CARD_UUID: UUID = UUID.fromString("3eecebab-22bf-4234-bf1d-035cbe8539f5")
    val INBOX_UUID: UUID = UUID.fromString("3eecebab-22bf-4234-bf1d-035cbe8539f6")
    private const val OP_TIMEOUT_MS = 12000L
    private const val WANTED_MTU = 185
    private const val FRAME_HEADER = 3
    private const val MAX_FRAMES = 255
  }

  private val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
  private var server: BluetoothGattServer? = null
  private var serviceUuid: UUID? = null
  @Volatile private var card: ByteArray = ByteArray(0)
  private var nextMessageId = 0

  // ---- server ----

  fun setCard(json: String) {
    card = json.toByteArray(Charsets.UTF_8)
  }

  fun open(service: UUID): Boolean {
    if (server != null) return true
    serviceUuid = service
    val opened = try {
      manager.openGattServer(context, serverCallback)
    } catch (e: SecurityException) {
      Log.w(TAG, "openGattServer: ${e.message}")
      null
    } ?: return false
    val gattService = BluetoothGattService(service, BluetoothGattService.SERVICE_TYPE_PRIMARY)
    gattService.addCharacteristic(
      BluetoothGattCharacteristic(CARD_UUID, BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ)
    )
    gattService.addCharacteristic(
      BluetoothGattCharacteristic(INBOX_UUID, BluetoothGattCharacteristic.PROPERTY_WRITE, BluetoothGattCharacteristic.PERMISSION_WRITE)
    )
    opened.addService(gattService)
    server = opened
    return true
  }

  fun close() {
    try {
      server?.close()
    } catch (e: Exception) {
      Log.w(TAG, "close server: ${e.message}")
    }
    server = null
    partial.clear()
    queue.forEach { it.fail("Nearby stopped") }
    queue.clear()
    current?.finish("Nearby stopped")
  }

  // Frames being reassembled, by sender address and message id.
  private val partial = HashMap<String, Array<ByteArray?>>()

  private val serverCallback =
    object : BluetoothGattServerCallback() {
      override fun onCharacteristicReadRequest(device: BluetoothDevice, requestId: Int, offset: Int, characteristic: BluetoothGattCharacteristic) {
        val value = card
        val s = server ?: return
        if (characteristic.uuid != CARD_UUID || offset > value.size) {
          s.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, offset, null)
          return
        }
        s.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, value.copyOfRange(offset, value.size))
      }

      override fun onCharacteristicWriteRequest(
        device: BluetoothDevice,
        requestId: Int,
        characteristic: BluetoothGattCharacteristic,
        preparedWrite: Boolean,
        responseNeeded: Boolean,
        offset: Int,
        value: ByteArray?,
      ) {
        val ok = characteristic.uuid == INBOX_UUID && value != null && value.size >= FRAME_HEADER && !preparedWrite && offset == 0
        if (responseNeeded) server?.sendResponse(device, requestId, if (ok) BluetoothGatt.GATT_SUCCESS else BluetoothGatt.GATT_FAILURE, 0, null)
        if (!ok) return
        val bytes = value!!
        main.post { onFrame(device.address, bytes) }
      }
    }

  private fun onFrame(address: String, frame: ByteArray) {
    val id = frame[0].toInt() and 0xff
    val index = frame[1].toInt() and 0xff
    val count = frame[2].toInt() and 0xff
    if (count == 0 || index >= count) return
    val key = "$address/$id"
    var parts = partial[key]
    if (parts == null || parts.size != count) {
      parts = arrayOfNulls(count)
      partial[key] = parts
    }
    parts[index] = frame.copyOfRange(FRAME_HEADER, frame.size)
    if (parts.any { it == null }) return
    partial.remove(key)
    val whole = parts.fold(ByteArray(0)) { acc, part -> acc + part!! }
    onMessage(String(whole, Charsets.UTF_8))
  }

  // ---- client ----

  interface Result {
    fun ok(value: String?)
    fun error(message: String)
  }

  private val queue = ArrayDeque<Op>()
  private var current: Op? = null

  /** Reads the card of [device]. */
  fun readCard(device: BluetoothDevice, result: Result) = enqueue(Op(device, null, result))

  /** Writes [payload] to the inbox of [device]. */
  fun send(device: BluetoothDevice, payload: String, result: Result) = enqueue(Op(device, payload.toByteArray(Charsets.UTF_8), result))

  private fun enqueue(op: Op) {
    queue.addLast(op)
    pump()
  }

  private fun pump() {
    if (current != null) return
    val next = queue.removeFirstOrNull() ?: return
    current = next
    next.begin()
  }

  private inner class Op(val device: BluetoothDevice, val payload: ByteArray?, val result: Result) : BluetoothGattCallback() {
    private var gatt: BluetoothGatt? = null
    private var done = false
    private var frames: List<ByteArray> = emptyList()
    private var frameIndex = 0
    private val timeout = Runnable { finish("Timed out") }

    fun begin() {
      main.postDelayed(timeout, OP_TIMEOUT_MS)
      gatt =
        try {
          device.connectGatt(context, false, this, BluetoothDevice.TRANSPORT_LE)
        } catch (e: SecurityException) {
          null
        }
      if (gatt == null) finish("Couldn't connect")
    }

    fun fail(message: String) = result.error(message)

    /** Ends this operation: success when [error] is null. */
    fun finish(error: String?, value: String? = null) {
      if (done) return
      done = true
      main.removeCallbacks(timeout)
      try {
        gatt?.disconnect()
        gatt?.close()
      } catch (e: Exception) {
        Log.w(TAG, "close client: ${e.message}")
      }
      if (error == null) result.ok(value) else result.error(error)
      if (current === this) current = null
      main.post { pump() }
    }

    override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
      main.post {
        if (done) return@post
        if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
          if (!g.requestMtu(WANTED_MTU)) g.discoverServices()
        } else {
          finish("Disconnected ($status)")
        }
      }
    }

    override fun onMtuChanged(g: BluetoothGatt, mtu: Int, status: Int) {
      main.post {
        if (done) return@post
        val usable = if (status == BluetoothGatt.GATT_SUCCESS) mtu else 23
        frames = payload?.let { split(it, usable - 3 - FRAME_HEADER) } ?: emptyList()
        g.discoverServices()
      }
    }

    override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
      main.post {
        if (done) return@post
        val service = serviceUuid?.let { g.getService(it) }
        if (status != BluetoothGatt.GATT_SUCCESS || service == null) {
          finish("Ol-ga service not found")
          return@post
        }
        if (payload == null) {
          val c = service.getCharacteristic(CARD_UUID) ?: return@post finish("No card")
          if (!g.readCharacteristic(c)) finish("Couldn't read card")
        } else {
          if (frames.isEmpty()) frames = split(payload, 23 - 3 - FRAME_HEADER)
          if (frames.size > MAX_FRAMES) return@post finish("Message too long")
          frameIndex = 0
          writeNext(g, service)
        }
      }
    }

    private fun writeNext(g: BluetoothGatt, service: BluetoothGattService) {
      val c = service.getCharacteristic(INBOX_UUID) ?: return finish("No inbox")
      if (frameIndex >= frames.size) return finish(null)
      val frame = frames[frameIndex]
      val started =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          g.writeCharacteristic(c, frame, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothGatt.GATT_SUCCESS
        } else {
          @Suppress("DEPRECATION")
          c.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
          @Suppress("DEPRECATION")
          c.value = frame
          @Suppress("DEPRECATION")
          g.writeCharacteristic(c)
        }
      if (!started) finish("Couldn't write")
    }

    override fun onCharacteristicWrite(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      main.post {
        if (done) return@post
        if (status != BluetoothGatt.GATT_SUCCESS) return@post finish("Write failed ($status)")
        frameIndex++
        val service = serviceUuid?.let { g.getService(it) } ?: return@post finish("Ol-ga service lost")
        writeNext(g, service)
      }
    }

    // Android 13+ calls this one; older versions call the deprecated one below.
    override fun onCharacteristicRead(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
      main.post { onRead(value, status) }
    }

    @Deprecated("Below Android 13")
    override fun onCharacteristicRead(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
      @Suppress("DEPRECATION")
      val value = characteristic.value ?: ByteArray(0)
      main.post { onRead(value, status) }
    }

    private fun onRead(value: ByteArray, status: Int) {
      if (done) return
      if (status != BluetoothGatt.GATT_SUCCESS) return finish("Read failed ($status)")
      finish(null, String(value, Charsets.UTF_8))
    }

    private fun split(bytes: ByteArray, size: Int): List<ByteArray> {
      val chunk = size.coerceAtLeast(1)
      val count = ((bytes.size + chunk - 1) / chunk).coerceAtLeast(1)
      val id = (nextMessageId++ and 0xff).toByte()
      return (0 until count).map { i ->
        val part = bytes.copyOfRange(i * chunk, minOf(bytes.size, (i + 1) * chunk))
        byteArrayOf(id, i.toByte(), count.toByte()) + part
      }
    }
  }
}
