import React from "react";
import { Text, View, StyleSheet, ScrollView, RefreshControl, Alert, Pressable } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MapView, { Circle, Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/Screen";
import { api, apiError } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme";

interface LiveSession {
  id: string;
  user_id: string;
  employee_name: string;
  employee_email: string;
  status: "active" | "paused";
  remaining_ms: number;
  center: { lat: number; lng: number; radius_m: number };
  last_fix?: { lat: number; lng: number; accuracy: number; ts_ms: number };
  flagged: boolean;
  stale: boolean;
  active_challenge?: { id: string; respond_by_ms: number } | null;
}

interface Office {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
}

/**
 * Admin live map — Phase 4.
 *
 * Uses react-native-maps (native Apple Maps on iOS, Google Maps on Android).
 * Renders every office as a green circle and every live employee as a
 * status-coloured marker. Below the map, a list of live sessions each with
 * per-row actions: Send selfie now / End session.
 */
export default function AdminHomeScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const offices = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: async () => (await api.get("/offices")).data,
    staleTime: 60_000,
  });

  const live = useQuery<LiveSession[]>({
    queryKey: ["live"],
    queryFn: async () => (await api.get("/sessions/live")).data,
    refetchInterval: 10_000,
  });

  const challengeNow = useMutation({
    mutationFn: async (userId: string) =>
      (await api.post(`/sessions/challenge-now/${userId}`)).data,
    onSuccess: () => {
      Alert.alert("✅ Sent", "Selfie challenge dispatched to the employee.");
      qc.invalidateQueries({ queryKey: ["live"] });
    },
    onError: (e) => Alert.alert("Couldn't send", apiError(e)),
  });

  const forceExpire = useMutation({
    mutationFn: async (userId: string) =>
      (await api.post(`/sessions/force-expire/${userId}`)).data,
    onSuccess: () => {
      Alert.alert("✅ Ended", "Session ended for that employee.");
      qc.invalidateQueries({ queryKey: ["live"] });
    },
    onError: (e) => Alert.alert("Couldn't end", apiError(e)),
  });

  const confirmEnd = (s: LiveSession) => {
    Alert.alert(
      "End session?",
      `Force-end ${s.employee_name}'s attendance now?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "End", style: "destructive", onPress: () => forceExpire.mutate(s.user_id) },
      ],
    );
  };

  const initial = React.useMemo(() => {
    if (live.data?.length) {
      const first = live.data[0];
      return {
        latitude: first.center.lat,
        longitude: first.center.lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    if (offices.data?.length) {
      return {
        latitude: offices.data[0].lat,
        longitude: offices.data[0].lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    return { latitude: 0, longitude: 0, latitudeDelta: 40, longitudeDelta: 40 };
  }, [live.data, offices.data]);

  const activeCount = (live.data || []).filter((s) => s.status === "active").length;
  const pausedCount = (live.data || []).filter((s) => s.status === "paused").length;

  return (
    <Screen>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={live.isFetching || offices.isFetching}
            onRefresh={() => { live.refetch(); offices.refetch(); }}
            tintColor={colors.green}
          />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          <Text style={styles.greeting}>Live activity</Text>
          <Text style={styles.subGreeting}>Hi {user?.name?.split(" ")[0] || "admin"} · pull to refresh</Text>

          <View style={styles.statRow}>
            <Stat label="ACTIVE" value={activeCount} color={colors.green} testID="stat-active" />
            <Stat label="PAUSED" value={pausedCount} color={colors.amber} testID="stat-paused" />
            <Stat label="OFFICES" value={offices.data?.length ?? 0} color={colors.blue} testID="stat-offices" />
          </View>
        </View>

        <View style={styles.mapWrap}>
          <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={initial}
            showsUserLocation={false}
            showsCompass={false}
            testID="admin-live-map"
          >
            {(offices.data || []).map((o) => (
              <React.Fragment key={o.id}>
                <Circle
                  center={{ latitude: o.lat, longitude: o.lng }}
                  radius={o.radius_meters}
                  strokeColor={colors.green}
                  strokeWidth={1.5}
                  fillColor="rgba(16,185,129,0.10)"
                />
                <Marker
                  coordinate={{ latitude: o.lat, longitude: o.lng }}
                  title={o.name}
                  description={`${o.radius_meters}m geofence`}
                  pinColor="green"
                />
              </React.Fragment>
            ))}
            {(live.data || []).filter((s) => s.last_fix).map((s) => (
              <Marker
                key={s.id}
                coordinate={{
                  latitude: s.last_fix!.lat,
                  longitude: s.last_fix!.lng,
                }}
                title={s.employee_name}
                description={s.status.toUpperCase() + (s.stale ? " · STALE" : "")}
                pinColor={s.status === "active" ? "blue" : "orange"}
                testID={`live-marker-${s.id}`}
              />
            ))}
          </MapView>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
          {(live.data || []).length === 0 ? (
            <View style={styles.emptyCard} testID="admin-empty-live">
              <Text style={styles.emptyLabel}>NO ACTIVE SESSIONS</Text>
              <Text style={styles.emptyBody}>
                Sessions will appear here in real time as employees arrive at their office.
              </Text>
            </View>
          ) : (
            (live.data || []).map((s) => (
              <View key={s.id} style={styles.row} testID={`live-row-${s.id}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={[styles.dot, {
                    backgroundColor: s.status === "active" ? colors.green
                      : s.status === "paused" ? colors.amber : colors.textMute,
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{s.employee_name}</Text>
                    <Text style={styles.rowMeta}>
                      {s.status.toUpperCase()}
                      {s.stale ? "  ·  STALE" : ""}
                      {s.flagged ? "  ·  FLAGGED" : ""}
                      {s.remaining_ms > 0 ? `  ·  ${Math.round(s.remaining_ms / 60000)}m left` : ""}
                    </Text>
                  </View>
                </View>
                <View style={styles.rowActions}>
                  <ActionButton
                    icon="camera"
                    label="Selfie now"
                    color={colors.blue}
                    onPress={() => challengeNow.mutate(s.user_id)}
                    disabled={!!s.active_challenge || challengeNow.isPending}
                    testID={`send-selfie-${s.id}`}
                  />
                  <ActionButton
                    icon="close-circle"
                    label="End"
                    color={colors.red}
                    onPress={() => confirmEnd(s)}
                    testID={`end-session-${s.id}`}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, color, testID }: { label: string; value: number; color: string; testID?: string }) {
  return (
    <View style={styles.stat} testID={testID}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  icon, label, color, onPress, disabled, testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionBtn,
        { borderColor: color },
        pressed && { opacity: 0.7 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  greeting: { color: colors.text, fontSize: 26, fontWeight: "700" },
  subGreeting: { color: colors.textDim, fontSize: 12, marginTop: 4, letterSpacing: 0.5 },
  statRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  stat: {
    flex: 1, padding: 12, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 1.5, marginTop: 2, fontWeight: "600" },

  mapWrap: {
    marginTop: 16,
    height: 280,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  map: { flex: 1 },

  emptyCard: { padding: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  emptyLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 6, fontWeight: "600" },
  emptyBody: { color: colors.text, fontSize: 13, lineHeight: 20 },

  row: {
    padding: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    marginBottom: 8, gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  rowMeta: { color: colors.textDim, fontSize: 11, marginTop: 4, letterSpacing: 0.5, fontFamily: "Menlo" },
  rowActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1,
  },
  actionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
});
