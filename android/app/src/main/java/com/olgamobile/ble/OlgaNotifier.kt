package com.olgamobile.ble

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/**
 * Local notifications for Nearby (a Commit from someone close by, an accept).
 * They need no internet. The avatar is the person's initials on their pastel
 * colour, as on the Go Live radar; never a name before an accept.
 */
class OlgaNotifier(private val context: Context) {
  companion object {
    // The id of the notification the app was opened from (see OlgaBleModule).
    const val EXTRA_NOTIFICATION_ID = "olgaNotificationId"
    private const val CHANNEL_ID = "nearby"
    private const val AVATAR_PX = 128
    private const val AVATAR_INK = "#1B2A41" // as AVATAR_INK in GoLiveRadar.tsx
  }

  fun canNotify(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

  fun show(id: String, title: String, body: String, initials: String, color: String) {
    if (!canNotify()) return
    ensureChannel()
    // Opens Ol-ga on the request this is about (OlgaBleModule hands the id to JS).
    val launch =
      context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
        putExtra(EXTRA_NOTIFICATION_ID, id)
        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
    val tap = launch?.let {
      PendingIntent.getActivity(context, id.hashCode(), it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val notification =
      NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(context.applicationInfo.icon)
        .setLargeIcon(avatar(initials, color))
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(body))
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setCategory(NotificationCompat.CATEGORY_SOCIAL)
        .setAutoCancel(true)
        .apply { if (tap != null) setContentIntent(tap) }
        .build()
    try {
      NotificationManagerCompat.from(context).notify(id.hashCode(), notification)
    } catch (e: SecurityException) {
      // permission withdrawn meanwhile
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "People nearby", NotificationManager.IMPORTANCE_HIGH)
    channel.description = "Commits and accepts from Ol-ga members near you"
    manager.createNotificationChannel(channel)
  }

  private fun avatar(initials: String, color: String): Bitmap {
    val bitmap = Bitmap.createBitmap(AVATAR_PX, AVATAR_PX, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = parse(color, "#E8EEF6") }
    canvas.drawCircle(AVATAR_PX / 2f, AVATAR_PX / 2f, AVATAR_PX / 2f, fill)
    val ink = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      this.color = parse(AVATAR_INK, "#000000")
      textSize = AVATAR_PX * 0.38f
      typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      textAlign = Paint.Align.CENTER
    }
    val y = AVATAR_PX / 2f - (ink.descent() + ink.ascent()) / 2f
    canvas.drawText(initials.take(2), AVATAR_PX / 2f, y, ink)
    return bitmap
  }

  private fun parse(value: String, fallback: String) =
    try {
      Color.parseColor(value)
    } catch (e: IllegalArgumentException) {
      Color.parseColor(fallback)
    }
}
