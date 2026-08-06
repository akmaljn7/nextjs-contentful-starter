/**
 * Live device-health chip on the Employee Home screen.
 *
 * Green when everything is armed and the queue is empty.
 * Amber when permissions are downgraded or events are pending.
 * Red when foreground location is denied (attendance impossible).
 */
import React, { useCallback, useEffect, useState } from "react";
import { Text, View, StyleSheet, Pressable, Linking, Platform } from "react-native";
import { AppState } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { healthSnapshot, HealthSnapshot } from "@/services/health";
import { syncOfficeGeofence } from "@/services/geofence";
import { drainQueue } from "@/services/syncWorker";
import { colors } from "@/theme";

interface Props {
  onTap?: () => void;
  testID?: string;
}

export function HealthChip({ onTap, testID }: Props) {
  const [snap, setSnap] = useState<HealthSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setSnap(await healthSnapshot());
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") refresh(); });
    const t = setInterval(refresh, 30_000);
    return () => { sub.remove(); clearInterval(t); };
  }, [refresh]);

  const openSettings = async () => {
    if (Platform.OS === "ios") await Linking.openURL("app-settings:");
    else await Linking.openSettings();
  };

  const reactivate = useCallback(async () => {
    setBusy(true);
    try {
      await syncOfficeGeofence();
      await drainQueue();
      await refresh();
    } finally { setBusy(false); }
  }, [refresh]);

  if (!snap) {
    return <View style={[styles.chip, { borderColor: colors.border }]}><Text style={styles.dim}>Checking…</Text></View>;
  }

  const isRed = snap.permission === "denied";
  const isAmber = snap.permission === "when_in_use" || snap.queuedEvents > 0 || !snap.geofenceArmed;
  const color = isRed ? colors.red : isAmber ? colors.amber : colors.green;
  const label = isRed
    ? "LOCATION DENIED"
    : snap.queuedEvents > 0
    ? `${snap.queuedEvents} EVENT${snap.queuedEvents === 1 ? "" : "S"} QUEUED`
    : !snap.geofenceArmed
    ? "GRANT BACKGROUND"
    : snap.permission === "when_in_use"
    ? "FOREGROUND ONLY"
    : "TRACKING ACTIVE";

  return (
    <Pressable
      testID={testID}
      onPress={onTap || (isRed ? openSettings : reactivate)}
      style={[styles.chip, { borderColor: color, backgroundColor: `${color}22` }]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{label}</Text>
      <Ionicons
        name={isRed ? "settings-outline" : busy ? "sync" : "refresh"}
        size={12}
        color={color}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10,
    alignSelf: "flex-start", marginTop: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 10, letterSpacing: 1.8, fontWeight: "700" },
  dim: { color: colors.textDim, fontSize: 10, letterSpacing: 1.5 },
});
