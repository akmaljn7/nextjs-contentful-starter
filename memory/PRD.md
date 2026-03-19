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
- [x] Kannywood Detail Page - Advertising packages for film productions
- [x] Digital Ads Page - 6 platforms (Facebook, Instagram, TikTok, Snapchat, Google, WhatsApp)
- [x] Digital Ad Detail Page - Real pricing packages for each platform
- [x] **Consultation Page** - Expert advertising guidance with online/in-office options (March 2026)
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
- [x] **Professional User Dashboard** with activity tracking (March 2026):
  - Stats overview: Total Orders, Pending, Completed, Cancelled, Total Spent
  - Real-time stats from API (not calculated locally)
  - Tabbed interface: Overview, All Orders, Consultations, Transactions
  - Recent orders list with status badges
  - User profile card
  - Quick actions panel
  - Transaction history combining orders and consultations
- [x] **Admin Panel** for staff (March 2026):
  - Stats overview: Total Orders, Pending Orders, Consultations, Total Revenue
  - Order management with status update buttons
  - Consultation management with status update buttons
  - Modal dialogs for updating Order Status and Payment Status
  - Automatic sync with user dashboards
- [x] **Comprehensive Admin Backend** (March 2026):
  - Full CRUD for Influencers (add, edit, delete, change all fields)
  - Full CRUD for Billboards (add, edit, delete, change all fields)
  - Full CRUD for Kannywood productions (add, edit, delete)
  - Full CRUD for Orders and Consultations
  - User management (view, edit roles, delete)
  - Site Settings management (site name, contact info, prices, fees)
  - **Package Management**: Admin can add/edit/delete service packages for:
    - Influencers (title, description, price, delivery time)
    - Kannywood (title, description, price)
    - Billboards (location-based pricing by state with daily/weekly/monthly rates)

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

### Consultation Service (March 2026)
- **In-Office Consultation**: ₦25,000 (1-2 hours)
- **Online Consultation**: ₦15,000 (45-60 minutes)
- **Form Fields**: Business Name, Industry, Business Stage, Description, Goals, Budget Range, Contact Info
- **Payment Flow**: 
  - Form submission → Payment method selection modal
  - Pay Online → Redirects to Paystack gateway
  - Pay Cash → Office location confirmation → Success modal
- **Endpoints**:
  - POST /api/consultations - Create consultation request
  - GET /api/consultations - Get user's consultations
  - GET /api/consultations/:id - Get specific consultation
  - PATCH /api/consultations/:id/status - Update status (admin only)
  - PATCH /api/consultations/:id/payment - Update payment status

---

## Completed Fixes (December 2025)

### Issue 1: Package Preservation Bug - FIXED
- **Problem**: When admin edited an item and added a new package, all existing packages were wiped
- **Root Cause**: Original seed data lacked `packages` field in database, causing admin edit form to start empty
- **Solution**: 
  1. Created data migration script (`/app/backend/migrate_packages.py`) to populate default packages
  2. Updated admin update endpoint to accept packages directly from form
  3. Admin panel now fetches full item data (including packages) before showing edit modal
- **Test Status**: Verified via automated tests (8/8 passed)

### Issue 2: Hardcoded Frontend Data - FIXED
- **Problem**: BillboardDetailPage.js and DigitalAdDetailPage.js used hardcoded data instead of API
- **Solution**:
  1. Created `/api/digital-ads/{platform_id}` endpoint to fetch platform with packages
  2. Refactored `DigitalAdDetailPage.js` to fetch packages from API
  3. Refactored `BillboardDetailPage.js` to fetch `pricing_by_state` from API
  4. Both pages now display dynamic, database-driven content
- **Test Status**: Verified - Digital Ads shows 4 packages from API, Billboards shows 13 locations

### Issue 3: Digital Ads Not Showing on Public Page - FIXED (March 2026)
- **Problem**: Digital Ads created via admin panel were not visible on public `/digital-ads` page
- **Root Cause**: 
  1. Public `/api/digital-ads` endpoint read from `digital_ad_services` collection, while admin created entries in `digital_ads` collection
  2. Frontend `DigitalAdsPage.js` was using hardcoded `AD_PLATFORMS` array instead of fetching from API
- **Solution**:
  1. Updated `/api/digital-ads` endpoint to read from `digital_ads` collection (admin-managed)
  2. Refactored `DigitalAdsPage.js` to fetch and display data from API
  3. Added proper loading states and error handling
- **Test Status**: Verified - All 7 platforms (including YouTube) now appear on public page

