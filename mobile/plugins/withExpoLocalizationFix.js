/**
 * Fixes the Xcode 26 / iOS 26 SDK build failure:
 *   expo-localization/ios/LocalizationModule.swift — "switch must be exhaustive"
 *
 * The iOS 26 SDK added a new case to Foundation's non-frozen
 * `Calendar.Identifier` enum. expo-localization 16.0.1 (Expo SDK 52) switches
 * over `calendar.identifier` without an `@unknown default:`, so under Xcode 26
 * the switch is no longer exhaustive and the Swift compiler errors out.
 *
 * This runs during prebuild (before pod install / compile) and appends an
 * `@unknown default:` case so the switch is future-proof against any new
 * calendar identifiers. Falls back to "gregory" (the Unicode default calendar).
 *
 * Deep-checked: this is the ONLY unguarded system-enum switch in the project's
 * native dependency tree — expo-font, expo-image-manipulator and
 * react-native-vision-camera already use `default:` on their system-enum
 * switches.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withExpoLocalizationFix(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const file = path.join(
        cfg.modRequest.projectRoot,
        "node_modules",
        "expo-localization",
        "ios",
        "LocalizationModule.swift",
      );
      try {
        if (fs.existsSync(file)) {
          let src = fs.readFileSync(file, "utf8");
          if (
            src.includes("switch calendar.identifier") &&
            !src.includes("@unknown default")
          ) {
            src = src.replace(
              `    case .iso8601:
      return "iso8601"
    }`,
              `    case .iso8601:
      return "iso8601"
    @unknown default:
      return "gregory"
    }`,
            );
            fs.writeFileSync(file, src);
          }
        }
      } catch (e) {
        // best-effort: never crash prebuild over this
        console.warn("withExpoLocalizationFix: could not patch", e.message);
      }
      return cfg;
    },
  ]);
};
