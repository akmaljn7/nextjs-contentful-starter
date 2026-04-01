# Adlinka Ads Network - Product Requirements Document

## Original Problem Statement
Create a polished, conversion-focused, responsive marketplace website for "Adlinka Ads Network" (Northern Nigeria). The platform connects advertisers with suppliers (influencers, billboard owners, etc.). Additionally, build a cross-platform mobile application (React Native/Expo) that seamlessly connects to the existing backend and mirrors the web application's functionality.

## Product Vision
Northern Nigeria's trusted advertising marketplace connecting advertisers with verified suppliers across influencer marketing, billboards, digital ads, and Kannywood film placements.

## User Personas
1. **Advertisers** - Businesses wanting to promote products/services
2. **Suppliers** - Influencers, billboard owners, digital ad platforms, Kannywood producers
3. **Admins** - Platform managers handling approvals, content, and settings

## Core Requirements
- Public Pages: Home, Search, Category Pages, Detail Pages, Campaign Builder, Checkout, Order Tracking
- Authenticated Dashboards for Advertisers, Suppliers, Admins
- Mobile App: Cross-platform Expo React Native app sharing the same backend
- Integrations: Payments (Paystack), Messaging (Termii - pending), CRM (HubSpot - pending)
- Visual Style: Modern, trustworthy, navy blue branding
- Localization: Bilingual support (English and Hausa)

## Tech Stack
- **Backend**: FastAPI, MongoDB (pymongo), Python
- **Web Frontend**: React, TailwindCSS, Zustand, shadcn/ui
- **Mobile**: React Native, Expo SDK 54, React Navigation v7, Zustand, WebView

## What's Been Implemented

### Web Application (Complete)
- Full marketplace with all public pages
- User authentication (JWT)
- Admin panel with content management
- Payment integration (Paystack)
- Order management and tracking
- Messaging center
- Search functionality

