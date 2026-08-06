/**
 * Admin: Team management — Phase 5 CRUD.
 *
 * Lists all employees in the org with:
 *   - Create new (name/email/password/office)
 *   - Edit (name/office reassignment)
 *   - Delete (soft delete with confirm)
 *   - Assigned/unassigned badge for quick triage
 */
import React, { useMemo, useState } from "react";
import {
  Text, View, StyleSheet, ScrollView, RefreshControl, Pressable, Modal, Alert,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { api, apiError } from "@/api/client";
import { colors } from "@/theme";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  office_id: string | null;
  created_at?: string;
  last_login_at?: string | null;
}

interface Office {
  id: string;
  name: string;
}

interface DraftEmployee {
  id?: string;
  name: string;
  email: string;
  password: string;
  office_id: string | null;
}

export default function AdminTeamScreen() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DraftEmployee | null>(null);

  const employees = useQuery<Employee[]>({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
  });
  const offices = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: async () => (await api.get("/offices")).data,
    staleTime: 60_000,
  });

  const create = useMutation({
    mutationFn: async (d: DraftEmployee) =>
      (await api.post("/employees", {
        name: d.name, email: d.email, password: d.password,
        office_id: d.office_id, schedule: { mode: "any" },
      })).data,
    onSuccess: () => {
      Alert.alert("✅ Created", "Employee added. Ask them to install the app and sign in.");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setEditing(null);
    },
    onError: (e) => Alert.alert("Couldn't create", apiError(e)),
  });
  const update = useMutation({
    mutationFn: async (d: DraftEmployee) =>
      (await api.patch(`/employees/${d.id}`, {
        name: d.name, office_id: d.office_id, schedule: { mode: "any" },
      })).data,
    onSuccess: () => {
      Alert.alert("✅ Saved", "Employee updated.");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setEditing(null);
    },
    onError: (e) => Alert.alert("Couldn't save", apiError(e)),
  });
  const del = useMutation({
    mutationFn: async (id: string) =>
      (await api.delete(`/employees/${id}`)).data,
    onSuccess: () => {
      Alert.alert("✅ Removed", "Employee removed.");
      qc.invalidateQueries({ queryKey: ["employees"] });
      setEditing(null);
    },
    onError: (e) => Alert.alert("Couldn't remove", apiError(e)),
  });

  const officeNameById = useMemo(() => {
    const m: Record<string, string> = {};
    (offices.data || []).forEach((o) => (m[o.id] = o.name));
    return m;
  }, [offices.data]);

  const startCreate = () => {
    const firstOffice = offices.data?.[0]?.id ?? null;
    setEditing({ name: "", email: "", password: "", office_id: firstOffice });
  };

  const startEdit = (e: Employee) => {
    setEditing({ id: e.id, name: e.name, email: e.email, password: "", office_id: e.office_id });
  };

  const confirmDelete = (e: Employee) => {
    Alert.alert(
      `Remove ${e.name}?`,
      "They'll lose access immediately. Attendance history is preserved.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => del.mutate(e.id) },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={employees.isFetching} onRefresh={employees.refetch} tintColor={colors.green} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Team</Text>
            <Text style={styles.sub}>{(employees.data || []).length} employee(s)</Text>
          </View>
          <Pressable onPress={startCreate} style={styles.newBtn} testID="new-emp-btn">
            <Ionicons name="add" size={18} color="#000" />
            <Text style={styles.newBtnLabel}>New</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
          {(employees.data || []).length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyLabel}>NO TEAM MEMBERS</Text>
              <Text style={styles.emptyBody}>
                Add your first employee above. They'll receive login credentials from you and install the mobile app.
              </Text>
            </View>
          )}
          {(employees.data || []).map((e) => (
            <Pressable key={e.id} onPress={() => startEdit(e)} testID={`emp-row-${e.id}`}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{e.name}</Text>
                  <Text style={styles.email}>{e.email}</Text>
                  <Text style={styles.assignment}>
                    {e.office_id ? `📍 ${officeNameById[e.office_id] || "Unknown office"}` : "🚫 No office assigned"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMute} />
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <EmployeeEditModal
        draft={editing}
        offices={offices.data || []}
        onClose={() => setEditing(null)}
        onSave={(d) => (d.id ? update.mutate(d) : create.mutate(d))}
        onDelete={(id) => confirmDelete({ id, name: editing?.name || "", email: "", role: "employee", office_id: null } as Employee)}
        busy={create.isPending || update.isPending || del.isPending}
      />
    </Screen>
  );
}

interface EmpEditProps {
  draft: DraftEmployee | null;
  offices: Office[];
  onClose: () => void;
  onSave: (d: DraftEmployee) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}

function EmployeeEditModal({ draft, offices, onClose, onSave, onDelete, busy }: EmpEditProps) {
  const [local, setLocal] = useState<DraftEmployee | null>(draft);
  React.useEffect(() => { setLocal(draft); }, [draft?.id, draft?.name, draft?.email]);

  if (!draft || !local) return null;
  const isNew = !local.id;
  const canSave = local.name.trim() && local.office_id && (!isNew || (local.email.trim() && local.password.length >= 8));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <Screen scroll>
        <View style={{ paddingTop: 32 }}>
          <Pressable onPress={onClose} testID="emp-close">
            <Text style={styles.back}>‹ CANCEL</Text>
          </Pressable>
          <Text style={styles.title}>{isNew ? "New employee" : "Edit employee"}</Text>
          <Text style={styles.sub}>
            {isNew
              ? "They'll receive these credentials and install the mobile app."
              : "Change name, office, or remove access."}
          </Text>

          <View style={{ marginTop: 24 }}>
            <Input
              testID="emp-name"
              label="Full name"
              value={local.name}
              onChangeText={(v) => setLocal({ ...local, name: v })}
              placeholder="Adaeze Okonkwo"
            />
            {isNew && (
              <Input
                testID="emp-email"
                label="Work email"
                value={local.email}
                onChangeText={(v) => setLocal({ ...local, email: v })}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="adaeze@company.com"
              />
            )}
            {isNew && (
              <Input
                testID="emp-password"
                label="Initial password (min 8 chars)"
                value={local.password}
                onChangeText={(v) => setLocal({ ...local, password: v })}
                secureTextEntry
                placeholder="••••••••"
              />
            )}
            {!isNew && (
              <View style={styles.readonlyRow}>
                <Text style={styles.readonlyLabel}>EMAIL</Text>
                <Text style={styles.readonlyValue}>{local.email}</Text>
              </View>
            )}

            <Text style={styles.selectLabel}>ASSIGN TO OFFICE</Text>
            <View style={styles.officeGrid}>
              {offices.map((o) => {
                const sel = o.id === local.office_id;
                return (
                  <Pressable
                    key={o.id}
                    testID={`emp-office-${o.id}`}
                    onPress={() => setLocal({ ...local, office_id: o.id })}
                    style={[styles.officeChip, sel && styles.officeChipActive]}
                  >
                    <Text style={[styles.officeChipLabel, sel && { color: "#000" }]}>{o.name}</Text>
                  </Pressable>
                );
              })}
            </View>
            {!offices.length && (
              <Text style={styles.warning}>
                No offices yet — create one first from the Offices tab.
              </Text>
            )}
          </View>

          <View style={{ marginTop: 24 }}>
            <Button
              testID="emp-save"
              label={busy ? "Saving…" : (isNew ? "Create employee" : "Save changes")}
              loading={busy}
              disabled={!canSave || busy}
              onPress={() => onSave(local)}
            />
            {!isNew && (
              <Button
                testID="emp-delete"
                label="Remove employee"
                variant="danger"
                onPress={() => onDelete(local.id!)}
                style={{ marginTop: 12 }}
              />
            )}
          </View>
        </View>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row", alignItems: "flex-end", gap: 12,
    paddingHorizontal: 24, paddingTop: 32,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 4, letterSpacing: 0.5 },
  newBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.green, paddingHorizontal: 12, paddingVertical: 8,
  },
  newBtnLabel: { color: "#000", fontWeight: "700", letterSpacing: 0.5, fontSize: 13 },

  row: {
    flexDirection: "row", alignItems: "center", padding: 16,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, marginBottom: 8,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  email: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  assignment: { color: colors.textDim, fontSize: 11, marginTop: 6, letterSpacing: 0.3 },

  emptyCard: {
    padding: 20, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, marginTop: 8,
  },
  emptyLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 6, fontWeight: "600" },
  emptyBody: { color: colors.text, fontSize: 13, lineHeight: 20 },

  back: { color: colors.textDim, fontSize: 11, letterSpacing: 2, marginBottom: 12 },
  readonlyRow: { marginBottom: 20 },
  readonlyLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 6, fontWeight: "500" },
  readonlyValue: { color: colors.text, fontSize: 14 },

  selectLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 10, fontWeight: "500" },
  officeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  officeChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  officeChipActive: { backgroundColor: colors.green, borderColor: colors.green },
  officeChipLabel: { color: colors.text, fontSize: 13 },
  warning: { color: colors.amber, fontSize: 12, marginTop: 12, lineHeight: 18 },
});
