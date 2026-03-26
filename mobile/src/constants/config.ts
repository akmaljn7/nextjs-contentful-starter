// API Configuration
export const API_URL = process.env.API_URL || 'https://ads-kano.preview.emergentagent.com/api';

// App Configuration
export const Config = {
  // API
  api: {
    baseUrl: API_URL,
    timeout: 30000, // 30 seconds
  },
  
  // Storage Keys
  storage: {
    authToken: 'lightban_auth_token',
    user: 'lightban_user',
    cart: 'lightban_cart',
    settings: 'lightban_settings',
    pushToken: 'lightban_push_token',
  },
  
  // Pagination
  pagination: {
    defaultLimit: 20,
    maxLimit: 100,
  },
  
  // Image Upload
  imageUpload: {
    maxSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    quality: 0.8,
  },
  
  // Push Notifications
  notifications: {
    channelId: 'lightban-notifications',
    channelName: 'Lightban Notifications',
  },
  
  // App Info
  app: {
    name: 'Lightban Ads',
    version: '1.0.0',
    supportEmail: 'support@lightban.com',
    supportPhone: '+234 800 000 0000',
  },
};

// Navigation Screen Names
export const Screens = {
  // Auth
  Login: 'Login',
  Register: 'Register',
  ForgotPassword: 'ForgotPassword',
  ResetPassword: 'ResetPassword',
  
  // Main Tabs
  Home: 'Home',
  Explore: 'Explore',
  Cart: 'Cart',
  Orders: 'Orders',
  Profile: 'Profile',
  
  // Billboards
  Billboards: 'Billboards',
  BillboardDetail: 'BillboardDetail',
  BillboardPackages: 'BillboardPackages',
  
  // Influencers
  Influencers: 'Influencers',
  InfluencerDetail: 'InfluencerDetail',
  
  // Digital Ads
  DigitalAds: 'DigitalAds',
  DigitalAdDetail: 'DigitalAdDetail',
  
  // Kannywood
  Kannywood: 'Kannywood',
  KannywoodDetail: 'KannywoodDetail',
  
  // Consultation
  Consultation: 'Consultation',
  
  // Orders
  OrderDetail: 'OrderDetail',
  OrderTracking: 'OrderTracking',
  
  // Messages
  Messages: 'Messages',
  Chat: 'Chat',
  
  // Profile
  Settings: 'Settings',
  EditProfile: 'EditProfile',
  
  // Admin
  AdminPanel: 'AdminPanel',
  
  // Search
  Search: 'Search',
  SearchResults: 'SearchResults',
};
