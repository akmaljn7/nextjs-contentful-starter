import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

import EmployeeHomeScreen from "@/screens/employee/HomeScreen";
import EmployeeHistoryScreen from "@/screens/employee/HistoryScreen";
import EmployeeProfileScreen from "@/screens/employee/ProfileScreen";
import MyColleagueScreen from "@/screens/employee/MyColleagueScreen";
import { colors } from "@/theme";

export type EmployeeTabParamList = {
  Home: undefined;
  Colleague: undefined;
  History: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<EmployeeTabParamList>();

export function EmployeeStack() {
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
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500", letterSpacing: 0.4 },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: "home",
            Colleague: "people",
            History: "time",
            Profile: "person",
          };
          return <Ionicons name={map[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={EmployeeHomeScreen} />
      <Tab.Screen name="Colleague" component={MyColleagueScreen} options={{ tabBarLabel: "Colleague" }} />
      <Tab.Screen name="History" component={EmployeeHistoryScreen} />
      <Tab.Screen name="Profile" component={EmployeeProfileScreen} />
    </Tab.Navigator>
  );
}
