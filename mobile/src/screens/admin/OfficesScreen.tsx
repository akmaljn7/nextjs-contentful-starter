/**
 * Admin: offices list + basic edit.
 *
 * Full CRUD (create / delete) lives in the web dashboard for now. Mobile
 * gets read-only + adjust radius, which is the most common on-the-go need.
 */
import React, { useState } from "react";
import { Text, View, StyleSheet, ScrollView, RefreshControl, Pressable, Modal, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MapView, { Circle, Marker } from "react-native-maps";

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
  timezone?: string;
}

export default function AdminOfficesScreen() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Office | null>(null);

  const offices = useQuery<Office[]>({
    queryKey: ["offices"],
    queryFn: async () => (await api.get("/offices")).data,
  });

  const save = useMutation({
    mutationFn: async (o: Office) =>
      (await api.patch(`/offices/${o.id}`, {
        name: o.name, radius_meters: o.radius_meters,
        lat: o.lat, lng: o.lng,
      })).data,
    onSuccess: () => {
      Alert.alert("✅ Saved", "Office updated. All active sessions will reflect the change on next event.");
      qc.invalidateQueries({ queryKey: ["offices"] });
      setEditing(null);
    },
    onError: (e) => Alert.alert("Couldn't save", apiError(e)),
  });

  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={offices.isFetching} onRefresh={offices.refetch} tintColor={colors.green} />}
        contentContainerStyle={{ paddingTop: 32, paddingBottom: 40 }}
      >
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={styles.h1}>Offices</Text>
          <Text style={styles.sub}>Tap an office to adjust its geofence radius.</Text>

          {(offices.data || []).map((o) => (
            <Pressable key={o.id} onPress={() => setEditing(o)} testID={`office-row-${o.id}`}>
              <View style={styles.card}>
                <Text style={styles.name}>{o.name}</Text>
                <Text style={styles.meta}>
                  {o.lat.toFixed(5)}, {o.lng.toFixed(5)}  ·  r={o.radius_meters}m
                </Text>
              </View>
            </Pressable>
          ))}

          {offices.data?.length === 0 && (
            <View style={styles.empty}>
              <Text style={styles.emptyLabel}>NO OFFICES</Text>
              <Text style={styles.emptyBody}>
                Create offices via the web dashboard first — mobile CRUD is on the roadmap.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <OfficeEditModal
        office={editing}
        onClose={() => setEditing(null)}
        onSave={(o) => save.mutate(o)}
        busy={save.isPending}
      />
    </Screen>
  );
}

function OfficeEditModal({
  office, onClose, onSave, busy,
}: { office: Office | null; onClose: () => void; onSave: (o: Office) => void; busy: boolean }) {
  const [radius, setRadius] = useState<string>(office ? String(office.radius_meters) : "");
  React.useEffect(() => {
    if (office) setRadius(String(office.radius_meters));
  }, [office?.id, office?.radius_meters]);

  if (!office) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <MapView
          style={{ height: 240 }}
          initialRegion={{
            latitude: office.lat, longitude: office.lng,
            latitudeDelta: 0.01, longitudeDelta: 0.01,
          }}
        >
          <Circle
            center={{ latitude: office.lat, longitude: office.lng }}
            radius={Number(radius) || office.radius_meters}
            strokeColor={colors.green}
            strokeWidth={2}
            fillColor="rgba(16,185,129,0.12)"
          />
          <Marker
            coordinate={{ latitude: office.lat, longitude: office.lng }}
            title={office.name}
            pinColor="green"
          />
        </MapView>
        <View style={{ padding: 24, flex: 1 }}>
          <Text style={styles.h1}>{office.name}</Text>
          <Text style={styles.sub}>
            Adjust the geofence radius. Changes propagate to all active sessions on next event.
          </Text>
          <Input
            testID="office-edit-radius"
            label="Radius (meters)"
            value={radius}
            onChangeText={setRadius}
            keyboardType="number-pad"
            placeholder="150"
          />
          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <Button
              label="Cancel"
              variant="ghost"
              onPress={onClose}
              style={{ flex: 1 }}
              testID="office-edit-cancel"
            />
            <Button
              label={busy ? "Saving…" : "Save"}
              loading={busy}
              disabled={!radius || Number(radius) < 30}
              onPress={() =>
                onSave({ ...office, radius_meters: Number(radius) })
              }
              style={{ flex: 1 }}
              testID="office-edit-save"
            />
          </View>
          <Text style={styles.tip}>
            Tip: for indoor accuracy, keep radius ≥ 50 m. iOS ignores geofences smaller than that.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text, fontSize: 24, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 6, lineHeight: 20 },
  card: {
    padding: 16, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1,
    marginTop: 12,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 6, fontFamily: "Menlo", letterSpacing: 0.5 },
  empty: {
    marginTop: 20, padding: 20, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: 1,
  },
  emptyLabel: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 6, fontWeight: "600" },
  emptyBody: { color: colors.text, fontSize: 13, lineHeight: 20 },
  tip: { color: colors.textMute, fontSize: 11, marginTop: 16, lineHeight: 16 },
});
