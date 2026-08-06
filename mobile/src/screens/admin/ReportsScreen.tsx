import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme";

export default function AdminReportsScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Reports</Text>
        <Text style={styles.sub}>CSV / PDF exports arrive in Phase 5.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 48 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 6 },
});
