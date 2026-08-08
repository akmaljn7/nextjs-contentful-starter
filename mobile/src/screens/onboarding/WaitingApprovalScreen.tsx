/**
 * Waiting-for-approval screen. Shown when an employee logs in from a device
 * that isn't their bound device — the manager must approve the new device
 * before the app unlocks. Polls device status so it auto-unblocks on approval.
 */
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme";

export default function WaitingApprovalScreen({ rejected }: { rejected?: boolean }) {
  const { signOut } = useAuth();
  return (
    <Screen>
      <View style={styles.wrap} testID="device-approval-screen">
        <Ionicons
          name={rejected ? "close-circle" : "phone-portrait"}
          size={56}
          color={rejected ? colors.red : colors.amber}
        />
        <Text style={styles.title}>{rejected ? "Device not approved" : "New device — pending approval"}</Text>
        <Text style={styles.sub}>
          {rejected
            ? "Your manager declined this device. Please use your registered phone, or ask your manager to reset your device binding."
            : "For security, your account is tied to one phone. Your manager needs to approve this new device before you can continue."}
        </Text>
        {!rejected && (
          <View style={styles.spinnerRow}>
            <ActivityIndicator color={colors.green} />
            <Text style={styles.waiting}>Waiting for approval…</Text>
          </View>
        )}
        <Button label="Sign out" variant="ghost" onPress={signOut} style={{ marginTop: 24 }} testID="device-approval-signout" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 14 },
  title: { color: colors.text, fontSize: 22, fontWeight: "700", textAlign: "center" },
  sub: { color: colors.textDim, fontSize: 14, textAlign: "center", lineHeight: 21 },
  spinnerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  waiting: { color: colors.textDim, fontSize: 13 },
});
