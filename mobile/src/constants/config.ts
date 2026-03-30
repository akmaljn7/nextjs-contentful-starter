// API Configuration
// Use preview URL for testing, change to production for release
export const API_URL = process.env.API_URL || 'https://www.lightban.com/api';

// Uncomment below line to test with preview environment:
// export const API_URL = 'https://ads-kano.preview.emergentagent.com/api';

// App Configuration
export const Config = {
  // API
  api: {
    baseUrl: API_URL,
    timeout: 30000, // 30 seconds
  },
  
  // Storage Keys
  storage: {
    authToken: 'adlinka_auth_token',
    user: 'adlinka_user',
    cart: 'adlinka_cart',
    settings: 'adlinka_settings',
    pushToken: 'adlinka_push_token',
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
    channelId: 'adlinka-notifications',
    channelName: 'Adlinka Notifications',
  },
  
  // App Info
  app: {
    name: 'Adlinka',
    version: '1.0.0',
    supportEmail: 'support@adlinka.com',
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
  ConsultationDetail: 'ConsultationDetail',
  
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
