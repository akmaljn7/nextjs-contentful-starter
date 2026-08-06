import React from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle, StyleProp,
} from "react-native";
import { colors } from "@/theme";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props {
  onPress?: () => void;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  icon?: React.ReactNode;
}

/**
 * Primary tap target. Follows the web dashboard's ethos:
 * flat, sharp corners, high contrast, deliberate spacing.
 */
export function Button({
  onPress, label, loading, disabled, variant = "primary", style, testID, icon,
}: Props) {
  const styles = getStyles(variant);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{ color: "rgba(255,255,255,0.1)" }}
      style={({ pressed }) => [
        styles.base,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        (disabled || loading) && { opacity: 0.4 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#000" : colors.text} />
      ) : (
        <>
          {icon}
          <Text style={styles.label}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const getStyles = (variant: Variant) =>
  StyleSheet.create({
    base: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 2,
      borderWidth: variant === "ghost" ? 1 : 0,
      borderColor: variant === "ghost" ? colors.border : "transparent",
      backgroundColor:
        variant === "primary" ? colors.text
          : variant === "danger" ? colors.red
          : variant === "secondary" ? colors.surface2
          : "transparent",
    },
    label: {
      color:
        variant === "primary" ? "#000"
          : variant === "danger" ? colors.text
          : colors.text,
      fontSize: 15,
      fontWeight: "600",
      letterSpacing: 0.2,
    },
  });