### Issue 4: HTTP Status Codes (401 vs 403) - FIXED (March 2026)
- **Problem**: Unauthenticated requests returned 403 Forbidden instead of 401 Unauthorized
- **Root Cause**: FastAPI's `HTTPBearer` security dependency had `auto_error=True` by default
- **Solution**:
  1. Set `HTTPBearer(auto_error=False)` to prevent automatic 403 response
  2. Added explicit check for `None` credentials in `get_current_user` function
  3. Returns 401 with proper `WWW-Authenticate: Bearer` header
- **Test Status**: Verified - Unauthenticated requests now return 401

### Feature: Image Upload in Admin Panel - IMPLEMENTED (March 2026)
- **Request**: Replace URL inputs with image upload functionality in admin panel
- **Implementation**:
  1. **Backend**: Created chunked upload endpoint (`POST /api/upload/chunk`) to bypass proxy limits
     - Uses 64KB chunks with base64 encoding
     - Supports JPG, PNG, GIF, WebP (max 5MB)
     - Files stored in `/app/backend/uploads/`
     - Files served via `GET /api/uploads/{filename}`
  2. **Frontend**: Created `ImageUpload` component (`/app/frontend/src/components/ImageUpload.jsx`)
     - Toggle between Upload and URL modes
     - Drag-and-drop upload area
     - Progress indicator during upload
     - Image preview after upload/URL entry
     - Clear button to remove image
  3. **Integration**: Updated all admin forms to use ImageUpload component:
     - Influencers form: "Profile Image"
     - Billboards form: "Billboard Image"
     - Kannywood form: "Production Image"
     - Digital Ads form: "Platform Image"
- **Test Status**: Verified - 100% pass rate (11/11 backend tests, all frontend verified)

### Feature: Email Notifications - IMPLEMENTED (March 2026)
- **Request**: Send beautiful emails for pay-at-office orders and consultation scheduling
- **Implementation**:
  1. **SMTP Configuration**: Gmail SMTP with app password in backend `.env`
  2. **Order Confirmation Email**: Sent when user selects "Pay at Office" payment method
     - Beautiful HTML template with Lightban branding
     - Includes order details, total amount, office address, business hours
     - WhatsApp contact link for questions
  3. **Consultation Scheduling Email**: Sent when admin sets scheduled_date and scheduled_time
     - Includes appointment details, date/time highlight
     - Location info (online meeting link note or office address)
     - Preparation tips for the consultation
  4. **Async Delivery**: Emails sent in background using ThreadPoolExecutor
- **Endpoints Modified**:
  - `POST /api/orders`: Triggers email when `payment_method='cash'`
  - `PUT /api/orders/{id}/status`: Triggers email when `payment_status='pending_cash'`
  - `PUT /api/admin/consultations/{id}`: Triggers email when schedule is set
- **Test Status**: Verified - 100% pass rate (8/8 tests, emails confirmed delivered)

---

## Prioritized Backlog

### P1 - High Priority
- [ ] Static Banner Billboard detail page (same pattern as LED)
- [ ] Lightbox Billboard detail page
- [ ] Global search bar with filters (city, category, budget)

### P2 - Medium Priority
- [ ] Messaging center between advertisers and Lightban team
- [ ] Order tracking page with detailed status

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
- `GET /api/influencers/:id` - Get influencer details with packages
- `GET /api/billboards` - List billboard categories
- `GET /api/billboards/:id` - Get billboard details with pricing_by_state
- `GET /api/kannywood` - List Kannywood placements
- `GET /api/kannywood/:id` - Get Kannywood details with packages
- `GET /api/digital-ads` - List digital ad services
- `GET /api/digital-ads/:id` - Get digital ad platform with packages
- `POST /api/orders` - Create new order
- `POST /api/payments/initialize` - Initialize Paystack payment
- `GET /api/payments/verify/:reference` - Verify payment
- `POST /api/register` - User registration
- `POST /api/token` - User login (JWT)
- `POST /api/upload/chunk` - Chunked file upload (admin only)
- `GET /api/uploads/:filename` - Serve uploaded files

---

## Database Migration Scripts
- `/app/backend/migrate_packages.py` - Populates default packages for all items without package data

---

## Test Reports
- `/app/test_reports/iteration_1.json` - Initial test run
- `/app/test_reports/iteration_2.json` - Billboard feature tests (100% pass)
- `/app/test_reports/iteration_3.json` - Package preservation and API data fixes (100% pass)
- `/app/test_reports/iteration_4.json` - Digital Ads visibility and 401 status code fixes (100% pass - 13/13 backend, all frontend verified)
- `/app/test_reports/iteration_5.json` - Image upload feature (100% pass - 11/11 backend, all frontend verified)
- `/app/test_reports/iteration_6.json` - Email notifications (100% pass - 8/8 backend, order & consultation emails verified)

---

*Last Updated: March 2026*
