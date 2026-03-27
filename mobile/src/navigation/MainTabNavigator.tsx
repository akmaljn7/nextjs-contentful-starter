import React from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { useCartStore } from '../store';
import {
  MainTabParamList,
  HomeStackParamList,
  ExploreStackParamList,
  OrdersStackParamList,
  ProfileStackParamList,
} from '../types/navigation';

// Home Stack Screens
import { HomeScreen } from '../screens/home/HomeScreen';
import { SearchScreen } from '../screens/home/SearchScreen';

// Explore Stack Screens
import { ExploreScreen } from '../screens/explore/ExploreScreen';
import { InfluencersScreen } from '../screens/influencers/InfluencersScreen';
import { InfluencerDetailScreen } from '../screens/influencers/InfluencerDetailScreen';
import { BillboardsScreen } from '../screens/billboards/BillboardsScreen';
import { BillboardDetailScreen } from '../screens/billboards/BillboardDetailScreen';
import { DigitalAdsScreen } from '../screens/digitalAds/DigitalAdsScreen';
import { DigitalAdDetailScreen } from '../screens/digitalAds/DigitalAdDetailScreen';
import { KannywoodScreen } from '../screens/kannywood/KannywoodScreen';
import { KannywoodDetailScreen } from '../screens/kannywood/KannywoodDetailScreen';
import { ConsultationScreen } from '../screens/consultation/ConsultationScreen';

// Cart Screen
import { CartScreen } from '../screens/cart/CartScreen';

// Orders Stack Screens
import { OrdersScreen } from '../screens/orders/OrdersScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { OrderTrackingScreen } from '../screens/orders/OrderTrackingScreen';
import { MessagesScreen } from '../screens/messages/MessagesScreen';
import { ChatScreen } from '../screens/messages/ChatScreen';

// Profile Stack Screens
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { AboutScreen } from '../screens/profile/AboutScreen';
import { HelpSupportScreen } from '../screens/profile/HelpSupportScreen';
import { AdminScreen } from '../screens/admin/AdminScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const ExploreStack = createNativeStackNavigator<ExploreStackParamList>();
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();

// Stack screen options
const stackScreenOptions = {
  headerStyle: {
    backgroundColor: Colors.primary,
  },
  headerTintColor: Colors.white,
  headerTitleStyle: {
    fontWeight: Fonts.weight.semibold as any,
    fontSize: Fonts.size.lg,
  },
  headerBackTitleVisible: false,
  headerBackVisible: true,
  contentStyle: { backgroundColor: Colors.background },
};

// Home Stack Navigator
const HomeStackNavigator = () => (
  <HomeStack.Navigator screenOptions={stackScreenOptions}>
    <HomeStack.Screen 
      name="Home" 
      component={HomeScreen} 
      options={{ headerShown: false }}
    />
    <HomeStack.Screen 
      name="Search" 
      component={SearchScreen}
      options={{ title: 'Search' }}
    />
  </HomeStack.Navigator>
);

// Custom back button component for detail screens
const DetailBackButton = ({ fallbackScreen }: { fallbackScreen: string }) => {
  const navigation = useNavigation<any>();
  return (
    <TouchableOpacity
      onPress={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        } else {
          // Navigate to the fallback screen if can't go back
          navigation.navigate(fallbackScreen);
        }
      }}
      style={{ marginLeft: Platform.OS === 'ios' ? 0 : -8, padding: 8 }}
    >
      <Ionicons name="arrow-back" size={24} color={Colors.white} />
    </TouchableOpacity>
  );
};

