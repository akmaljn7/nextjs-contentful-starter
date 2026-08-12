import "react-native-gesture-handler";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { AuthProvider } from "@/context/AuthContext";
import { ChallengeProvider } from "@/context/ChallengeContext";
import { RootNavigator } from "@/navigation/RootNavigator";
import { ChallengeModal } from "@/components/ChallengeModal";
import { queryClient } from "@/lib/queryClient";
// Side-effect imports: register global TaskManager tasks at cold-start so
// the OS can wake them from geofence transitions AND from BOOT_COMPLETED.
import "@/services/geofence";
import "@/services/bootTask";

/**
 * Root component. Wires the top-level providers in the order:
 *   GestureHandler → SafeArea → ReactQuery → Auth → Challenge → Navigation.
 *
 * The Navigation stack decides whether to render the AuthStack (login) or
 * the EmployeeRoot / AdminStack based on `useAuth()` role.
 * ChallengeModal sits above the navigator so it can appear over any screen.
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0a0a0a" }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ChallengeProvider>
              <StatusBar style="light" />
              <RootNavigator />
              <ChallengeModal />
            </ChallengeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
