import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider } from "@/context/AuthContext";
import { RootNavigator } from "@/navigation/RootNavigator";
import { queryClient } from "@/lib/queryClient";

/**
 * Root component. Wires the top-level providers in the order:
 *   GestureHandler → SafeArea → ReactQuery → Auth → Navigation.
 *
 * The Navigation stack decides whether to render the AuthStack (login) or
 * the EmployeeStack / AdminStack based on `useAuth()` role.
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0a0a0a" }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