### Mobile Application (Complete)
- **Date: December 2024**
- Full app wired to Live Production Backend (https://www.lightban.com/api)
- Auth flow (Login, Register, Forgot Password)
- Home screen with service categories
- Explore screens (Influencers, Billboards, Digital Ads, Kannywood)
- Cart with dynamic platform fee
- Paystack payment via in-app WebView modal
- Order tracking
- Profile and Settings
- Custom splash screen (navy blue #0d1b2a)

### Feature: Apple App Store Compliance (March 2024) ✅
- **Sign in with Apple**: Added Apple authentication option on login screen (iOS only)
- **Account Deletion**: Added "Delete Account" option in Profile screen with double confirmation
- **Payment Disclosure**: Added text clarifying payments are for advertising services (not in-app purchases)
- Backend endpoints: `/api/auth/apple` (Apple sign-in), `/api/auth/account` (DELETE - account deletion)

### Feature: Bulk Order Delete (March 2024) ✅
- Admin can select multiple orders and delete them at once
- Added checkboxes to order list in admin panel
- "Select All" functionality for current page
- Confirmation dialog before bulk deletion

### Feature: Admin Branding Tab (March 2024) ✅
- Added `profile_link` field to backend models (InfluencerCreate, AdminInfluencerCreate/Update)
- Added Profile Link input to Admin Panel influencer form with description
- Made platform badges clickable in mobile app (InfluencerDetailScreen, InfluencerCard)
- Uses React Native `Linking.openURL()` to open external social profile URLs
- Updated 5 influencers in DB with profile links (Abis Fulani, Baddo, G_fresh, Meenal, Maryamaaah_)
- Note: "Abdool gaya" influencer not found in DB - may need to be created

### Feature: Dark Mode (March 2024) ✅
- ThemeContext with `useTheme` hook created at `/app/mobile/src/contexts/ThemeContext.tsx`
- DarkColors defined in `/app/mobile/src/constants/colors.ts`
- Settings store persists theme preference
- Updated screens to use theme colors:
  - SettingsScreen (toggle works)
  - HomeScreen
  - ProfileScreen
  - CartScreen
  - Card component (auto adapts)
  - MainTabNavigator (tab bar colors)

### Feature: Hausa Localization (March 2024) ✅
- Complete i18n system at `/app/mobile/src/i18n/`
- English translations: `/app/mobile/src/i18n/translations/en.ts`
- Hausa translations: `/app/mobile/src/i18n/translations/ha.ts`
- `useTranslation` hook for accessing translations
- I18nProvider wraps the entire app
- Language toggle in Settings screen
- Translations cover:
  - Common UI elements
  - Navigation tabs
  - Auth screens
  - Home screen
  - Services
  - Influencers, Billboards, Digital Ads, Kannywood
  - Cart & Checkout
  - Orders
  - Consultation
  - Profile & Settings
  - Messages
  - Error messages
  - Notifications

### Feature: Push Notifications (March 2024) ✅
- Backend push notification system using Expo Push API
- Push token registration/unregistration endpoints
- Notifications triggered for:
  - All order status changes (pending, confirmed, in_progress, completed, cancelled)
  - Consultation status updates and schedule confirmations
  - New messages (user-to-admin and admin-to-user)
- Mobile app integration:
  - `notificationService.ts` - handles token registration with Expo and backend
  - `InAppNotification.tsx` - animated in-app notification banner
  - Auto-registers push token on login
- In-app banners show for foreground notifications with type-specific icons

### Feature: Admin Branding Tab (March 2024) ✅
- Added new "Branding" tab in Admin Panel for logo management
- **Web Application assets:**
  - Website Logo (Header/Footer)
  - Favicon
- **Mobile Application assets:**
  - App Icon (1024x1024px)
  - Splash Screen Logo
  - Login Screen Logo
  - Notification Icon
- **General Branding:**
  - Primary Logo (Full Color)
  - Logo (White/Light Version for dark backgrounds)
- Web Header/Footer automatically use uploaded web_logo_url
- All uploads use chunked upload system for reliability

### Feature: Rebranding Lightban → Adlinka (March 2024) ✅
- Renamed entire application from "Lightban" to "Adlinka"
- Updated mobile app configuration (`app.json`):
  - App name: "Adlinka"
  - App slug: "adlinka-mobile"
  - Bundle ID: "com.adlinka.ads"
- Generated new App Store assets:
  - splash.png - New Adlinka branding (black background)
  - icon.png - New Adlinka app icon
  - adaptive-icon.png - Android adaptive icon
- Updated all web frontend text references:
  - Header/Footer logos
  - Privacy Policy, Terms of Service, About page
  - Testimonials, Contact page
  - Translations (English and Hausa)
- Mobile app storage keys renamed (e.g., `adlinka_auth_token`)
- **Note:** Database settings (admin panel) still need updating for email/company name

## Bug Fixes (December 2024)
- ✅ Splash screen color matched to web (from #1a3a5c to #0d1b2a)
- ✅ Login screen uses logo image instead of text
- ✅ Billboard API error handling improved for iOS
- ⚠️ Kannywood images - DATA ISSUE (null in database, needs admin upload)

## Bug Fixes (December 2024 - Session 3)
- ✅ Billboard dropdowns fixed for iOS (added key props for re-render)
- ✅ Consultation form now has all fields: Business Stage, Budget Range, Preferred Date/Time
- ✅ App background changed from white to cream/beige `#f5f0e8`
- ✅ Splash screen color updated to `#161433`
- ✅ Admin Kannywood shows all productions from both collections

## Pending Tasks

### P1 (High Priority)
- [ ] Termii SMS integration for notifications
- [ ] Update database settings in admin panel for Adlinka branding (email, company name)

### P2 (Medium Priority)  
- [ ] Kannywood image uploads (admin task)
- [ ] Create "Abdool gaya" influencer in database
- [ ] Add notification navigation (tap notification to go to relevant screen)

### Future/Backlog
- [ ] Refactor `/app/backend/server.py` monolith into routers/services
- [ ] Refactor `/app/frontend/src/pages/AdminPanelPage.js` into components
- [ ] Real-time notifications (WebSocket/email)
- [ ] HubSpot CRM integration

## Key Files Reference
- `/app/mobile/src/api/` - API client and endpoints
- `/app/mobile/src/screens/` - All mobile screens
- `/app/mobile/src/contexts/ThemeContext.tsx` - Dark mode implementation
- `/app/mobile/src/components/SplashScreen.tsx` - Custom splash
- `/app/mobile/app.json` - Expo configuration
- `/app/backend/server.py` - Backend monolith (needs refactoring)

## API Configuration
- Mobile app points to: `https://www.lightban.com/api` (LIVE - domain remains, app rebranded to Adlinka)
- Web preview: Uses preview environment

## Credentials (Testing)
- Admin: `admin@lightban.com` / `LightbanAdmin2024` (domain unchanged for now)
