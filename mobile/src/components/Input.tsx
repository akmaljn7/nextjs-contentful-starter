import React, { useState } from "react";
import {
  StyleSheet, Text, TextInput, TextInputProps, View,
} from "react-native";
import { colors } from "@/theme";

interface Props extends TextInputProps {
  label: string;
  error?: string;
  testID?: string;
}

/**
 * Underlined dark-theme input with a floating-esque label above the field
 * and an error slot below. Uses the same visual language as the web dashboard.
 */
export function Input({ label, error, testID, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <TextInput
        testID={testID}
        {...rest}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        placeholderTextColor={colors.textMute}
        style={[
          styles.input,
          focused && { borderBottomColor: colors.green },
          error && { borderBottomColor: colors.red },
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 20 },
  label: {
    color: colors.textDim,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
    fontWeight: "500",
  },
  input: {
    color: colors.text,
    fontSize: 16,
    paddingVertical: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
  },
  error: {
    color: colors.red,
    fontSize: 12,
    marginTop: 6,
  },
});
