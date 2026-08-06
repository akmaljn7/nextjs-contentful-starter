/**
 * Admin: Reports & attendance history — Phase 5.
 *
 * Two panels:
 *   1. Live summary — /api/attendance/summary counts (offices, employees, active,
 *      paused, total records, flagged).
 *   2. Recent records — /api/attendance/records with employee/office filter chips
 *      and inline record cards showing outcome, hours, flagged state.
 *
 * CSV/PDF exports live on the web dashboard for now (mobile can't do
 * blob-to-file without an extra plugin — deferred to a later polish pass).
 */
import React, { useMemo, useState } from "react";
import { Text, View, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/Screen";
import { api } from "@/api/client";
import { colors } from "@/theme";

interface Summary {
  total_offices: number;
  total_employees: number;
  active_sessions: number;
  paused_sessions: number;
  total_records: number;
  flagged_records: number;
}

interface Record {
  id: string;
  employee_name: string;
  office_name: string;
  started_at: string;
  ended_at: string;
  outcome: string;
  total_inside_ms: number;
  bout_count: number;
  flagged: boolean;
}

interface Employee { id: string; name: string; office_id: string | null }

function fmtHours(ms: number): string {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  const mm = (m % 60).toString().padStart(2, "0");
  return `${h}h ${mm}m`;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function AdminReportsScreen() {
  const [filterUserId, setFilterUserId] = useState<string | null>(null);

  const summary = useQuery<Summary>({
    queryKey: ["attendance-summary"],
    queryFn: async () => (await api.get("/attendance/summary")).data,
    refetchInterval: 30_000,
  });

  const employees = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
    staleTime: 60_000,
  });

  const records = useQuery<Record[]>({
    queryKey: ["attendance-records", filterUserId],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (filterUserId) params.user_id = filterUserId;
      return (await api.get("/attendance/records", { params })).data;
    },
  });

  const busy = summary.isFetching || records.isFetching;

  return (
    <Screen>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={busy}
            onRefresh={() => { summary.refetch(); records.refetch(); }}
            tintColor={colors.green}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 32 }}>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.sub}>Live summary + attendance history.</Text>

          {/* Summary cards */}
          <View style={styles.statGrid}>
            <StatCard label="ACTIVE" value={summary.data?.active_sessions ?? 0} color={colors.green} testID="rep-active" />
            <StatCard label="PAUSED" value={summary.data?.paused_sessions ?? 0} color={colors.amber} testID="rep-paused" />
            <StatCard label="EMPLOYEES" value={summary.data?.total_employees ?? 0} color={colors.blue} testID="rep-employees" />
            <StatCard label="OFFICES" value={summary.data?.total_offices ?? 0} color={colors.blue} testID="rep-offices" />
            <StatCard label="TOTAL RECORDS" value={summary.data?.total_records ?? 0} color={colors.text} testID="rep-total" />
            <StatCard label="FLAGGED" value={summary.data?.flagged_records ?? 0} color={colors.red} testID="rep-flagged" />
          </View>

          {/* Filter chips */}
          <Text style={styles.sectionLabel}>FILTER BY EMPLOYEE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <FilterChip
              label="Everyone"
              active={!filterUserId}
              onPress={() => setFilterUserId(null)}
              testID="filter-all"
            />
            {(employees.data || []).map((e) => (
              <FilterChip
                key={e.id}
                label={e.name.split(" ")[0]}
                active={filterUserId === e.id}
                onPress={() => setFilterUserId(e.id === filterUserId ? null : e.id)}
                testID={`filter-emp-${e.id}`}
              />
            ))}
          </ScrollView>

          {/* Records list */}
          <Text style={styles.sectionLabel}>RECENT RECORDS</Text>
          {(records.data || []).length === 0 && !records.isFetching && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyLabel}>NO RECORDS YET</Text>
              <Text style={styles.emptyBody}>
                Completed and expired attendance sessions will appear here.
              </Text>
            </View>
          )}
          {(records.data || []).map((r) => (
            <View key={r.id} style={styles.recordCard} testID={`record-${r.id}`}>
              <View style={styles.recordHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordName}>{r.employee_name}</Text>
                  <Text style={styles.recordMeta}>{r.office_name}</Text>
                </View>
                <Text style={[styles.outcomePill, outcomeStyle(r.outcome)]}>
                  {r.outcome.toUpperCase()}
                </Text>
              </View>
              <View style={styles.recordFooter}>
                <View>
                  <Text style={styles.recordFooterLabel}>STARTED</Text>
                  <Text style={styles.recordFooterValue}>{fmtDate(r.started_at)}</Text>
                </View>
                <View>
                  <Text style={styles.recordFooterLabel}>HOURS</Text>
                  <Text style={styles.recordFooterValue}>{fmtHours(r.total_inside_ms)}</Text>
                </View>
                {r.flagged && (
                  <View style={styles.flaggedBadge}>
                    <Ionicons name="warning" size={11} color={colors.red} />
                    <Text style={styles.flaggedLabel}>FLAGGED</Text>
                  </View>
                )}
              </View>
            </View>
          ))}

          <View style={styles.exportFooter}>
            <Ionicons name="download-outline" size={16} color={colors.textDim} />
            <Text style={styles.exportFooterText}>
              CSV / PDF exports available on the web dashboard.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function StatCard({ label, value, color, testID }: { label: string; value: number; color: string; testID?: string }) {
  return (
    <View style={styles.statCard} testID={testID}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FilterChip({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable onPress={onPress} testID={testID} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipLabel, active && { color: "#000" }]}>{label}</Text>
    </Pressable>
  );
}

