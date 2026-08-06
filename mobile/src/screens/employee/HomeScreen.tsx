import React from "react";
import { Text, View, StyleSheet, RefreshControl, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/context/AuthContext";
import { mobile } from "@/api/mobile";
import { colors } from "@/theme";

/**
 * Placeholder Home. Phase 2 will replace this with the live geofence status
 * card, permission health chip, and reconciliation footer. For Phase 1 we
 * just prove the plumbing: fetch /mobile/reconcile and display the assigned
 * office + current session state.
 */
export default function EmployeeHomeScreen() {
  const { user } = useAuth();
  const rec = useQuery({
    queryKey: ["mobile-reconcile"],
    queryFn: mobile.reconcile,
    refetchInterval: 15_000,
  });

  const office = rec.data?.office;
  const session = rec.data?.session;
  const statusLabel = session?.status ? session.status.toUpperCase() : "NOT ACTIVE";
  const statusColor = session?.status === "active" ? colors.green
    : session?.status === "paused" ? colors.amber
    : colors.textMute;

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={rec.isFetching} onRefresh={rec.refetch} tintColor={colors.green} />}
        contentContainerStyle={{ paddingTop: 32, paddingBottom: 40 }}
      >
        <Text style={styles.greeting}>Hi {user?.name?.split(" ")[0] || "there"}</Text>
        <Text style={styles.subGreeting}>Welcome to Attendance Console.</Text>

        <View style={styles.card} testID="employee-status-card">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {session ? (
            <Text style={styles.cardBody}>
              You have an active session. Automatic detection will pause it when you leave the office.
            </Text>
          ) : (
            <Text style={styles.cardBody}>
              Attendance will start automatically the moment you arrive at your assigned office.
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

        <View style={styles.footerBox}>
          <Text style={styles.footerLabel}>PHASE 1 — SHELL</Text>
          <Text style={styles.footerBody}>
            Background geofencing and selfie challenges arrive in Phase 2 & 3. All backend endpoints are
            live and this screen already talks to them.
          </Text>
        </View>
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
  cardLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 8, fontWeight: "600" },
  officeName: { color: colors.text, fontSize: 18, fontWeight: "600" },
  officeCoords: { color: colors.textDim, fontFamily: "Menlo", fontSize: 12, marginTop: 6 },
  footerBox: {
    marginTop: 32, padding: 16, backgroundColor: colors.blueSoft,
    borderColor: colors.blue, borderLeftWidth: 3,
  },
  footerLabel: { color: colors.blue, fontSize: 10, letterSpacing: 2, fontWeight: "700" },
  footerBody: { color: colors.text, fontSize: 12, marginTop: 6, lineHeight: 18 },
});
