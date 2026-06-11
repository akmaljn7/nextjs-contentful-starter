# Adlinka - Ads Network Marketplace PRD

## Original Problem Statement
Create a polished, conversion-focused, responsive marketplace website and cross-platform mobile application (React Native/Expo) for an ads network ("Adlinka"). The platform connects advertisers with suppliers (influencers, billboard owners, digital ads, Kannywood).

## Core Requirements
- Public Pages & Authenticated Dashboards
- Mobile App sharing backend with web
- Paystack/Termii/HubSpot Integrations
- Bilingual support (English/Hausa)
- Push Notifications
- Google/Apple Sign-In
- Custom 3D AdGlobe (Meta Ads simulation)

## Tech Stack
- **Frontend**: React, TailwindCSS, CesiumJS (3D Maps), Dnd-kit
- **Backend**: FastAPI, MongoDB
- **Mobile**: React Native, Expo SDK 54, EAS Build System
- **Integrations**: Paystack (Live), Open-Meteo API, OpenStreetMap/Nominatim

## Current Status (December 2025)

### Kannywood "Fully Booked" Feature ✅ (Just Completed - Dec 29, 2025)
Similar to the influencer "Busy" feature, Kannywood productions can now be marked as fully booked:

**Backend:**
- Added `is_fully_booked` field to `KannywoodPlacement` model
- `PATCH /api/admin/kannywood/{kannywood_id}/fully-booked` - Admin toggle endpoint
- GET `/api/kannywood` now returns `is_fully_booked` in response

**Web Implementation:**
- Admin Panel: Toggle button in Kannywood tab to mark productions as fully booked
- `KannywoodPage.js`: Red "FULLY BOOKED" diagonal overlay on production cards + disabled button
- `KannywoodDetailPage.js`: Status badge and disabled package selection

**Mobile Implementation (iOS/Android):**
- `KannywoodScreen.tsx`: Fully booked overlay on cards with grayed-out button
- `KannywoodDetailScreen.tsx`: Overlay, status tag, and notice when fully booked
- `PackageCard.tsx`: Added `disabled` prop to prevent cart additions
- `api.ts`: Added `is_fully_booked` to `KannywoodProduction` type

### Order Media Upload Feature ✅ (Completed - Dec 10, 2025)
Users can now upload ad content (photos/videos/links) for their orders:

**Web Implementation:**
- `OrderMediaUpload.jsx` component created with compact & full views
- Dashboard orders now show "Ad Media (X)" section with upload buttons
- OrderTrackingPage has dedicated "Your Ad Content" section
- Admin Panel order modal displays all uploaded media
- PlaceOrderPage updated: "Confirm & Upload Media" button text
- After cash payment confirmation, redirects to dashboard with upload prompt

**Mobile Implementation (iOS/Android):**
- `OrderMediaUpload.tsx` component with ImagePicker integration
- OrderCard shows media count and upload buttons
- OrderDetailScreen has full media upload section
- API methods added: `uploadMedia`, `addMediaLink`, `deleteMedia`

**Backend:**
- `ad_media` field added to Order model
- `POST /api/orders/{order_id}/media` - Upload image/video
- `POST /api/orders/{order_id}/media/link` - Add link
- `DELETE /api/orders/{order_id}/media/{index}` - Delete media
- Files stored in `/app/backend/uploads/order_media/{order_id}/`

### Dual-Mode AdGlobe Implementation ✅ (Dec 10, 2025)
Two separate AdGlobe routes created to satisfy both Meta App Review requirements and client presentation needs:

**Meta Review Mode** (`/admin/meta-ads-globe`) - For Meta App Reviewers:
- ❌ No Header/Footer (clean, focused interface)
- ❌ No Back Arrow (prevents navigation away)
- ❌ No Settings Tab (only core campaign tabs)
- ❌ No Multi-Platform Selector (Meta-only)
- ❌ No Post Up Feature (influencer reposting hidden)
- ❌ No Stats Panel in Globe (population/reach data hidden)
- ✅ Auto-triggers Login Modal on page load
- ✅ URL: `/admin/meta-ads-globe` (registered with Meta)

