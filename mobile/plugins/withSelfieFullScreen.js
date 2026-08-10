/**
 * Expo config plugin — WhatsApp-style full-screen incoming selfie (Android).
 *
 * When a selfie push (data-only, kind=selfie_challenge, full_screen=true) arrives
 * — even with the app killed and the phone asleep/locked — a native
 * FirebaseMessagingService posts a full-screen-intent notification that wakes
 * the screen and launches IncomingSelfieActivity OVER the lock screen, ringing
 * loudly. The activity shows "Selfie for {name}" + a single "OPEN CAMERA" button
 * that deep-links into the RN app (geofenceattendance://selfie) to open the
 * selfie camera, then stops the ring.
 *
 * Non-selfie pushes are delegated to expo-notifications' own handling (our
 * service extends ExpoFirebaseMessagingService). iOS is unaffected (it gets a
 * normal loud alert — full-screen isn't possible without VoIP/CallKit).
 */
const { withAndroidManifest, withDangerousMod, withAppBuildGradle, AndroidConfig } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PKG_DEFAULT = "com.geofenceattendance.app";
const EXPO_FCM_SERVICE = "expo.modules.notifications.service.ExpoFirebaseMessagingService";
const OUR_SERVICE = ".SelfieMessagingService";
const OUR_ACTIVITY = ".IncomingSelfieActivity";

function patchManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    // Ensure tools namespace (needed for tools:node="remove").
    manifest.manifest.$ = manifest.manifest.$ || {};
    if (!manifest.manifest.$["xmlns:tools"]) {
      manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    // USE_FULL_SCREEN_INTENT permission.
    manifest.manifest["uses-permission"] = manifest.manifest["uses-permission"] || [];
    const hasPerm = manifest.manifest["uses-permission"].some(
      (p) => p?.$?.["android:name"] === "android.permission.USE_FULL_SCREEN_INTENT",
    );
    if (!hasPerm) {
      manifest.manifest["uses-permission"].push({
        $: { "android:name": "android.permission.USE_FULL_SCREEN_INTENT" },
      });
    }

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app.service = app.service || [];
    app.activity = app.activity || [];

    // Remove expo-notifications' FCM service so OURS (which subclasses it) is
    // the one FCM dispatches to.
    if (!app.service.some((s) => s?.$?.["android:name"] === EXPO_FCM_SERVICE && s?.$?.["tools:node"] === "remove")) {
      app.service.push({ $: { "android:name": EXPO_FCM_SERVICE, "tools:node": "remove" } });
    }
    // Register our service with the FCM messaging intent-filter.
    if (!app.service.some((s) => s?.$?.["android:name"] === OUR_SERVICE)) {
      app.service.push({
        $: { "android:name": OUR_SERVICE, "android:exported": "false" },
        "intent-filter": [
          { action: [{ $: { "android:name": "com.google.firebase.MESSAGING_EVENT" } }] },
        ],
      });
    }
    // Register the full-screen lock-screen activity.
    if (!app.activity.some((a) => a?.$?.["android:name"] === OUR_ACTIVITY)) {
      app.activity.push({
        $: {
          "android:name": OUR_ACTIVITY,
          "android:exported": "false",
          "android:showWhenLocked": "true",
          "android:turnScreenOn": "true",
          "android:excludeFromRecents": "true",
          "android:launchMode": "singleInstance",
          "android:taskAffinity": "",
          "android:theme": "@android:style/Theme.Material.NoActionBar",
        },
      });
    }
    return cfg;
  });
}

