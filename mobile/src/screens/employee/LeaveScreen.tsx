/**
 * Leave / Time-off requests (employee).
 *
 * Employees submit a leave request (date range + reason) via native calendar
 * pickers; admins approve or deny it from the web console or admin app.
 * Approved leave overrides the schedule and blocks attendance on the covered
 * dates. This screen lets the employee submit a request and track its status;
 * pending requests can be cancelled.
 */
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, Platform, Modal } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { timeOff, LeaveRequest } from "@/api/timeOff";
import { apiError } from "@/api/client";
import { colors } from "@/theme";

/** Local-time YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDisplay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const STATUS_META: Record<LeaveRequest["status"], { color: string; soft: string; label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { color: colors.amber, soft: colors.amberSoft, label: "Pending", icon: "time" },
  approved: { color: colors.green, soft: colors.greenSoft, label: "Approved", icon: "checkmark-circle" },
  denied: { color: colors.red, soft: colors.redSoft, label: "Denied", icon: "close-circle" },
};

type PickerTarget = "start" | "end" | null;

export default function LeaveScreen() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [picker, setPicker] = useState<PickerTarget>(null);
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

  const minFor = useCallback((target: Exclude<PickerTarget, null>): Date => {
    if (target === "end" && startDate) return startDate;
    return startOfToday();
  }, [startDate]);

  const onPickerChange = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    const target = picker;
    // Android closes itself; iOS stays open (dismissed via the "Done" button).
    if (Platform.OS !== "ios") setPicker(null);
    if (event.type === "dismissed" || !selected || !target) return;
    if (target === "start") {
      setStartDate(selected);
      // Keep the range valid — pull end forward if it's now before start.
      if (endDate && endDate < selected) setEndDate(selected);
    } else {
      setEndDate(selected);
    }
  }, [picker, endDate]);

  const submit = useCallback(async () => {
    if (!startDate) return Alert.alert("Pick a start date", "Tap “Start date” to choose when your leave begins.");
    if (!endDate) return Alert.alert("Pick an end date", "Tap “End date” to choose when your leave ends.");
    if (endDate < startDate) return Alert.alert("Check dates", "The end date is before the start date.");
    if (!reason.trim()) return Alert.alert("Add a reason", "Please write a short reason for your leave.");

    setBusy(true);
    try {
      await timeOff.create({ start_date: toISODate(startDate), end_date: toISODate(endDate), reason: reason.trim() });
      setStartDate(null); setEndDate(null); setReason("");
      Alert.alert("✅ Request submitted", "Your leave request was sent to your admin for approval.");
      await load();
    } catch (err) {
      Alert.alert("Couldn't submit", apiError(err));
    } finally {
      setBusy(false);
    }
  }, [startDate, endDate, reason, load]);

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

  const pickerValue = picker === "end" ? (endDate || startDate || startOfToday()) : (startDate || startOfToday());

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
            <Pressable style={styles.dateField} onPress={() => setPicker("start")} testID="leave-start-date">
              <Text style={styles.dateFieldLabel}>Start date</Text>
              <View style={styles.dateFieldValueRow}>
                <Ionicons name="calendar-outline" size={15} color={startDate ? colors.green : colors.textMute} />
                <Text style={[styles.dateFieldValue, !startDate && styles.datePlaceholder]}>
                  {startDate ? fmtDisplay(startDate) : "Select date"}
                </Text>
              </View>
            </Pressable>
            <Pressable style={styles.dateField} onPress={() => setPicker("end")} testID="leave-end-date">
              <Text style={styles.dateFieldLabel}>End date</Text>
              <View style={styles.dateFieldValueRow}>
                <Ionicons name="calendar-outline" size={15} color={endDate ? colors.green : colors.textMute} />
                <Text style={[styles.dateFieldValue, !endDate && styles.datePlaceholder]}>
                  {endDate ? fmtDisplay(endDate) : "Select date"}
                </Text>
              </View>
            </Pressable>
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
                  <Text style={styles.reqNotes}>Admin note: {req.decision_notes}</Text>
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

      {/* --- Native date picker --- */}
      {picker && Platform.OS !== "ios" && (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          minimumDate={minFor(picker)}
          onChange={onPickerChange}
        />
      )}
      {Platform.OS === "ios" && (
        <Modal visible={!!picker} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPicker(null)}>
            <Pressable style={styles.modalSheet} onPress={() => undefined}>
              <Text style={styles.modalTitle}>{picker === "end" ? "End date" : "Start date"}</Text>
              <DateTimePicker
                value={pickerValue}
                mode="date"
                display="spinner"
                themeVariant="dark"
                textColor={colors.text}
                minimumDate={picker ? minFor(picker) : startOfToday()}
                onChange={onPickerChange}
              />
              <Button testID="leave-date-done" label="Done" onPress={() => setPicker(null)} />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 20, gap: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 14, marginBottom: 16 },
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 4, padding: 16, gap: 12, marginBottom: 20,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  row: { flexDirection: "row", gap: 12 },
  dateField: {
    flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: 3, paddingHorizontal: 12, paddingVertical: 10, gap: 6,
  },
  dateFieldLabel: { color: colors.textMute, fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  dateFieldValueRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateFieldValue: { color: colors.text, fontSize: 13, fontWeight: "500", flexShrink: 1 },
  datePlaceholder: { color: colors.textMute, fontWeight: "400" },
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
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 8,
  },
  modalTitle: { color: colors.text, fontSize: 15, fontWeight: "600", textAlign: "center", marginBottom: 4 },
});