**Full Features Mode** (`/admin/platforms-ads-globe`) - For Client Presentations:
- ✅ Full Header/Footer visible
- ✅ Back Arrow for navigation
- ✅ Settings Tab present
- ✅ Multi-Platform Selector (Meta, TikTok, Google, Snapchat, YouTube)
- ✅ Post Up By Feature for influencer reposting
- ✅ Full Stats Panel with population, reach, weather, local time
- ✅ URL: `/admin/platforms-ads-globe`
- ✅ Admin Panel "AdGlobe" button links here

### Meta App Review Integration
- Budget currency: Nigerian Naira (NGN) - PERMANENT
- Added 3 features for Meta permissions:
  1. "My Campaigns" tab (ads_read)
  2. Facebook Page selector (pages_show_list)
  3. Ad Account selector (business_management)
- Real Facebook Business Login SDK with redirect-based OAuth (config_id: 1018089424501122)
- **REAL META API INTEGRATION**: Pages, Ad Accounts, and Campaigns fetch from real Graph API
- Special Ad Category compliance (Housing, Employment, Financial, Politics)
- "Paid for by" Disclaimer selection for political ads
- Campaign Objectives restricted to "Awareness"/"Engagement" when Buying Type is "Reserved"

### Completed Features ✅
- Full web platform with public/authenticated pages
- Admin Panel with drag-and-drop order prioritization
- 3D AdGlobe with Nigerian state/LGA population data (774+ LGAs)
- Real-time "Est. Online Now" calculations based on local time
- Bot protection on registration endpoint
- Bulk spam user deletion feature
- Mobile app with Google/Apple Sign-In
- Push notifications (Expo)
- Fixed mobile auth bug (WWW redirect stripping headers)
- **Multi-Platform Ad Publishing UI** (Meta, TikTok, Google, Snapchat, YouTube)
- **Influencer "Busy" Feature**: Admin toggle, web blur overlay, mobile app blur overlay
- AdGlobe improvements: Age/Gender/Languages targeting, Buying Type, smart Nigeria search
- Silent Meta login bypass shortcut: `Ctrl+Shift+B`
- iOS App Store link: https://apps.apple.com/us/app/adlinka/id6761537846
- **REAL Meta Graph API Integration** for Pages, Ad Accounts, Campaigns

### Mobile App Config (v1.1.7)
- iOS: bundleIdentifier `com.adlinka.ads`, buildNumber `15`
- Android: package `com.adlinka.app`, versionCode `13`
- EAS projectId: `166884d9-115c-4d83-a792-43664e6b47f3`
- **Dependencies**: expo-blur@15.0.8, expo-font@14.0.12 (SDK 54 compatible)
- **TypeScript**: All checks passing (18/18 expo-doctor checks pass)

### In Progress 🟡
None currently

### Upcoming Tasks (P1)
- Implement Termii SMS notifications

### Future/Backlog (P2)
- Integrate real APIs for TikTok, Google, Snapchat, YouTube platforms
- Refactor monolithic `server.py` (>5000 lines)
- Refactor `AdminPanelPage.js` into components
- Refactor `MetaAdsGlobePage.js` (>2900 lines)
- Refactor `meta-ads-globe.html` (>2300 lines)

## Key DB Schema
- `orders`: `{ ..., admin_priority: int, ad_media: [{ type, url, thumbnail_url, name }] }`
- `users`: `{ ..., registration_ip: string }`
- `influencers`: `{ ..., is_busy: bool }` - Added for influencer availability toggle
- `kannywood_placements`: `{ ..., is_fully_booked: bool }` - Added for production availability

## Critical Notes
- **Mobile API URL**: Use `https://adlinka.com/api` (NOT www. - causes 308 redirect that strips auth headers)
- **Expo SDK**: Must stay on SDK 54
- **Bot Attack**: Active credential stuffing attack (pattern: `Dg54asdkfoda+-`) - protection in place
- **Campaign Submission**: MOCKED (2-second delay simulation) - not real POST to Meta API

## Test Credentials
- Admin: `admin@lightban.com` / `LightbanAdmin2024`
- Meta Login Bypass: `Ctrl+Shift+B` (uses demo data)