function writeKotlin(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const pkg = (cfg.android && cfg.android.package) || PKG_DEFAULT;
      const dir = path.join(projectRoot, "app/src/main/java", pkg.split(".").join("/"));
      fs.mkdirSync(dir, { recursive: true });

      // Copy the alarm tone into res/raw so R.raw.selfie_alert resolves for the
      // native ringtone + notification channel sound.
      try {
        const soundSrc = path.join(cfg.modRequest.projectRoot, "assets/selfie_alert.wav");
        const rawDir = path.join(projectRoot, "app/src/main/res/raw");
        fs.mkdirSync(rawDir, { recursive: true });
        if (fs.existsSync(soundSrc)) {
          fs.copyFileSync(soundSrc, path.join(rawDir, "selfie_alert.wav"));
        }
      } catch (e) {
        // non-fatal — falls back to silent native ring
      }

      fs.writeFileSync(path.join(dir, "IncomingSelfieActivity.kt"), `package ${pkg}

import android.app.Activity
import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class IncomingSelfieActivity : Activity() {
    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private val autoDismiss = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            (getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager)?.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val forName = intent.getStringExtra("for_name") ?: ""

        val root = LinearLayout(this)
        root.orientation = LinearLayout.VERTICAL
        root.gravity = Gravity.CENTER
        root.setBackgroundColor(Color.parseColor("#0a0a0a"))
        root.setPadding(72, 72, 72, 72)

        val badge = TextView(this)
        badge.text = "SELFIE CHECK-IN"
        badge.setTextColor(Color.parseColor("#ef4444"))
        badge.textSize = 13f
        badge.gravity = Gravity.CENTER
        root.addView(badge)

        val title = TextView(this)
        title.text = if (forName.isNotEmpty()) "Selfie for " + forName else "Selfie check-in required"
        title.setTextColor(Color.WHITE)
        title.textSize = 26f
        title.gravity = Gravity.CENTER
        title.setPadding(0, 24, 0, 12)
        root.addView(title)

        val hint = TextView(this)
        hint.text = "Take a live selfie now to confirm you're at the office."
        hint.setTextColor(Color.parseColor("#9ca3af"))
        hint.textSize = 15f
        hint.gravity = Gravity.CENTER
        hint.setPadding(0, 0, 0, 56)
        root.addView(hint)

        val openBtn = Button(this)
        openBtn.text = "OPEN CAMERA"
        openBtn.setTextColor(Color.BLACK)
        openBtn.setBackgroundColor(Color.parseColor("#10b981"))
        openBtn.setOnClickListener { openCameraAndFinish() }
        root.addView(openBtn)

        setContentView(root)
        startRinging()
        scheduleAutoDismiss()
    }

    // WhatsApp-style calls stop ringing on their own — likewise, if the selfie
    // response window elapses with no answer, auto-dismiss this screen and stop
    // the alarm. The server independently marks the challenge MISSED.
    private fun scheduleAutoDismiss() {
        val respondBy = intent.getStringExtra("respond_by_ms")?.toLongOrNull() ?: 0L
        val now = System.currentTimeMillis()
        // Fall back to a 5-min ring if no valid deadline was supplied.
        val delay = if (respondBy > now) (respondBy - now) else 5 * 60 * 1000L
        autoDismiss.postDelayed({
            stopRinging()
            try {
                (getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)?.cancel(SELFIE_NOTIF_ID)
            } catch (_: Exception) {}
            finish()
        }, delay.coerceAtMost(10 * 60 * 1000L))
    }

    private fun startRinging() {
        try {
            val resId = resources.getIdentifier("selfie_alert", "raw", packageName)
            if (resId != 0) {
                player = MediaPlayer.create(this, resId)
                player?.isLooping = true
                player?.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                player?.start()
            }
        } catch (_: Exception) {}
        try {
            vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            val pattern = longArrayOf(0, 700, 400, 700, 400, 700)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }
        } catch (_: Exception) {}
    }

    private fun stopRinging() {
        try { player?.stop(); player?.release() } catch (_: Exception) {}
        player = null
        try { vibrator?.cancel() } catch (_: Exception) {}
    }

    private fun openCameraAndFinish() {
        stopRinging()
        try {
            (getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager)?.cancel(SELFIE_NOTIF_ID)
        } catch (_: Exception) {}
        try {
            val launch = Intent(Intent.ACTION_VIEW, Uri.parse("geofenceattendance://selfie"))
            launch.setPackage(packageName)
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(launch)
        } catch (_: Exception) {
            val main = packageManager.getLaunchIntentForPackage(packageName)
            main?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (main != null) startActivity(main)
        }
        finish()
    }

    override fun onDestroy() {
        autoDismiss.removeCallbacksAndMessages(null)
        stopRinging()
        super.onDestroy()
    }

    companion object {
        const val SELFIE_NOTIF_ID = 90210
    }
}
`, "utf8");

      fs.writeFileSync(path.join(dir, "SelfieMessagingService.kt"), `package ${pkg}

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

class SelfieMessagingService : ExpoFirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        if (data["kind"] == "selfie_challenge" && data["full_screen"] == "true") {
            showFullScreenSelfie(data)
            return
        }
        super.onMessageReceived(remoteMessage)
    }

    private fun ensureChannel(nm: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (nm.getNotificationChannel("selfie_ring") == null) {
                val soundUri = Uri.parse("android.resource://" + packageName + "/raw/selfie_alert")
                val attrs = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                val ch = NotificationChannel("selfie_ring", "Selfie check-in alarm", NotificationManager.IMPORTANCE_HIGH)
                ch.setSound(soundUri, attrs)
                ch.enableVibration(true)
                ch.vibrationPattern = longArrayOf(0, 700, 400, 700, 400, 700)
                ch.setBypassDnd(true)
                nm.createNotificationChannel(ch)
            }
        }
    }

    private fun showFullScreenSelfie(data: Map<String, String>) {
        val forName = data["for_name"] ?: ""
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        ensureChannel(nm)

        val fsIntent = Intent(this, IncomingSelfieActivity::class.java)
        fsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        fsIntent.putExtra("for_name", forName)
        fsIntent.putExtra("respond_by_ms", data["respond_by_ms"] ?: "")
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val fsPending = PendingIntent.getActivity(this, 0, fsIntent, flags)

        val title = data["title"] ?: "Selfie check-in"
        val body = data["body"] ?: (if (forName.isNotEmpty()) "Selfie for " + forName else "Take a selfie now.")

        val builder = NotificationCompat.Builder(this, "selfie_ring")
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setAutoCancel(true)
            .setFullScreenIntent(fsPending, true)
            .setContentIntent(fsPending)

        nm.notify(IncomingSelfieActivity.SELFIE_NOTIF_ID, builder.build())
    }
}
`, "utf8");
      return cfg;
    },
  ]);
}

/**
 * Adds the Firebase Cloud Messaging dependency to the APP module so our
 * SelfieMessagingService (which subclasses expo-notifications'
 * ExpoFirebaseMessagingService and references RemoteMessage /
 * FirebaseMessagingService directly) compiles. expo-notifications keeps
 * firebase-messaging internal, so the app module can't see those classes
 * unless we declare the dependency here. Pinned via the Firebase BoM.
 */
function addFirebaseMessaging(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") return cfg;
    let contents = cfg.modResults.contents;
    if (contents.includes("com.google.firebase:firebase-messaging")) return cfg;
    const deps =
      '    implementation(platform("com.google.firebase:firebase-bom:34.5.0"))\n' +
      '    implementation("com.google.firebase:firebase-messaging")\n';
    const marker = /dependencies\s*\{/;
    if (marker.test(contents)) {
      contents = contents.replace(marker, (m) => `${m}\n${deps}`);
    } else {
      contents += `\ndependencies {\n${deps}}\n`;
    }
    cfg.modResults.contents = contents;
    return cfg;
  });
}

module.exports = function withSelfieFullScreen(config) {
  config = patchManifest(config);
  config = addFirebaseMessaging(config);
  config = writeKotlin(config);
  return config;
};
