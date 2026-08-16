import React, { useState } from "react";
import {
  Text, View, StyleSheet, Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Screen } from "@/components/Screen";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { useAuth } from "@/context/AuthContext";
import { colors } from "@/theme";

/**
 * Single unified login for both employee and admin. Role-based routing
 * happens in RootNavigator once `useAuth().user` is populated.
 */
export default function LoginScreen() {
  const nav = useNavigation<any>();
  const { signIn, loginError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const submit = async () => {
    setInlineError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || "Login failed";
      setInlineError(typeof msg === "string" ? msg : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View
        style={{ flex: 1, justifyContent: "center", paddingVertical: 24 }}
      >
        <View style={styles.brand}>
          <View style={styles.logoDot} />
          <Text style={styles.brandText}>STAYPIN</Text>
          <Text style={styles.brandSubtle}>ATTENDANCE</Text>
        </View>

        <Text style={styles.heading}>Sign in</Text>
        <Text style={styles.subheading}>
          Use the same credentials as the web dashboard.
        </Text>

        <View style={{ marginTop: 32 }}>
          <Input
            testID="login-email"
            label="Work email"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            returnKeyType="next"
          />
          <Input
            testID="login-password"
            label="Password"
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            returnKeyType="go"
            onSubmitEditing={submit}
          />

          {(inlineError || loginError) && (
            <View style={styles.errorBox} testID="login-error">
              <Text style={styles.errorLabel}>SIGN-IN FAILED</Text>
              <Text style={styles.errorMsg}>{inlineError || loginError}</Text>
            </View>
          )}

          <Button
            testID="login-submit"
            onPress={submit}
            label={busy ? "Signing in…" : "Sign in"}
            loading={busy}
            disabled={!email || !password}
          />

          <Pressable
            testID="login-forgot"
            onPress={() => nav.navigate("ForgotPassword")}
            style={{ marginTop: 20, alignSelf: "center" }}
          >
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>
        </View>

        <View style={{ marginTop: 48, alignItems: "center" }}>
          <Text style={styles.footer}>
            Your organisation controls all data.
          </Text>
          <Text style={styles.footer}>
            Location is only used to record attendance.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", marginBottom: 24 },
  logoDot: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.green, marginBottom: 12,
    shadowColor: colors.green, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 },
  },
  brandText: { color: colors.text, fontSize: 12, letterSpacing: 4, fontWeight: "700" },
  brandSubtle: { color: colors.textDim, fontSize: 10, letterSpacing: 6, fontWeight: "500", marginTop: 2 },
  heading: { color: colors.text, fontSize: 28, fontWeight: "700", marginTop: 24, textAlign: "center" },
  subheading: { color: colors.textDim, fontSize: 13, marginTop: 6, textAlign: "center" },
  errorBox: {
    borderColor: colors.red, borderWidth: 1, backgroundColor: colors.redSoft,
    padding: 12, marginBottom: 20,
  },
  errorLabel: {
    color: colors.red, fontSize: 10, letterSpacing: 2, fontWeight: "600", marginBottom: 4,
  },
  errorMsg: { color: colors.text, fontSize: 13, lineHeight: 18 },
  forgot: { color: colors.green, fontSize: 13, letterSpacing: 0.4 },
  footer: { color: colors.textMute, fontSize: 11, textAlign: "center", letterSpacing: 0.6, marginTop: 4 },
});
