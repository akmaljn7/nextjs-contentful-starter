import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme";

export default function AdminProfileScreen() {
  const { user, signOut } = useAuth();
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Admin profile</Text>
        <View style={styles.card}>
          <Text style={styles.label}>NAME</Text>
          <Text style={styles.value}>{user?.name}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>EMAIL</Text>
          <Text style={styles.value}>{user?.email}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>ROLE</Text>
          <Text style={styles.value}>{user?.role}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>ORG ID</Text>
          <Text style={[styles.value, { fontFamily: "Menlo", fontSize: 12 }]}>{user?.org_id}</Text>
        </View>
        <Button
          testID="signout-btn"
          onPress={signOut}
          label="Sign out"
          variant="danger"
          style={{ marginTop: 24 }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 48 },
  title: { color: colors.text, fontSize: 24, fontWeight: "700", marginBottom: 24 },
  card: { padding: 16, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, marginBottom: 12 },
  label: { color: colors.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 4, fontWeight: "600" },
  value: { color: colors.text, fontSize: 15 },
});
