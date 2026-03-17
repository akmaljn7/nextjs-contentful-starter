# Lightban Ads Network - Product Requirements Document

## Overview
A conversion-focused, responsive marketplace website for "Lightban Ads Network" in Northern Nigeria. The platform connects advertisers with suppliers (influencers, billboard owners, Kannywood productions, digital ad services).

## User Personas
- **Advertisers**: Businesses looking to advertise in Northern Nigeria
- **Suppliers**: Influencers, billboard owners, digital agencies, Kannywood producers
- **Admins**: Platform administrators managing listings and orders

## Branding
- **Primary Color**: Dark Navy (#0d1b2a)
- **Accent Color**: Orange (#ff6b35)
- **Logo**: Modern gradient logo (logo_no_background.png)
- **Typography**: Plus Jakarta Sans (headings), Inter (body)

## Tech Stack
- **Frontend**: React, TailwindCSS, Shadcn/UI
- **Backend**: FastAPI, Python
- **Database**: MongoDB
- **State Management**: Zustand
- **Payments**: Paystack (Integrated)

---

## What's Been Implemented

### Core Pages
- [x] Home Page - Hero section, featured categories
- [x] Influencers Page - Grid listing of influencers (6 total)
- [x] Influencer Detail Page - Profile with service packages
- [x] Billboards Page - 3 categories (LED, Static, Lightbox)
- [x] LED Billboard Detail Page - State selector with dynamic pricing for 13 Northern Nigerian locations
- [x] Kannywood Page - Movie/show placement opportunities
- [x] Digital Ads Page - 6 platforms (Facebook, Instagram, TikTok, Snapchat, Google, WhatsApp)
- [x] Digital Ad Detail Page - Real pricing packages for each platform
- [x] Static pages: About, FAQ, Pricing, Contact, Terms, Privacy

### Features
- [x] Theme toggle (Navy/Orange)
- [x] Shopping cart system (Zustand store)
- [x] Complete booking flow: Browse -> Add to Cart -> Place Order
- [x] Order placement with 5-minute countdown modal
- [x] **Paystack Payment Integration** (LIVE - Test Mode)
- [x] Payment callback handling
- [x] User authentication (Register/Login)
- [x] Responsive design

### Influencers (6 Total)
1. G_fresh - TikTok, 450K followers, Comedy & Entertainment
2. Abis Fulani - Instagram, 320K followers, Lifestyle & Travel
3. Baddoo - TikTok, 380K followers, Lifestyle & Fashion
4. Maryamaaah_ - Instagram, 320K followers, Food & Cooking
5. Meenal Ahmad - TikTok, 290K followers, Fashion & Culture
6. Ibrahim Sani - Twitter, 180K followers, Technology & Innovation

### Digital Ads Platforms
1. Facebook Ads - Starting ₦50,000/month
2. Instagram Ads - Starting ₦60,000/month
3. TikTok Ads - Starting ₦75,000/month
4. Snapchat Ads - Starting ₦55,000/month
5. Google Ads - Starting ₦100,000/month
6. WhatsApp Business Ads - Starting ₦45,000/month

### Paystack Integration (March 2026)
- **Status**: LIVE (Test Mode)
- **Public Key**: pk_test_199f72eafd2703277b5d90d76ff6f7b2739686be
- **Endpoints**:
  - POST /api/payments/initialize - Initialize payment
  - GET /api/payments/verify/{reference} - Verify payment
  - POST /api/payments/webhook - Handle Paystack webhooks
  - GET /api/payments/config - Get public key

---

## Pending Issues (P0-P2)

### P1: API Data Integration
- Frontend components use hardcoded data instead of fetching from backend APIs
- InfluencerDetailPage.js, BillboardsPage.js need to fetch dynamic data
- Need to wire up frontend to use `/api/influencers/:id`, `/api/billboards` endpoints

### P2: Backend Authorization Logic
- Some endpoints return 403 instead of 401 for unauthenticated requests
- Need to fix status codes for proper API semantics

---

## Prioritized Backlog

### P1 - High Priority
- [ ] Static Banner Billboard detail page (same pattern as LED)
- [ ] Lightbox Billboard detail page
- [ ] Global search bar with filters (city, category, budget)
- [ ] Fix API data integration - wire frontend to backend APIs

### P2 - Medium Priority
- [ ] Campaign Builder guided questionnaire flow
- [ ] User dashboards (Advertiser, Supplier, Admin)
- [ ] Messaging center between advertisers and suppliers
- [ ] Order tracking page

### P3 - Future/Backlog
- [ ] Switch Paystack to Live Mode (requires business verification)
- [ ] Termii SMS notifications
- [ ] Hausa language localization
- [ ] Comparison view for multiple listings
- [ ] Reviews and ratings system
- [ ] Map component for billboard locations

---

## API Endpoints
- `GET /api/influencers` - List all influencers
- `GET /api/influencers/:id` - Get influencer details
- `GET /api/billboards` - List billboard categories
- `GET /api/billboards/:id` - Get billboard details
- `GET /api/kannywood` - List Kannywood placements
- `GET /api/digital-ads` - List digital ad services
- `POST /api/orders` - Create new order
- `POST /api/payments/initialize` - Initialize Paystack payment
- `GET /api/payments/verify/:reference` - Verify payment
- `POST /api/register` - User registration
- `POST /api/token` - User login (JWT)

---

## Test Reports
- `/app/test_reports/iteration_1.json` - Initial test run
- `/app/test_reports/iteration_2.json` - Billboard feature tests (100% pass)

---

*Last Updated: March 15, 2026*
