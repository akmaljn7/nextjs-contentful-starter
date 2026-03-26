# Lightban Ads Network - Product Requirements Document

## Original Problem Statement
Create a polished, conversion-focused, responsive marketplace website for "Lightban Ads Network" (Northern Nigeria). The platform connects advertisers with suppliers (influencers, billboard owners, etc.). Additionally, build a cross-platform mobile application (React Native/Expo) that seamlessly connects to the existing backend and mirrors the web application's functionality.

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
- Localization: Bilingual support (English and Hausa - pending)

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
- Dark mode support (basic implementation)

### Bug Fixes (December 2024)
- ✅ Splash screen color matched to web (from #1a3a5c to #0d1b2a)
- ✅ Login screen uses logo image instead of text
- ✅ Billboard API error handling improved for iOS
- ✅ Dark mode theme context properly implemented
- ⚠️ Kannywood images - DATA ISSUE (null in database, needs admin upload)

## Bug Fixes (December 2024 - Session 2)
- ✅ Settings screen crash fixed (reverted complex theme imports)
- ✅ Splash screen color updated to exact logo color `#1A1F3A`
- ✅ Kannywood mobile images now mapped (same as web frontend)
- ✅ Admin Kannywood tab now shows all 3 productions from both collections
- ✅ Admin can edit/update Kannywood productions including images

## Pending Tasks

### P1 (High Priority)
- [ ] Termii SMS integration for notifications
- [ ] Expand dark mode to all screens

### P2 (Medium Priority)  
- [ ] Hausa localization support
- [ ] Kannywood image uploads (admin task)

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
- Mobile app points to: `https://www.lightban.com/api` (LIVE)
- Web preview: Uses preview environment

## Credentials (Testing)
- Admin: `admin@lightban.com` / `LightbanAdmin2024`
