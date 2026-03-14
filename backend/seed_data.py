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
            "name": "Aisha Muhammad",
            "handle": "aisha_kano",
            "platform": "Instagram",
            "followers": 250000,
            "niche": "Fashion & Lifestyle",
            "bio": "Kano-based fashion influencer promoting Northern Nigerian style and modest fashion. Authentic engagement with 8% rate.",
            "location": "Kano",
            "price_per_post": 75000,
            "engagement_rate": 8.2,
            "audience_demographics": "85% Nigerian, 70% Female, Ages 18-34",
            "image_url": "https://images.unsplash.com/photo-1757899525290-731fc4745499?w=400&h=400&fit=crop",
            "verified": True,
            "rating": 4.8,
            "total_reviews": 24,
            "response_time": "Within 12 hours",
            "completion_rate": 98.5,
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
    
    # Seed Billboards
    print("Seeding billboards...")
    billboards = [
        {
            "id": "bb-1",
            "supplier_id": "supplier-4",
            "location_name": "Kano Road Junction",
            "city": "Kano",
            "state": "Kano",
            "dimensions": "48x14 feet",
            "billboard_type": "Digital LED",
            "traffic_daily": 85000,
            "price_monthly": 450000,
            "description": "Prime digital billboard at the busiest junction in Kano. High visibility 24/7 with rotating 15-second slots.",
            "latitude": 12.0022,
            "longitude": 8.5919,
            "image_url": "https://images.unsplash.com/photo-1766330301961-6366c58297d0?w=600&h=400&fit=crop",
            "verified": True,
            "availability": True,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "bb-2",
            "supplier_id": "supplier-5",
            "location_name": "Airport Road Billboard",
            "city": "Kano",
            "state": "Kano",
            "dimensions": "40x12 feet",
            "billboard_type": "Static",
            "traffic_daily": 50000,
            "price_monthly": 280000,
            "description": "Static billboard on the route to Mallam Aminu Kano Airport. Ideal for long-term brand campaigns.",
            "latitude": 12.0464,
            "longitude": 8.5242,
            "image_url": "https://images.unsplash.com/photo-1745725427643-8994370391e6?w=600&h=400&fit=crop",
            "verified": True,
            "availability": True,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "bb-3",
            "supplier_id": "supplier-4",
            "location_name": "Kaduna Express Billboard",
            "city": "Kaduna",
            "state": "Kaduna",
            "dimensions": "48x14 feet",
            "billboard_type": "Digital LED",
            "traffic_daily": 70000,
            "price_monthly": 420000,
            "description": "High-traffic digital billboard on Kaduna expressway. Premium visibility for commuters.",
            "latitude": 10.5105,
            "longitude": 7.4165,
            "image_url": "https://images.unsplash.com/photo-1766330301961-6366c58297d0?w=600&h=400&fit=crop",
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
            "production_name": "Labarin Soyayya (Love Story)",
            "placement_type": "Product Integration",
            "description": "Upcoming romantic drama featuring top Kannywood stars. Product integration opportunities include prominent brand placement in 3-5 key scenes.",
            "estimated_reach": 2500000,
            "price": 800000,
            "release_date": "March 2026",
            "verified": True,
            "status": "approved",
            "created_at": datetime.now(timezone.utc).isoformat()
        },
        {
            "id": "kw-2",
            "supplier_id": "supplier-7",
            "production_name": "Kasuwanci (Business)",
            "placement_type": "Brand Sponsorship",
            "description": "Business-themed series highlighting entrepreneurship in Northern Nigeria. Title sponsorship available with brand name in opening credits and posters.",
            "estimated_reach": 1800000,
            "price": 1200000,
            "release_date": "April 2026",
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