// Explore Stack Navigator
const ExploreStackNavigator = () => (
  <ExploreStack.Navigator screenOptions={stackScreenOptions}>
    <ExploreStack.Screen 
      name="Explore" 
      component={ExploreScreen} 
      options={{ headerShown: false }}
    />
    <ExploreStack.Screen 
      name="Influencers" 
      component={InfluencersScreen}
      options={{ 
        title: 'Influencers',
        headerLeft: () => <DetailBackButton fallbackScreen="Explore" />,
      }}
    />
    <ExploreStack.Screen 
      name="InfluencerDetail" 
      component={InfluencerDetailScreen}
      options={{ 
        title: 'Influencer',
        headerLeft: () => <DetailBackButton fallbackScreen="Influencers" />,
      }}
    />
    <ExploreStack.Screen 
      name="Billboards" 
      component={BillboardsScreen}
      options={{ 
        title: 'Billboards',
        headerLeft: () => <DetailBackButton fallbackScreen="Explore" />,
      }}
    />
    <ExploreStack.Screen 
      name="BillboardDetail" 
      component={BillboardDetailScreen}
      options={{ 
        title: 'Billboard',
        headerLeft: () => <DetailBackButton fallbackScreen="Billboards" />,
      }}
    />
    <ExploreStack.Screen 
      name="DigitalAds" 
      component={DigitalAdsScreen}
      options={{ 
        title: 'Digital Ads',
        headerLeft: () => <DetailBackButton fallbackScreen="Explore" />,
      }}
    />
    <ExploreStack.Screen 
      name="DigitalAdDetail" 
      component={DigitalAdDetailScreen}
      options={{ 
        title: 'Digital Ad',
        headerLeft: () => <DetailBackButton fallbackScreen="DigitalAds" />,
      }}
    />
    <ExploreStack.Screen 
      name="Kannywood" 
      component={KannywoodScreen}
      options={{ 
        title: 'Kannywood',
        headerLeft: () => <DetailBackButton fallbackScreen="Explore" />,
      }}
    />
    <ExploreStack.Screen 
      name="KannywoodDetail" 
      component={KannywoodDetailScreen}
      options={{ 
        title: 'Production',
        headerLeft: () => <DetailBackButton fallbackScreen="Kannywood" />,
      }}
    />
    <ExploreStack.Screen 
      name="Consultation" 
      component={ConsultationScreen}
      options={{ 
        title: 'Get a Consultation',
        headerLeft: () => <DetailBackButton fallbackScreen="Explore" />,
      }}
    />
  </ExploreStack.Navigator>
);

// Orders Stack Navigator
const OrdersStackNavigator = () => (
  <OrdersStack.Navigator screenOptions={stackScreenOptions}>
    <OrdersStack.Screen 
      name="Orders" 
      component={OrdersScreen} 
      options={{ title: 'My Orders' }}
    />
    <OrdersStack.Screen 
      name="OrderDetail" 
      component={OrderDetailScreen}
      options={{ title: 'Order Details' }}
    />
    <OrdersStack.Screen 
      name="OrderTracking" 
      component={OrderTrackingScreen}
      options={{ title: 'Order Tracking' }}
    />
    <OrdersStack.Screen 
      name="Messages" 
      component={MessagesScreen}
      options={{ title: 'Messages' }}
    />
    <OrdersStack.Screen 
      name="Chat" 
      component={ChatScreen}
      options={{ title: 'Chat' }}
    />
  </OrdersStack.Navigator>
);

// Profile Stack Navigator
const ProfileStackNavigator = () => (
  <ProfileStack.Navigator screenOptions={stackScreenOptions}>
    <ProfileStack.Screen 
      name="Profile" 
      component={ProfileScreen} 
      options={{ headerShown: false }}
    />
    <ProfileStack.Screen 
      name="Settings" 
      component={SettingsScreen}
      options={{ title: 'Settings' }}
    />
    <ProfileStack.Screen 
      name="About" 
      component={AboutScreen}
      options={{ title: 'About' }}
    />
    <ProfileStack.Screen 
      name="HelpSupport" 
      component={HelpSupportScreen}
      options={{ title: 'Help & Support' }}
    />
    <ProfileStack.Screen 
      name="AdminPanel" 
      component={AdminScreen}
      options={{ title: 'Admin Panel' }}
    />
  </ProfileStack.Navigator>
);

// Main Tab Navigator
export const MainTabNavigator: React.FC = () => {
  const cartItems = useCartStore((state) => state.items);
  const cartCount = cartItems.length;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarLabelStyle: {
          fontSize: Fonts.size.xs,
          fontWeight: Fonts.weight.medium,
          marginTop: 4,
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          switch (route.name) {
            case 'HomeTab':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'ExploreTab':
              iconName = focused ? 'compass' : 'compass-outline';
              break;
            case 'CartTab':
              iconName = focused ? 'cart' : 'cart-outline';
              break;
            case 'OrdersTab':
              iconName = focused ? 'receipt' : 'receipt-outline';
              break;
            case 'ProfileTab':
              iconName = focused ? 'person' : 'person-outline';
              break;
          }

          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="HomeTab" 
        component={HomeStackNavigator}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen 
        name="ExploreTab" 
        component={ExploreStackNavigator}
        options={{ tabBarLabel: 'Explore' }}
      />
      <Tab.Screen 
        name="CartTab" 
        component={CartScreen}
        options={{ 
          tabBarLabel: 'Cart',
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: Colors.accent,
            fontSize: 10,
          },
        }}
      />
      <Tab.Screen 
        name="OrdersTab" 
        component={OrdersStackNavigator}
        options={{ tabBarLabel: 'Orders' }}
      />
      <Tab.Screen 
        name="ProfileTab" 
        component={ProfileStackNavigator}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
};
