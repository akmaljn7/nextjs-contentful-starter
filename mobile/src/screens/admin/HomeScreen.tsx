import React from "react";
import { Text, View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { api } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme";

/**
 * Admin home = live sessions list. Phase 4 replaces this with the full
 * react-native-maps live map + action buttons. For Phase 1 we just prove
 * the auth + role routing works and show live employees as a list.
 */
export default function AdminHomeScreen() {
  const { user } = useAuth();
  const live = useQuery<any[]>({
    queryKey: ["live"],
    queryFn: async () => (await api.get("/sessions/live")).data,
    refetchInterval: 10_000,
  });

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={live.isFetching} onRefresh={live.refetch} tintColor={colors.green} />}
        contentContainerStyle={{ paddingTop: 32, paddingBottom: 40 }}
      >
        <Text style={styles.greeting}>Hi {user?.name?.split(" ")[0] || "admin"}</Text>
        <Text style={styles.subGreeting}>Live team activity.</Text>

        <View style={{ marginTop: 24 }}>
          {(live.data || []).length === 0 ? (
            <View style={styles.emptyCard} testID="admin-empty-live">
              <Text style={styles.emptyLabel}>NO ACTIVE SESSIONS</Text>
              <Text style={styles.emptyBody}>
                When employees arrive at their office, sessions will appear here in real time.
              </Text>
            </View>
          ) : (
            (live.data || []).map((s: any) => (
              <View key={s.id} style={styles.row} testID={`live-row-${s.id}`}>
                <View style={[styles.dot, { backgroundColor:
                  s.status === "active" ? colors.green : s.status === "paused" ? colors.amber : colors.textMute
                }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{s.employee_name}</Text>
                  <Text style={styles.rowMeta}>
                    {s.status?.toUpperCase()}  ·  {s.stale ? "STALE  ·  " : ""}
                    {s.remaining_ms ? `${Math.round(s.remaining_ms / 60000)}m left` : ""}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.footerBox}>
          <Text style={styles.footerLabel}>PHASE 1 — SHELL</Text>
          <Text style={styles.footerBody}>
            Live map, offices management, and per-employee actions arrive in Phase 4.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { color: colors.text, fontSize: 28, fontWeight: "700" },
  subGreeting: { color: colors.textDim, fontSize: 14, marginTop: 4 },
  emptyCard: {
    padding: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
  },
  emptyLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 6, fontWeight: "600" },
  emptyBody: { color: colors.text, fontSize: 13, lineHeight: 20 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    marginBottom: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  rowMeta: { color: colors.textDim, fontFamily: "Menlo", fontSize: 11, marginTop: 4, letterSpacing: 0.5 },
  footerBox: {
    marginTop: 32, padding: 16, backgroundColor: colors.blueSoft,
    borderColor: colors.blue, borderLeftWidth: 3,
  },
  footerLabel: { color: colors.blue, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  footerBody: { color: colors.text, fontSize: 12, marginTop: 6, lineHeight: 18 },
});
