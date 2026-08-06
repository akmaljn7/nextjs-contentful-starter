import React from "react";
import { Text, View, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/Screen";
import { api } from "@/api/client";
import { colors } from "@/theme";

export default function AdminTeamScreen() {
  const emps = useQuery<any[]>({
    queryKey: ["employees"],
    queryFn: async () => (await api.get("/employees")).data,
  });
  return (
    <Screen>
      <ScrollView
        refreshControl={<RefreshControl refreshing={emps.isFetching} onRefresh={emps.refetch} tintColor={colors.green} />}
        contentContainerStyle={{ paddingTop: 48, paddingBottom: 40 }}
      >
        <Text style={styles.title}>Team</Text>
        <Text style={styles.sub}>{emps.data?.length || 0} employee(s)</Text>
        <View style={{ marginTop: 20 }}>
          {(emps.data || []).map((e) => (
            <View key={e.id} style={styles.row} testID={`emp-row-${e.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{e.name}</Text>
                <Text style={styles.email}>{e.email}</Text>
              </View>
              <Text style={styles.badge}>{e.office_id ? "ASSIGNED" : "NO OFFICE"}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 4, letterSpacing: 0.5 },
  row: {
    flexDirection: "row", alignItems: "center", padding: 16,
    backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, marginBottom: 8,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  email: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  badge: { color: colors.textDim, fontSize: 10, letterSpacing: 2, fontWeight: "600" },
});
