/**
 * Fixes the Xcode 26 build failure:
 *   "call to consteval function 'fmt::basic_format_string<...>' is not a
 *    constant expression"
 *
 * React Native 0.76 (Expo SDK 52) bundles fmt 11, whose base.h enables the
 * C++20 `consteval` compile-time format-string checking. Xcode 26's Clang
 * enforces consteval strictly and rejects it. The error surfaces in every
 * translation unit that INCLUDES fmt headers (RCT-Folly, glog, RN core), so
 * patching the header is the definitive cross-target fix.
 *
 * This plugin injects a post_install step into the (Expo-generated) Podfile
 * that:
 *   1. Rewrites fmt/base.h so FMT_USE_CONSTEVAL is 0 (disables consteval).
 *   2. Forces the fmt pod itself to compile as C++17 (belt-and-suspenders).
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const FMT_FIX = `
    # --- fmt consteval fix for Xcode 26 (injected by withFmtConstevalFix) ---
    fmt_base = File.join(installer.sandbox.root.to_s, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      contents = File.read(fmt_base)
      patched = contents.gsub(/#\\s*define\\s+FMT_USE_CONSTEVAL\\s+1/, '#  define FMT_USE_CONSTEVAL 0')
      File.write(fmt_base, patched) if patched != contents
    end
    installer.pods_project.targets.each do |t|
      if t.name == 'fmt'
        t.build_configurations.each do |bc|
          bc.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
    # --- end fmt consteval fix ---
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfile, "utf8");
      if (!contents.includes("fmt consteval fix")) {
        contents = contents.replace(
          /(post_install do \|installer\|\n)/,
          `$1${FMT_FIX}`,
        );
        fs.writeFileSync(podfile, contents);
      }
      return cfg;
    },
  ]);
};
