/**
 * Expo config plugin — Android boot receiver (Phase 6).
 *
 * Why: on Android some OEMs aggressively kill app processes on reboot. Registering
 * a lightweight BOOT_COMPLETED receiver keeps our app in the OS's "cared about"
 * process list so expo-task-manager can re-arm the geofence task when the next
 * transition happens (or the next scheduled TaskManager event fires).
 *
 * We deliberately do NOT invoke any Expo/native APIs from the receiver — those
 * classes may move between SDK versions and cause gradle failures. The receiver
 * is a no-op logger; the actual re-arming happens in `src/services/bootTask.ts`
 * which the framework wakes on its own once our process is warm.
 *
 * The plugin is a no-op on iOS (CLCircularRegions survive reboot natively).
 */
const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const RECEIVER_NAME = ".BootReceiver";

function addBootReceiverToManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.receiver = app.receiver || [];
    const already = app.receiver.some(
      (r) => r?.$?.["android:name"] === RECEIVER_NAME,
    );
    if (!already) {
      app.receiver.push({
        $: {
          "android:name": RECEIVER_NAME,
          "android:enabled": "true",
          "android:exported": "true",
          "android:permission": "android.permission.RECEIVE_BOOT_COMPLETED",
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
              { $: { "android:name": "android.intent.action.QUICKBOOT_POWERON" } },
              { $: { "android:name": "android.intent.action.MY_PACKAGE_REPLACED" } },
            ],
          },
        ],
      });
    }
    return cfg;
  });
}

function writeBootReceiverKotlin(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const projectRoot = cfg.modRequest.platformProjectRoot;
      const pkg = (cfg.android && cfg.android.package) || "com.staypin.app";
      const pkgPath = pkg.split(".").join("/");
      const dir = path.join(projectRoot, "app/src/main/java", pkgPath);
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, "BootReceiver.kt");
      // Deliberately minimal: only android.* imports, no expo/react-native ones.
      // Kotlin fails compile on unresolved imports; expo module classes shift
      // between SDK versions so we stay agnostic. The framework handles the
      // actual task re-arm on next JS bundle load — we just keep the process
      // alive briefly by declaring interest in the boot broadcast.
      const kotlin = `package ${pkg}

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * BOOT_COMPLETED receiver. Presence of this receiver is enough to signal the
 * OS that our app cares about boot events — expo-task-manager's own persisted
 * registrations then re-arm on next transition. No native calls needed.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            Log.i("BootReceiver", "Boot event received: " + action)
        }
    }
}
`;
      fs.writeFileSync(filePath, kotlin, "utf8");
      return cfg;
    },
  ]);
}

module.exports = function withAndroidBootReceiver(config) {
  config = addBootReceiverToManifest(config);
  config = writeBootReceiverKotlin(config);
  return config;
};
