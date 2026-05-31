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

### Meta App Review (In Progress)
- Temporary changes applied to hide simulated data for Meta review screencast
- See `/app/META_REVIEW_REVERT_GUIDE.md` for revert instructions
- Budget currency changed from USD to Naira (NGN) - PERMANENT

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

### Mobile App Config (v1.1.7)
- iOS: bundleIdentifier `com.adlinka.ads`, buildNumber `15`
- Android: package `com.adlinka.app`, versionCode `13`
- EAS projectId: `166884d9-115c-4d83-a792-43664e6b47f3`

### In Progress 🟡
None currently

### Upcoming Tasks (P1)
- Connect real Meta Ads API for AdGlobe
- Add Meta App credentials in Admin panel
- Implement Termii SMS notifications

### Future/Backlog (P2)
- Refactor monolithic `server.py` (>5000 lines)
- Refactor `AdminPanelPage.js` into components
- Refactor `meta-ads-globe.html` (>1400 lines)

## Key DB Schema
- `orders`: `{ ..., admin_priority: int }`
- `users`: `{ ..., registration_ip: string }`

## Critical Notes
- **Mobile API URL**: Use `https://adlinka.com/api` (NOT www. - causes 308 redirect that strips auth headers)
- **Expo SDK**: Must stay on SDK 54
- **Bot Attack**: Active credential stuffing attack (pattern: `Dg54asdkfoda+-`) - protection in place

## Test Credentials
- Admin: `admin@lightban.com` / `LightbanAdmin2024`
