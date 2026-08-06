import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme";

export default function EmployeeHistoryScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.sub}>
          Your past attendance records will appear here in Phase 2.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 48 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700" },
  sub: { color: colors.textDim, marginTop: 6, fontSize: 13 },
});
