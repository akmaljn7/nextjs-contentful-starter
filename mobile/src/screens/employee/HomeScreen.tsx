import React from "react";
import { Text, View, StyleSheet, RefreshControl, ScrollView } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { HealthChip } from "@/components/HealthChip";
import { useAuth } from "@/context/AuthContext";
import { mobile } from "@/api/mobile";
import { coldStartReconcile } from "@/services/reconcile";
import { drainQueue } from "@/services/syncWorker";
import { colors } from "@/theme";

/**
 * Placeholder Home. Phase 2 will replace this with the live geofence status
 * card, permission health chip, and reconciliation footer. For Phase 1 we
 * just prove the plumbing: fetch /mobile/reconcile and display the assigned
 * office + current session state.
 */
export default function EmployeeHomeScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const rec = useQuery({
    queryKey: ["mobile-reconcile"],
    queryFn: mobile.reconcile,
    refetchInterval: 20_000,
  });

  const onRefresh = React.useCallback(async () => {
    await Promise.all([
      drainQueue().catch(() => undefined),
      coldStartReconcile().catch(() => undefined),
    ]);
    qc.invalidateQueries({ queryKey: ["mobile-reconcile"] });
  }, [qc]);

  const office = rec.data?.office;
  const session = rec.data?.session;
  const statusLabel = session?.status ? session.status.toUpperCase() : "READY";
  const statusColor = session?.status === "active" ? colors.green
    : session?.status === "paused" ? colors.amber
    : colors.textMute;

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={rec.isFetching} onRefresh={onRefresh} tintColor={colors.green} />}
        contentContainerStyle={{ paddingTop: 32, paddingBottom: 40 }}
      >
        <Text style={styles.greeting}>Hi {user?.name?.split(" ")[0] || "there"}</Text>
        <Text style={styles.subGreeting}>Attendance is fully automatic.</Text>
        <HealthChip testID="health-chip" />

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
  cardLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 8, fontWeight: "600" },
  officeName: { color: colors.text, fontSize: 18, fontWeight: "600" },
  officeCoords: { color: colors.textDim, fontFamily: "Menlo", fontSize: 12, marginTop: 6 },
});
