import React from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { useAuth, isAdminRole } from "@/context/AuthContext";
import { AuthStack } from "@/navigation/AuthStack";
import { EmployeeRoot } from "@/navigation/EmployeeRoot";
import { AdminStack } from "@/navigation/AdminStack";
import { colors } from "@/theme";

const NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.green,
  },
};

/**
 * Top-level navigator — swaps between AuthStack (login) and the two
 * role-specific stacks based on the current session. Same login screen
 * feeds both flows, matching the web dashboard's UX.
 */
export function RootNavigator() {
  const { user, hydrating } = useAuth();

  if (hydrating) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={NAV_THEME}>
      {!user ? <AuthStack /> : isAdminRole(user.role) ? <AdminStack /> : <EmployeeRoot />}
    </NavigationContainer>
  );
}
