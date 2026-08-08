import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import PermissionsScreen from "@/screens/onboarding/PermissionsScreen";
import FaceEnrollScreen from "@/screens/onboarding/FaceEnrollScreen";
import WaitingApprovalScreen from "@/screens/onboarding/WaitingApprovalScreen";
import { EmployeeStack } from "@/navigation/EmployeeStack";
import { useAuth } from "@/context/AuthContext";
import { mobile } from "@/api/mobile";
import { getDeviceId } from "@/lib/storage";
import { Platform } from "react-native";

export type EmployeeRootParamList = {
  Onboarding: undefined;
  FaceEnroll: undefined;
  DeviceApproval: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<EmployeeRootParamList>();

type DeviceState = "checking" | "authorized" | "pending" | "rejected";

/**
 * Employee onboarding gate. Order:
 *   1. Device binding (must be an approved device)
 *   2. Mandatory face enrollment (once, after an office is assigned)
 *   3. Location permissions
 *   4. Main tabs
 */
export function EmployeeRoot() {
  const { user } = useAuth();
  const [ready, setReady] = React.useState<boolean | null>(null);
  const [device, setDevice] = React.useState<DeviceState>("checking");

  React.useEffect(() => {
    const fg = async () => {
      const p = await Location.getForegroundPermissionsAsync();
      setReady(p.status === "granted");
    };
    fg();
  }, []);

  // Device binding check + poll while pending.
  React.useEffect(() => {
    if (user?.role !== "employee") { setDevice("authorized"); return; }
    let cancelled = false;
    let timer: any;
    const check = async (bind: boolean) => {
      try {
        const did = await getDeviceId();
        const res = bind
          ? await mobile.deviceBind({ device_id: did, platform: Platform.OS })
          : await mobile.deviceStatus(did);
        if (cancelled) return;
        setDevice(res.status === "authorized" ? "authorized" : res.status === "rejected" ? "rejected" : "pending");
        if (res.status === "pending") timer = setTimeout(() => check(false), 8000);
      } catch {
        if (!cancelled) { setDevice("authorized"); } // fail-open on network errors; server still enforces per-request
      }
    };
    check(true);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [user?.id, user?.role]);

  const needsFace = user?.role === "employee" && !!user?.office_id && user?.face_enrolled === false;

  if (ready === null || device === "checking") return null;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      {device === "pending" || device === "rejected" ? (
        <Stack.Screen name="DeviceApproval">
          {() => <WaitingApprovalScreen rejected={device === "rejected"} />}
        </Stack.Screen>
      ) : needsFace ? (
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
