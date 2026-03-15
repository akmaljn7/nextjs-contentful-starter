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

---

## What's Been Implemented

### Core Pages
- [x] Home Page - Hero section, featured categories
- [x] Influencers Page - Grid listing of influencers
- [x] Influencer Detail Page - Profile with service packages
- [x] Billboards Page - 3 categories (LED, Static, Lightbox)
- [x] **LED Billboard Detail Page** - State selector with dynamic pricing for 13 Northern Nigerian locations
- [x] Kannywood Page - Movie/show placement opportunities
- [x] Digital Ads Page - Digital marketing services
- [x] Static pages: About, FAQ, Pricing, Contact, Terms, Privacy

### Features
- [x] Theme toggle (Navy/Orange)
- [x] Shopping cart system (Zustand store)
- [x] Complete booking flow: Browse -> Add to Cart -> Place Order
- [x] Order placement with 5-minute countdown modal
- [x] User authentication (Register/Login)
- [x] Responsive design

### LED Billboard Locations & Pricing (March 2026)
| Location | Monthly | Weekly | Daily | Hourly | Belt Buying | Per Impression |
|----------|---------|--------|-------|--------|-------------|----------------|
| Jos | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦24,000 | ₦93 |
| Katsina | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |
| Minna | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |
| Ilorin | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |
| Yola | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |
| Kano (Sabowar Kofa) | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |
| **Kano (Airport)** | **₦2,283,333** | **₦577,917** | **₦89,565** | **₦9,200** | **₦33,761** | **₦116** |
| Maiduguri | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |
| Kaduna | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |
| Sokoto | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |
| Makurdi | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |
| Owerri | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |
| Calabar | ₦1,866,666 | ₦489,333 | ₦69,476 | ₦8,000 | ₦27,000 | ₦93 |

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
- [ ] Paystack payment integration (currently mocked)
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
- `POST /api/register` - User registration
- `POST /api/token` - User login (JWT)

---

## Test Reports
- `/app/test_reports/iteration_1.json` - Initial test run
- `/app/test_reports/iteration_2.json` - Billboard feature tests (100% pass)
- `/app/backend/tests/test_billboards.py` - Backend billboard tests

---

*Last Updated: March 15, 2026*
