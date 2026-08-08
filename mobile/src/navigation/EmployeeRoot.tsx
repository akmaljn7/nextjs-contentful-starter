import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import PermissionsScreen from "@/screens/onboarding/PermissionsScreen";
import FaceEnrollScreen from "@/screens/onboarding/FaceEnrollScreen";
import { EmployeeStack } from "@/navigation/EmployeeStack";
import { useAuth } from "@/context/AuthContext";

export type EmployeeRootParamList = {
  Onboarding: undefined;
  FaceEnroll: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<EmployeeRootParamList>();

/**
 * Employee onboarding gate. Order:
 *   1. Mandatory face enrollment (once, after an office is assigned)
 *   2. Location permissions
 *   3. Main tabs
 */
export function EmployeeRoot() {
  const { user } = useAuth();
  const [ready, setReady] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    (async () => {
      const fg = await Location.getForegroundPermissionsAsync();
      setReady(fg.status === "granted");
    })();
  }, []);

  // Strict face enrollment gate — blocks the app until the employee has a
  // baseline (required for selfie + proxy verification).
  const needsFace = user?.role === "employee" && !!user?.office_id && user?.face_enrolled === false;

  if (ready === null) return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      {needsFace ? (
        <Stack.Screen name="FaceEnroll" component={FaceEnrollScreen} />
      ) : ready ? (
        <Stack.Screen name="Main" component={EmployeeStack} />
      ) : (
        <Stack.Screen name="Onboarding">
          {() => <PermissionsScreen onGranted={() => setReady(true)} />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
}
