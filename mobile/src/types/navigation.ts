import { NavigatorScreenParams } from '@react-navigation/native';

// Auth Stack
export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token: string };
};

// Main Tab Navigator
export type MainTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  ExploreTab: NavigatorScreenParams<ExploreStackParamList>;
  CartTab: undefined;
  OrdersTab: NavigatorScreenParams<OrdersStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

// Home Stack
export type HomeStackParamList = {
  Home: undefined;
  Search: { query?: string };
  SearchResults: { query: string };
  Notifications: undefined;
};

// Explore Stack
export type ExploreStackParamList = {
  Explore: undefined;
  Influencers: undefined;
  InfluencerDetail: { id: string };
  Billboards: undefined;
  BillboardDetail: { id: string; type: string };
  BillboardPackages: { 
    type: string;
    state_id: string;
    road_name: string;
    size_id?: string;
    type_id?: string;
    billboard_type_id?: string;
  };
  DigitalAds: undefined;
  DigitalAdDetail: { id: string };
  Kannywood: undefined;
  KannywoodDetail: { id: string };
  Consultation: undefined;
};

// Orders Stack
export type OrdersStackParamList = {
  Orders: undefined;
  OrderDetail: { id: string };
  OrderTracking: { id: string };
  Messages: undefined;
  Chat: { conversationId: string; orderId?: string };
};

// Profile Stack
export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  AdminPanel: undefined;
};

// Root Navigator
export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

// Utility type for screen props
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
