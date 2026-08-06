import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import PermissionsScreen from "@/screens/onboarding/PermissionsScreen";
import { EmployeeStack } from "@/navigation/EmployeeStack";

export type EmployeeRootParamList = {
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<EmployeeRootParamList>();

/**
 * Wraps the employee tab navigator with an onboarding gate. When permissions
 * are missing we present PermissionsScreen; once granted we swap to the
 * main tab navigator. We check permissions on mount.
 */
export function EmployeeRoot() {
  const [ready, setReady] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    (async () => {
      const fg = await Location.getForegroundPermissionsAsync();
      // Foreground is the minimum needed to boot into the app; background
      // is nice-to-have and gets nudged later via the health chip.
      setReady(fg.status === "granted");
    })();
  }, []);

  if (ready === null) return null; // brief flash — RootNavigator loader covers this

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      {ready ? (
        <Stack.Screen name="Main" component={EmployeeStack} />
      ) : (
        <Stack.Screen name="Onboarding">
          {() => <PermissionsScreen onGranted={() => setReady(true)} />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}
