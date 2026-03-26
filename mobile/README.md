# Lightban Mobile App

A cross-platform mobile application for the Lightban Ads Network marketplace, built with React Native and Expo.

## Features

- **Authentication**: Login, Register, Forgot Password
- **Home Screen**: Featured influencers, billboards, categories
- **Explore**: Browse Influencers, Billboards, Digital Ads, Kannywood
- **Shopping Cart**: Add packages, checkout with online/cash payment
- **Orders**: View order history, order details, tracking
- **Profile**: User profile, settings, admin access (for admins)
- **Push Notifications**: Expo Push Notifications support

## Tech Stack

- **Framework**: React Native with Expo SDK 50
- **Navigation**: React Navigation 6 (Stack + Bottom Tabs)
- **State Management**: Zustand
- **API Client**: Axios
- **Secure Storage**: Expo SecureStore
- **Icons**: @expo/vector-icons (Ionicons)

## Project Structure

```
/app/mobile/
├── App.tsx                 # Main app entry
├── app.json                # Expo configuration
├── eas.json                # EAS Build configuration
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── babel.config.js         # Babel config
├── .env                    # Environment variables
└── src/
    ├── api/                # API layer (axios client, endpoints)
    ├── components/         # Reusable components
    │   ├── common/         # Button, Input, Card, etc.
    │   ├── cards/          # InfluencerCard, BillboardCard, etc.
    │   └── forms/          # Form components
    ├── constants/          # Colors, fonts, config
    ├── hooks/              # Custom React hooks
    ├── navigation/         # Navigation setup
    ├── screens/            # All app screens
    │   ├── auth/           # Login, Register, ForgotPassword
    │   ├── home/           # Home, Search
    │   ├── explore/        # Explore screen
    │   ├── influencers/    # Influencer list & detail
    │   ├── billboards/     # Billboard list & detail
    │   ├── digitalAds/     # Digital Ads screens
    │   ├── kannywood/      # Kannywood screens
    │   ├── consultation/   # Consultation booking
    │   ├── cart/           # Shopping cart
    │   ├── orders/         # Order list & detail
    │   ├── messages/       # Messaging screens
    │   ├── profile/        # Profile & settings
    │   └── admin/          # Admin panel
    ├── store/              # Zustand stores (auth, cart, settings)
    ├── types/              # TypeScript types
    └── utils/              # Utilities (storage, formatters, validators)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)

### Installation

```bash
# Navigate to mobile directory
cd /app/mobile

# Install dependencies
npm install
# or
yarn install

# Start development server
npm start
# or
yarn start
```

### Running on Devices

1. **Expo Go (Recommended for development)**
   - Install Expo Go on your Android/iOS device
   - Scan the QR code from the terminal
   - App will load on your device

2. **Android Emulator**
   ```bash
   npm run android
   ```

3. **iOS Simulator (Mac only)**
   ```bash
   npm run ios
   ```

## Configuration

### Environment Variables

Create a `.env` file in the mobile directory:

```env
# Backend API URL
API_URL=https://ads-kano.preview.emergentagent.com/api

# For production
# API_URL=https://api.lightban.com/api
```

### API URL Configuration

The app connects to your existing Lightban backend. Update the `API_URL` in `.env` to point to your backend server.

## Building for Production

### Using EAS Build (Recommended)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure project (first time only)
eas build:configure

# Build for Android (APK)
eas build --platform android --profile preview

# Build for iOS
eas build --platform ios --profile preview

# Build for both platforms
eas build --platform all --profile production
```

### Build Profiles

- **development**: Development build with dev client
- **preview**: Internal testing (APK for Android, Simulator for iOS)
- **production**: Production build (AAB for Play Store, IPA for App Store)

## Publishing to App Stores

### Google Play Store

1. Build production AAB:
   ```bash
   eas build --platform android --profile production
   ```

2. Download the AAB from Expo dashboard

3. Upload to Google Play Console

### Apple App Store

1. Build production IPA:
   ```bash
   eas build --platform ios --profile production
   ```

2. Submit directly from EAS:
   ```bash
   eas submit --platform ios
   ```

## Testing

### Test Credentials

```
Email: admin@lightban.com
Password: LightbanAdmin2024
```

### Test User Flow

1. Login with test credentials
2. Browse categories (Influencers, Billboards)
3. View listing details
4. Add packages to cart
5. Checkout (Pay Online / Pay at Office)
6. View order in Orders tab

## Customization

### Branding

Update brand colors in `/src/constants/colors.ts`:

```typescript
export const Colors = {
  primary: '#0d1b2a',      // Your primary color
  accent: '#ff6b35',       // Your accent color
  // ...
};
```

### App Icon & Splash Screen

Replace these files in `/src/assets/`:
- `icon.png` (1024x1024)
- `splash.png` (1284x2778)
- `adaptive-icon.png` (1024x1024)

## Support

For issues or questions, contact: support@lightban.com

## License

Copyright 2024 Lightban Technology. All rights reserved.
