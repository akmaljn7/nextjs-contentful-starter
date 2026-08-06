import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import AdminHomeScreen from "@/screens/admin/HomeScreen";
import AdminOfficesScreen from "@/screens/admin/OfficesScreen";
import AdminTeamScreen from "@/screens/admin/TeamScreen";
import AdminReportsScreen from "@/screens/admin/ReportsScreen";
import AdminProfileScreen from "@/screens/admin/ProfileScreen";
import { colors } from "@/theme";

export type AdminTabParamList = {
  LiveMap: undefined;
  Offices: undefined;
  Team: undefined;
  Reports: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

export function AdminStack() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 68,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.textMute,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "500", letterSpacing: 0.4 },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            LiveMap: "location",
            Offices: "business",
            Team: "people",
            Reports: "stats-chart",
            Profile: "person",
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="LiveMap" component={AdminHomeScreen} options={{ tabBarLabel: "Live" }} />
      <Tab.Screen name="Offices" component={AdminOfficesScreen} />
      <Tab.Screen name="Team" component={AdminTeamScreen} />
      <Tab.Screen name="Reports" component={AdminReportsScreen} />
      <Tab.Screen name="Profile" component={AdminProfileScreen} />
    </Tab.Navigator>
  );
}
