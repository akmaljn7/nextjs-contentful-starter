import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
import sys

# Add backend to path
sys.path.insert(0, '/app/backend')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

async def seed_data():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Clear existing data
    print("Clearing existing data...")
    await db.influencers.delete_many({})
    await db.billboards.delete_many({})
    await db.digital_ad_services.delete_many({})
    await db.kannywood_placements.delete_many({})
    
    # Seed Influencers
    print("Seeding influencers...")
    influencers = [
        {
            "id": "inf-1",
            "supplier_id": "supplier-1",
            "name": "Abis Fulani",
            "handle": "abis_fulani",
            "platform": "Instagram",
            "followers": 320000,
            "niche": "Lifestyle & Travel",
            "bio": "Northern Nigerian lifestyle influencer and travel content creator. Authentic storytelling with strong engagement across Instagram and TikTok.",
            "location": "Kano",
            "price_per_post": 85000,
            "engagement_rate": 9.5,
            "audience_demographics": "88% Nigerian, 55% Male, Ages 18-35",
            "image_url": "https://customer-assets.emergentagent.com/job_ads-kano/artifacts/px90xs76_abis%20fulani.png",
            "verified": True,
            "rating": 4.9,
            "total_reviews": 28,
            "response_time": "Within 12 hours",
            "completion_rate": 99.0,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "inf-2",
            "supplier_id": "supplier-2",
            "name": "Ibrahim Sani",
            "handle": "ibrahim_tech",
            "platform": "Twitter",
            "followers": 180000,
            "niche": "Technology & Innovation",
            "bio": "Tech enthusiast covering Northern Nigerian tech ecosystem. Strong reach among young professionals and entrepreneurs.",
            "location": "Kano",
            "price_per_post": 60000,
            "engagement_rate": 6.5,
            "audience_demographics": "80% Nigerian, 65% Male, Ages 20-35",
            "image_url": "https://images.unsplash.com/photo-1645736594009-7b16ba35f0bf?w=400&h=400&fit=crop",
            "verified": True,
            "rating": 4.9,
            "total_reviews": 31,
            "response_time": "Within 24 hours",
            "completion_rate": 100.0,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "inf-3",
            "supplier_id": "supplier-3",
            "name": "Hauwa Abdullahi",
            "handle": "hauwa_food",
            "platform": "TikTok",
            "followers": 320000,
            "niche": "Food & Cooking",
            "bio": "Showcasing Northern Nigerian cuisine to the world. Viral content creator with millions of views.",
            "location": "Kaduna",
            "price_per_post": 85000,
            "engagement_rate": 12.4,
            "audience_demographics": "90% Nigerian, 75% Female, Ages 18-40",
            "image_url": "https://images.unsplash.com/photo-1757899525290-731fc4745499?w=400&h=400&fit=crop",
            "verified": True,
            "rating": 4.7,
            "total_reviews": 19,
            "response_time": "Within 24 hours",
            "completion_rate": 95.0,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.influencers.insert_many(influencers)
    
    # Seed Billboards - 3 Categories
    print("Seeding billboards...")
    billboards = [
        {
            "id": "bb-1",
            "supplier_id": "supplier-4",
            "location_name": "LED Billboard",
            "city": "Kano",
            "state": "Kano",
            "dimensions": "Various sizes available",
            "billboard_type": "Digital LED",
            "traffic_daily": 100000,
            "price_monthly": 500000,
            "description": "Premium digital LED billboards displaying video content. Perfect for dynamic, eye-catching advertisements across Northern Nigeria's high-traffic locations.",
            "latitude": 12.0022,
            "longitude": 8.5919,
            "image_url": "https://customer-assets.emergentagent.com/job_ads-kano/artifacts/4qysjf96_LED%20video.jpg",
            "verified": True,
            "availability": True,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "bb-2",
            "supplier_id": "supplier-5",
            "location_name": "Static Banner Billboard",
            "city": "Kano",
            "state": "Kano",
            "dimensions": "Standard & custom sizes",
            "billboard_type": "Static",
            "traffic_daily": 75000,
            "price_monthly": 250000,
            "description": "Traditional static banner billboards. Cost-effective outdoor advertising solution for long-term brand visibility across major roads and highways.",
            "latitude": 12.0464,
            "longitude": 8.5242,
            "image_url": "https://customer-assets.emergentagent.com/job_ads-kano/artifacts/c38xti5g_static.jpg",
            "verified": True,
            "availability": True,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "bb-3",
            "supplier_id": "supplier-4",
            "location_name": "Lightbox Static Banner Billboard",
            "city": "Kano",
            "state": "Kano",
            "dimensions": "Multiple sizes available",
            "billboard_type": "Lightbox Static",
            "traffic_daily": 85000,
            "price_monthly": 350000,
            "description": "Illuminated static banner billboards with built-in lighting. Maximum visibility day and night, ideal for premium brand positioning.",
            "latitude": 10.5105,
            "longitude": 7.4165,
            "image_url": "https://customer-assets.emergentagent.com/job_ads-kano/artifacts/ykee27ba_lightbox%20static.jpg",
            "verified": True,
            "availability": True,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.billboards.insert_many(billboards)
    
    # Seed Digital Ad Services
    print("Seeding digital ad services...")
    digital_ads = [
        {
            "id": "da-1",
            "supplier_id": "supplier-6",
            "service_name": "Facebook & Instagram Campaign Management",
            "platform": "Facebook/Instagram",
            "description": "Full-service social media advertising for Northern Nigerian audiences. Includes creative design, targeting, optimization, and monthly reporting.",
            "price_starting": 150000,
            "includes": ["Ad creative design", "Audience targeting", "A/B testing", "Daily optimization", "Monthly analytics report"],
            "verified": True,
            "rating": 4.6,
            "total_reviews": 18,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "da-2",
            "supplier_id": "supplier-6",
            "service_name": "Google Search Ads for Local Businesses",
            "platform": "Google",
            "description": "Drive traffic and conversions with targeted Google Search campaigns. Perfect for local businesses in Kano, Kaduna, and surrounding areas.",
            "price_starting": 200000,
            "includes": ["Keyword research", "Ad copy writing", "Landing page optimization", "Conversion tracking", "Weekly performance reports"],
            "verified": True,
            "rating": 4.8,
            "total_reviews": 22,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.digital_ad_services.insert_many(digital_ads)
    
    # Seed Kannywood Placements
    print("Seeding Kannywood placements...")
    kannywood = [
        {
            "id": "kw-1",
            "supplier_id": "supplier-7",
            "production_name": "'Ya Daga Allah",
            "placement_type": "Product Integration",
            "description": "Aminu Saira's powerful drama exploring faith, family dynamics, and societal expectations in Northern Nigeria. Product integration opportunities in key emotional scenes.",
            "estimated_reach": 2800000,
            "price": 950000,
            "release_date": "March 2026",
            "verified": True,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "kw-2",
            "supplier_id": "supplier-7",
            "production_name": "Labarina Season 14",
            "placement_type": "Brand Sponsorship",
            "description": "Popular Saira Movies comedy-drama series returning for its 14th season. Title sponsorship available with brand name in opening credits, posters, and promotional materials.",
            "estimated_reach": 3200000,
            "price": 1400000,
            "release_date": "April 2026",
            "verified": True,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "kw-3",
            "supplier_id": "supplier-7",
            "production_name": "Gidan Badamasi - New Sit-Com Series",
            "placement_type": "Product Integration",
            "description": "Popular family sit-com featuring everyday life scenarios. Perfect for household brands and consumer products with natural integration opportunities.",
            "estimated_reach": 2200000,
            "price": 750000,
            "release_date": "May 2026",
            "verified": True,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
    ]
    await db.kannywood_placements.insert_many(kannywood)
    
    print("✅ Seed data inserted successfully!")
    print(f"   - {len(influencers)} influencers")
    print(f"   - {len(billboards)} billboards")
    print(f"   - {len(digital_ads)} digital ad services")
    print(f"   - {len(kannywood)} Kannywood placements")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_data())