function outcomeStyle(outcome: string) {
  switch (outcome) {
    case "completed": return { color: colors.green, borderColor: colors.green };
    case "expired": return { color: colors.red, borderColor: colors.red };
    case "reset": return { color: colors.textMute, borderColor: colors.textMute };
    case "logout": return { color: colors.blue, borderColor: colors.blue };
    default: return { color: colors.textDim, borderColor: colors.border };
  }
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 4, letterSpacing: 0.5 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  statCard: {
    minWidth: "30%", flexGrow: 1,
    padding: 12, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1,
  },
  statValue: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  statLabel: { color: colors.textDim, fontSize: 9, letterSpacing: 1.4, marginTop: 4, fontWeight: "600" },

  sectionLabel: {
    color: colors.textDim, fontSize: 10, letterSpacing: 2,
    marginTop: 24, marginBottom: 12, fontWeight: "600",
  },

  chipRow: { flexDirection: "row", gap: 6, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.green, borderColor: colors.green },
  chipLabel: { color: colors.text, fontSize: 12 },

  emptyCard: {
    padding: 20, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1,
  },
  emptyLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 6, fontWeight: "600" },
  emptyBody: { color: colors.text, fontSize: 13, lineHeight: 20 },

  recordCard: {
    padding: 14, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1, marginBottom: 8,
  },
  recordHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  recordName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  recordMeta: { color: colors.textDim, fontSize: 11, marginTop: 2 },
  outcomePill: {
    fontSize: 9, letterSpacing: 1.6, fontWeight: "700",
    paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1,
  },
  recordFooter: {
    flexDirection: "row", gap: 20, marginTop: 12,
    borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, alignItems: "flex-end",
  },
  recordFooterLabel: { color: colors.textMute, fontSize: 9, letterSpacing: 1.5, fontWeight: "600" },
  recordFooterValue: { color: colors.text, fontSize: 12, marginTop: 3, fontFamily: "Menlo" },
  flaggedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginLeft: "auto",
  },
  flaggedLabel: { color: colors.red, fontSize: 10, letterSpacing: 1.4, fontWeight: "700" },

  exportFooter: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 24, padding: 12, borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface,
  },
  exportFooterText: { color: colors.textDim, fontSize: 12 },
});
