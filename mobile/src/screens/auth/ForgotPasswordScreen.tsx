import React, { useState } from "react";
import { Text, View, StyleSheet, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import * as authApi from "@/api/auth";
import { apiError } from "@/api/client";
import { colors } from "@/theme";

export default function ForgotPasswordScreen() {
  const nav = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (e) {
      setError(apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={{ paddingTop: 48 }}>
        <Pressable onPress={() => nav.goBack()} testID="forgot-back">
          <Text style={styles.back}>‹ BACK</Text>
        </Pressable>
        <Text style={styles.h1}>Forgot password</Text>
        <Text style={styles.sub}>
          We'll email you a link to reset it, if we recognise this address.
        </Text>

        {sent ? (
          <View style={styles.done} testID="forgot-sent">
            <Text style={styles.doneLabel}>CHECK YOUR EMAIL</Text>
            <Text style={styles.doneMsg}>
              If an account exists for {email}, a reset link is on its way.
            </Text>
            <Button label="Back to sign in" onPress={() => nav.navigate("Login")} style={{ marginTop: 24 }} />
          </View>
        ) : (
          <View style={{ marginTop: 32 }}>
            <Input
              testID="forgot-email"
              label="Work email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@company.com"
              error={error || undefined}
            />
            <Button
              testID="forgot-submit"
              label={busy ? "Sending…" : "Send reset link"}
              onPress={submit}
              loading={busy}
              disabled={!email}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { color: colors.textDim, fontSize: 11, letterSpacing: 2, marginBottom: 24 },
  h1: { color: colors.text, fontSize: 28, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 6, lineHeight: 20 },
  done: { marginTop: 40, padding: 20, borderColor: colors.green, borderWidth: 1, backgroundColor: colors.greenSoft },
  doneLabel: { color: colors.green, fontSize: 10, letterSpacing: 2, fontWeight: "600", marginBottom: 6 },
  doneMsg: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
