/**
 * Admin: Offices management — Phase 5 (upgraded from P4 edit-only).
 *
 * List all offices with:
 *   - Create new (name + tap-map-to-place + radius)
 *   - Edit existing (radius adjust + re-tap map to move — full parity with web draggable pin)
 *   - Delete with confirm
 */
import React, { useState, useMemo } from "react";
import {
  Text, View, StyleSheet, ScrollView, RefreshControl, Pressable, Modal, Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MapView, { Circle, Marker, MapPressEvent, LatLng } from "react-native-maps";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { api, apiError } from "@/api/client";
import { colors } from "@/theme";

interface Office {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
}

interface OfficeDraft {
  id?: string;
  name: string;
  lat: number | null;
  lng: number | null;
  radius_meters: number;
}

export default function AdminOfficesScreen() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<OfficeDraft | null>(null);

  const offices = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: async () => (await api.get("/offices")).data,
  });

  const save = useMutation({
    mutationFn: async (o: OfficeDraft) => {
      if (o.id) {
        return (await api.patch(`/offices/${o.id}`, {
          name: o.name, radius_meters: o.radius_meters, lat: o.lat, lng: o.lng,
        })).data;
      }
      return (await api.post("/offices", {
        name: o.name, radius_meters: o.radius_meters, lat: o.lat, lng: o.lng,
      })).data;
    },
    onSuccess: () => {
      Alert.alert("✅ Saved", "Office updated. Active sessions will reflect the change on the next event.");
      qc.invalidateQueries({ queryKey: ["offices"] });
      setEditing(null);
    },
    onError: (e) => Alert.alert("Couldn't save", apiError(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/offices/${id}`)).data,
    onSuccess: () => {
      Alert.alert("✅ Removed", "Office removed.");
      qc.invalidateQueries({ queryKey: ["offices"] });
      setEditing(null);
    },
    onError: (e) => Alert.alert("Couldn't remove", apiError(e)),
  });

  const startCreate = () => {
    setEditing({ name: "", lat: null, lng: null, radius_meters: 150 });
  };
  const startEdit = (o: Office) => {
    setEditing({ id: o.id, name: o.name, lat: o.lat, lng: o.lng, radius_meters: o.radius_meters });
  };
  const confirmDelete = (id: string, name: string) => {
    Alert.alert(
      `Remove "${name}"?`,
      "Employees assigned to this office will lose their geofence. History is preserved.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => del.mutate(id) },
      ],
    );
  };

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={offices.isFetching} onRefresh={offices.refetch} tintColor={colors.green} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Offices</Text>
            <Text style={styles.sub}>Tap to edit · pull to refresh</Text>
          </View>
          <Pressable onPress={startCreate} style={styles.newBtn} testID="new-office-btn">
            <Ionicons name="add" size={18} color="#000" />
            <Text style={styles.newBtnLabel}>New</Text>
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 8 }}>
          {(offices.data || []).length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyLabel}>NO OFFICES</Text>
              <Text style={styles.emptyBody}>
                Create your first office above — tap the map inside the modal to set the exact location.
              </Text>
            </View>
          )}
          {(offices.data || []).map((o) => (
            <Pressable key={o.id} onPress={() => startEdit(o)} testID={`office-row-${o.id}`}>
              <View style={styles.card}>
                <Text style={styles.name}>{o.name}</Text>
                <Text style={styles.meta}>
                  {o.lat.toFixed(5)}, {o.lng.toFixed(5)}  ·  r={o.radius_meters}m
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <OfficeEditModal
        draft={editing}
        onClose={() => setEditing(null)}
        onSave={(d) => save.mutate(d)}
        onDelete={(id, name) => confirmDelete(id, name)}
        busy={save.isPending || del.isPending}
      />
    </Screen>
  );
}

interface OfficeEditProps {
  draft: OfficeDraft | null;
  onClose: () => void;
  onSave: (o: OfficeDraft) => void;
  onDelete: (id: string, name: string) => void;
  busy: boolean;
}

function OfficeEditModal({ draft, onClose, onSave, onDelete, busy }: OfficeEditProps) {
  const [local, setLocal] = useState<OfficeDraft | null>(draft);
  React.useEffect(() => { setLocal(draft); }, [draft?.id, draft?.name]);

  if (!draft || !local) return null;
  const isNew = !local.id;

  const initial = useMemo(() => ({
    latitude: local.lat ?? 0,
    longitude: local.lng ?? 0,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  }), [local.id]);

  const onMapTap = (e: MapPressEvent) => {
    const c: LatLng = e.nativeEvent.coordinate;
    setLocal({ ...local, lat: c.latitude, lng: c.longitude });
  };

  const useMyLocation = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Location denied", "Enable location in Settings to auto-fill your position.");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setLocal({ ...local, lat: loc.coords.latitude, lng: loc.coords.longitude });
  };

  const hasCoords = local.lat !== null && local.lng !== null;
  const canSave = local.name.trim() && hasCoords && local.radius_meters >= 30;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ height: 300 }}>
          {hasCoords ? (
            <MapView
              style={{ flex: 1 }}
              initialRegion={initial}
              onPress={onMapTap}
              testID="office-map"
            >
              <Circle
                center={{ latitude: local.lat!, longitude: local.lng! }}
                radius={local.radius_meters}
                strokeColor={colors.green}
                strokeWidth={2}
                fillColor="rgba(16,185,129,0.12)"
              />
              <Marker
                coordinate={{ latitude: local.lat!, longitude: local.lng! }}
                pinColor="green"
                draggable
                onDragEnd={(e) => setLocal({ ...local, lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
              />
            </MapView>
          ) : (
            <View style={styles.emptyMap}>
              <Ionicons name="map-outline" size={44} color={colors.textDim} />
              <Text style={styles.emptyMapText}>Tap "Use my location" or a spot on the map to set the office.</Text>
              <Button label="Use my current location" onPress={useMyLocation} testID="use-my-location" />
            </View>
          )}
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
          <Pressable onPress={onClose} testID="office-close">
            <Text style={styles.back}>‹ CANCEL</Text>
          </Pressable>
          <Text style={styles.title}>{isNew ? "New office" : "Edit office"}</Text>
          <Text style={styles.sub}>
            {hasCoords ? "Drag the pin or tap the map to reposition. Adjust the radius below." : "Set a location to continue."}
          </Text>

          <View style={{ marginTop: 20 }}>
            <Input
              testID="office-name"
              label="Office name"
              value={local.name}
              onChangeText={(v) => setLocal({ ...local, name: v })}
              placeholder="HQ Lagos"
            />
            <Input
              testID="office-radius"
              label="Radius (meters, min 30)"
              value={String(local.radius_meters)}
              onChangeText={(v) => setLocal({ ...local, radius_meters: Number(v) || 0 })}
              keyboardType="number-pad"
              placeholder="150"
            />
            {hasCoords && (
              <View style={styles.readonlyRow}>
                <Text style={styles.readonlyLabel}>COORDINATES</Text>
                <Text style={styles.readonlyValue}>
                  {local.lat!.toFixed(6)}, {local.lng!.toFixed(6)}
                </Text>
              </View>
            )}
            {hasCoords && (
              <Button label="Use my current location" variant="ghost" onPress={useMyLocation} testID="use-my-location-2" />
            )}
          </View>

          <Button
            testID="office-save"
            label={busy ? "Saving…" : (isNew ? "Create office" : "Save changes")}
            loading={busy}
            disabled={!canSave || busy}
            onPress={() => onSave(local)}
            style={{ marginTop: 20 }}
          />
          {!isNew && (
            <Button
              testID="office-delete"
              label="Remove office"
              variant="danger"
              onPress={() => onDelete(local.id!, local.name)}
              style={{ marginTop: 12 }}
            />
          )}
          <Text style={styles.tip}>
            Tip: iOS ignores geofences smaller than 50m. Aim for 100-300m unless you have iBeacons.
          </Text>
        </ScrollView>
      </View>
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

  card: {
    padding: 16, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1, marginBottom: 8,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 6, fontFamily: "Menlo", letterSpacing: 0.5 },

  emptyCard: {
    padding: 20, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1, marginTop: 8,
  },
  emptyLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 6, fontWeight: "600" },
  emptyBody: { color: colors.text, fontSize: 13, lineHeight: 20 },

  emptyMap: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16,
    backgroundColor: colors.surface,
  },
  emptyMapText: { color: colors.textDim, fontSize: 13, textAlign: "center", lineHeight: 20 },

  back: { color: colors.textDim, fontSize: 11, letterSpacing: 2, marginBottom: 12 },
  readonlyRow: { marginBottom: 20 },
  readonlyLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 6, fontWeight: "500" },
  readonlyValue: { color: colors.text, fontSize: 13, fontFamily: "Menlo" },
  tip: { color: colors.textMute, fontSize: 11, marginTop: 16, lineHeight: 16 },
});
