/**
 * Leave / Time-off requests (employee).
 *
 * Employees submit a leave request (date range + reason); admins approve or
 * deny it from the web console or admin app. Approved leave overrides the
 * schedule and blocks attendance on the covered dates. This screen lets the
 * employee submit a request and track its status; pending requests can be
 * cancelled.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { timeOff, LeaveRequest } from "@/api/timeOff";
import { apiError } from "@/api/client";
import { colors } from "@/theme";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const todayStr = () => new Date().toISOString().slice(0, 10);

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const STATUS_META: Record<LeaveRequest["status"], { color: string; soft: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { color: colors.amber, soft: colors.amberSoft, label: "Pending", icon: "time" },
  approved: { color: colors.green, soft: colors.greenSoft, label: "Approved", icon: "checkmark-circle" },
  denied: { color: colors.red, soft: colors.redSoft, label: "Denied", icon: "close-circle" },
};

export default function LeaveScreen() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRequests(await timeOff.mine());
    } catch {
      /* keep prior list on transient errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = useCallback(async () => {
    const s = start.trim();
    const e = end.trim();
    if (!isValidDate(s)) return Alert.alert("Invalid start date", "Use the format YYYY-MM-DD, e.g. 2026-07-15.");
    if (!isValidDate(e)) return Alert.alert("Invalid end date", "Use the format YYYY-MM-DD, e.g. 2026-07-16.");
    if (e < s) return Alert.alert("Check dates", "The end date is before the start date.");
    if (s < todayStr()) return Alert.alert("Check dates", "You can't request leave for a date in the past.");
    if (!reason.trim()) return Alert.alert("Add a reason", "Please write a short reason for your leave.");

    setBusy(true);
    try {
      await timeOff.create({ start_date: s, end_date: e, reason: reason.trim() });
      setStart(""); setEnd(""); setReason("");
      Alert.alert("✅ Request submitted", "Your leave request was sent to your admin for approval.");
      await load();
    } catch (err) {
      Alert.alert("Couldn't submit", apiError(err));
    } finally {
      setBusy(false);
    }
  }, [start, end, reason, load]);

  const cancel = useCallback((req: LeaveRequest) => {
    Alert.alert("Cancel request?", `Withdraw your leave for ${req.start_date} → ${req.end_date}?`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel request",
        style: "destructive",
        onPress: async () => {
          try {
            await timeOff.cancel(req.id);
            await load();
          } catch (err) {
            Alert.alert("Couldn't cancel", apiError(err));
          }
        },
      },
    ]);
  }, [load]);

  return (
    <Screen testID="leave-screen">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.textDim} />}
      >
        <Text style={styles.title}>Leave</Text>
        <Text style={styles.sub}>Request time off and track approvals.</Text>

        {/* --- New request form --- */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New request</Text>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Input
                label="Start date"
                testID="leave-start-date"
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                value={start}
                onChangeText={setStart}
              />
            </View>
            <View style={styles.rowItem}>
              <Input
                label="End date"
                testID="leave-end-date"
                placeholder="YYYY-MM-DD"
                autoCapitalize="none"
                keyboardType="numbers-and-punctuation"
                value={end}
                onChangeText={setEnd}
              />
            </View>
          </View>
          <Input
            label="Reason"
            testID="leave-reason"
            placeholder="e.g. Family event, medical appointment"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          <Button testID="leave-submit-btn" label="Submit request" loading={busy} onPress={submit} />
        </View>

        {/* --- My requests --- */}
        <Text style={styles.sectionTitle}>My requests</Text>
        {!loading && requests.length === 0 && (
          <Text style={styles.empty} testID="leave-empty">No leave requests yet.</Text>
        )}
        <View style={{ gap: 10 }}>
          {requests.map((req) => {
            const meta = STATUS_META[req.status];
            return (
              <View key={req.id} style={styles.reqCard} testID={`leave-req-${req.id}`}>
                <View style={styles.reqHeader}>
                  <Text style={styles.reqDates}>{req.start_date} → {req.end_date}</Text>
                  <View style={[styles.badge, { backgroundColor: meta.soft, borderColor: meta.color }]}>
                    <Ionicons name={meta.icon} size={12} color={meta.color} />
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                {!!req.reason && <Text style={styles.reqReason}>{req.reason}</Text>}
                {req.status !== "pending" && !!req.decision_notes && (
                  <Text style={styles.reqNotes}>
                    Admin note: {req.decision_notes}
                  </Text>
                )}
                {req.status === "pending" && (
                  <Pressable
                    testID={`leave-cancel-${req.id}`}
                    onPress={() => cancel(req)}
                    style={styles.cancelBtn}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={13} color={colors.red} />
                    <Text style={styles.cancelText}>Cancel request</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 20, gap: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 14, marginBottom: 16 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 4, padding: 16, gap: 4, marginBottom: 20,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: 8 },
  row: { flexDirection: "row", gap: 12 },
  rowItem: { flex: 1 },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "600", marginBottom: 10 },
  empty: { color: colors.textMute, fontSize: 13, marginBottom: 8 },
  reqCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 4, padding: 14, gap: 6,
  },
  reqHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reqDates: { color: colors.text, fontSize: 14, fontWeight: "600" },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 2, borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  reqReason: { color: colors.textDim, fontSize: 13 },
  reqNotes: { color: colors.textMute, fontSize: 12, fontStyle: "italic" },
  cancelBtn: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  cancelText: { color: colors.red, fontSize: 12, fontWeight: "600" },
});
