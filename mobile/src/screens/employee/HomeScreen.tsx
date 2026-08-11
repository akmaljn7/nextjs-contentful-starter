import React from "react";
import { Text, View, StyleSheet, RefreshControl, ScrollView, Pressable, Linking, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Screen } from "@/components/Screen";
import { HealthChip } from "@/components/HealthChip";
import { useAuth } from "@/context/AuthContext";
import { mobile } from "@/api/mobile";
import { coldStartReconcile } from "@/services/reconcile";
import { drainQueue } from "@/services/syncWorker";
import { startForegroundWatcher, stopForegroundWatcher } from "@/services/foregroundWatcher";
import { startLiveLocation } from "@/services/liveLocation";
import { requestIgnoreBatteryOptimizations, hasPromptedBatteryOptimization, requestFullScreenIntentAccess } from "@/services/batteryOptimization";
import { colors } from "@/theme";

// Live elapsed as HH:MM:SS (zero-padded).
function fmtHMS(ms: number) {
  const total = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}

// Freeze the live ticker if no fix has arrived for longer than this — the
// device has gone offline (coverage gap) and the server stops counting.
const LIVE_FRESH_MS = 60_000;

export default function EmployeeHomeScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [bgPerm, setBgPerm] = React.useState<"granted" | "missing" | "checking">("checking");

  // 1 Hz ticker so the on-site clock counts up live between reconcile polls.
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const rec = useQuery({
    queryKey: ["mobile-reconcile"],
    queryFn: mobile.reconcile,
    refetchInterval: 20_000,
  });

  // Keep foreground watcher alive for the entire lifetime of the Home screen.
  // This is what makes "app open + walk in/out" instantly detect enter/exit
  // instead of waiting for OS-level native geofence transitions (which can
  // lag 30-90s on Android).
  React.useEffect(() => {
    startForegroundWatcher().catch(() => undefined);
    startLiveLocation().catch(() => undefined);
    return () => { stopForegroundWatcher(); };
  }, []);

  // Refresh the watcher whenever the office changes server-side.
  React.useEffect(() => {
    if (rec.data?.office) {
      startForegroundWatcher().catch(() => undefined);
    }
  }, [rec.data?.office?.id, rec.data?.office?.radius_meters]);

  // Poll bg permission so the "Fix location" banner disappears the moment
  // the user grants it via Settings.
  React.useEffect(() => {
    let mounted = true;
    const tick = async () => {
      const bg = await Location.getBackgroundPermissionsAsync();
      if (mounted) setBgPerm(bg.status === "granted" ? "granted" : "missing");
      if (bg.status === "granted") startLiveLocation().catch(() => undefined);
    };
    tick();
    const t = setInterval(tick, 8_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // One-time battery-optimization exemption for employees who onboarded
  // before this feature existed. Without it, Doze freezes background location
  // on an idle phone and the server logs a false coverage gap. Only prompts
  // once (persisted flag) and only after background location is granted.
  React.useEffect(() => {
    if (Platform.OS !== "android" || bgPerm !== "granted") return;
    (async () => {
      if (await hasPromptedBatteryOptimization()) return;
      await requestIgnoreBatteryOptimizations().catch(() => undefined);
      await requestFullScreenIntentAccess().catch(() => undefined);
    })();
  }, [bgPerm]);

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      drainQueue().catch(() => undefined),
      coldStartReconcile().catch(() => undefined),
    ]);
    startForegroundWatcher().catch(() => undefined);
    qc.invalidateQueries({ queryKey: ["mobile-reconcile"] });
  }, [qc]);

  const openSettings = React.useCallback(() => {
    if (Platform.OS === "ios") Linking.openURL("app-settings:");
    else Linking.openSettings();
  }, []);

  const office = rec.data?.office;
  const session = rec.data?.session;
  const statusLabel = session?.status ? session.status.toUpperCase() : "READY";
  const statusColor = session?.status === "active" ? colors.green
    : session?.status === "paused" ? colors.amber
    : colors.textMute;

  // Server-accurate live on-site time. Correct for device/server clock skew
  // using the server_ts_ms captured with the last reconcile response. Only
  // extrapolate while active AND still receiving fixes — otherwise freeze
  // (device offline / walked out) so we never invent minutes.
  const clockOffset = rec.data?.server_ts_ms && rec.dataUpdatedAt
    ? rec.data.server_ts_ms - rec.dataUpdatedAt : 0;
  const serverNow = nowMs + clockOffset;
  const lastTs = session?.last_fix_ts_ms ?? null;
  const sincePing = lastTs != null ? serverNow - lastTs : Infinity;
  const counting = session?.status === "active" && lastTs != null && sincePing >= 0 && sincePing <= LIVE_FRESH_MS;
  const insideMs = (session?.total_inside_ms || 0) + (counting ? sincePing : 0);
  const offlineWhileActive = session?.status === "active" && !counting;

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={rec.isFetching} onRefresh={onRefresh} tintColor={colors.green} />}
        contentContainerStyle={{ paddingTop: 32, paddingBottom: 40 }}
      >
        <Text style={styles.greeting}>Hi {user?.name?.split(" ")[0] || "there"}</Text>
        <Text style={styles.subGreeting}>Attendance is fully automatic.</Text>
        <HealthChip testID="health-chip" />

        {bgPerm === "missing" && (
          <Pressable
            testID="fix-location-banner"
            onPress={openSettings}
            style={styles.warnBanner}
          >
            <Ionicons name="warning" size={20} color={colors.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTitle}>Enable "Always" location</Text>
              <Text style={styles.warnBody}>
                Attendance can't run in the background without "Always" location.
                Tap here to open Settings.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.amber} />
          </Pressable>
        )}

        <View style={styles.card} testID="employee-status-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {session ? (
            <>
              <Text style={styles.cardBody}>
                {session.status === "active"
                  ? "You're checked in. Walk out of the office to pause."
                  : "Paused. Walk back into the office to resume."}
              </Text>

              <View style={styles.insideBlock}>
                <Text style={styles.insideLabel}>ON-SITE TODAY</Text>
                <Text style={styles.insideClock} testID="employee-inside-clock">{fmtHMS(insideMs)}</Text>
                {counting ? (
                  <View style={styles.liveRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText} testID="employee-inside-live">Counting live</Text>
                  </View>
                ) : offlineWhileActive ? (
                  <View style={styles.liveRow}>
                    <View style={[styles.liveDot, { backgroundColor: colors.amber }]} />
                    <Text style={styles.offlineText} testID="employee-offline-note">
                      You're offline — your on-site timer is paused and will continue when you're back online.
                    </Text>
                  </View>
                ) : session.status === "paused" ? (
                  <Text style={styles.offlineText} testID="employee-paused-note">
                    Paused — the timer resumes automatically when you walk back into the office.
                  </Text>
                ) : null}
              </View>

              {session.remaining_ms > 0 && (
                <Text style={styles.cardMeta}>
                  {Math.round(session.remaining_ms / 60000)} min remaining in today's shift
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.cardBody}>
              Nothing to do — the moment you arrive at the office, attendance will start automatically.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>YOUR OFFICE</Text>
          {office ? (
            <>
              <Text style={styles.officeName}>{office.name}</Text>
              <Text style={styles.officeCoords}>
                {office.lat.toFixed(5)}, {office.lng.toFixed(5)}  ·  r={office.radius_meters}m
              </Text>
            </>
          ) : (
            <Text style={styles.cardBody}>
              No office assigned yet. Ask your admin to assign you before you head in.
            </Text>
          )}
        </View>

        {rec.data?.last_event && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>LAST EVENT</Text>
            <Text style={styles.cardMeta}>
              {rec.data.last_event.type.toUpperCase()}  ·  {new Date(rec.data.last_event.ts_ms).toLocaleString()}
            </Text>
            <Text style={styles.cardMeta}>
              Outcome: {rec.data.last_event.outcome || "—"}
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subGreeting: { color: colors.textDim, fontSize: 14, marginTop: 4 },
  card: {
    marginTop: 20, padding: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  status: { fontSize: 12, letterSpacing: 3, fontWeight: "700" },
  cardBody: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 10 },
  cardMeta: { color: colors.textDim, fontSize: 12, marginTop: 6, fontFamily: "Menlo" },
  insideBlock: {
    marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border,
  },
  insideLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, fontWeight: "600" },
  insideClock: {
    color: colors.text, fontSize: 40, fontWeight: "700", fontFamily: "Menlo",
    marginTop: 6, letterSpacing: 1,
  },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  liveText: { color: colors.green, fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  offlineText: { color: colors.amber, fontSize: 12, lineHeight: 17, flex: 1 },
  cardLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 8, fontWeight: "600" },
  officeName: { color: colors.text, fontSize: 18, fontWeight: "600" },
  officeCoords: { color: colors.textDim, fontFamily: "Menlo", fontSize: 12, marginTop: 6 },
  warnBanner: {
    marginTop: 16, padding: 14, backgroundColor: "#3a2a10",
    borderColor: colors.amber, borderLeftWidth: 3,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  warnTitle: { color: colors.amber, fontSize: 13, fontWeight: "700" },
  warnBody: { color: colors.text, fontSize: 12, marginTop: 4, lineHeight: 16 },
});
