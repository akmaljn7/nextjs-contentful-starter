import React from "react";
import { StyleSheet, View, ViewStyle, StyleProp, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme";

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Full-height page wrapper that respects safe-area insets. Optional scroll.
 */
export function Screen({ children, scroll, style, contentStyle, testID }: Props) {
  const Inner = (
    <View style={[styles.inner, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={["top", "bottom"]} style={[styles.safe, style]} testID={testID}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          {Inner}
        </ScrollView>
      ) : (
        Inner
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, paddingHorizontal: 24 },
});
