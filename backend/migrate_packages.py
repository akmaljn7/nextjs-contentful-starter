"""
Data Migration Script: Populate default packages for existing items

This script adds default packages to all influencers, kannywood productions,
and billboards that were seeded without package data. It ensures data consistency
between the database and the frontend expectations.

Run with: python migrate_packages.py
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

# Default packages for each influencer (based on frontend hardcoded data)
INFLUENCER_PACKAGES = {
    'inf-1': [  # G_fresh - Comedy & Entertainment (TikTok)
        {
            'id': 'pkg-1',
            'title': 'Comedy Skit with Brand',
            'description': 'Hilarious 2-minute TikTok skit featuring your brand naturally integrated into the storyline',
            'price': 80000,
            'deliverables': ['1 TikTok comedy skit (2-3 mins)', 'Brand integration', 'Posted to 450K followers', 'Story repost'],
            'turnaround': '3-5 days',
        },
        {
            'id': 'pkg-2',
            'title': 'Product Unboxing/Review',
            'description': 'Fun and engaging product unboxing with comedic commentary',
            'price': 60000,
            'deliverables': ['1 TikTok unboxing video', 'Honest funny review', 'Product showcase', '24-hour story feature'],
            'turnaround': '3-5 days',
        },
        {
            'id': 'pkg-3',
            'title': 'Brand Shoutout',
            'description': 'Quick shoutout for your brand at the end of a viral skit',
            'price': 30000,
            'deliverables': ['5-10 second brand mention', 'Logo display', 'Posted to 450K followers', 'Natural integration'],
            'turnaround': '1-2 days',
        },
        {
            'id': 'pkg-4',
            'title': 'Duet Challenge',
            'description': 'Create a branded duet challenge that can go viral',
            'price': 100000,
            'deliverables': ['Original challenge video', 'Branded hashtag', 'Challenge promotion', 'Cross-platform share'],
            'turnaround': '5-7 days',
        },
        {
            'id': 'pkg-5',
            'title': 'Full Campaign Package',
            'description': 'Complete entertainment campaign with multiple skits and touchpoints',
            'price': 200000,
            'deliverables': ['3 TikTok skits', '5 stories', '1 Instagram reel', 'Branded hashtag campaign', 'Analytics report'],
            'turnaround': '10-14 days',
        },
    ],
    'inf-2': [  # Abis Fulani - Lifestyle & Travel (Instagram)
        {
            'id': 'pkg-1',
            'title': '2 Minute TikTok Video',
            'description': 'Engaging 2-minute video showcasing your brand with authentic storytelling',
            'price': 50000,
            'deliverables': ['1 TikTok video (up to 2 minutes)', 'Caption & hashtags', 'Posted to 320K followers', '24-hour story repost'],
            'turnaround': '3-5 days',
        },
        {
            'id': 'pkg-2',
            'title': 'Instagram Reel Video',
            'description': 'High-quality Instagram reel with product integration and lifestyle context',
            'price': 60000,
            'deliverables': ['1 Instagram reel (60-90 seconds)', 'Professional editing', 'Story mention', 'Permanent grid post'],
            'turnaround': '3-5 days',
        },
        {
            'id': 'pkg-3',
            'title': 'Brand Poster Placement',
            'description': 'Your brand poster/logo featured prominently in my next video',
            'price': 20000,
            'deliverables': ['Poster in video background', '3-5 second focused shot', 'Natural integration', 'Posted within 7 days'],
            'turnaround': '5-7 days',
        },
        {
            'id': 'pkg-4',
            'title': 'Instagram Story Series (5 Stories)',
            'description': '5-story series featuring your product/service with swipe-up link',
            'price': 35000,
            'deliverables': ['5 Instagram stories', 'Swipe-up/link sticker', '24-hour highlight', 'Analytics report'],
            'turnaround': '1-2 days',
        },
        {
            'id': 'pkg-5',
            'title': 'Travel Campaign Package',
            'description': 'Full travel campaign with multiple touchpoints (ideal for hotels, airlines, tourism)',
            'price': 150000,
            'deliverables': ['1 TikTok video', '1 Instagram reel', '3 grid posts', '10 stories', 'Blog feature (if applicable)'],
            'turnaround': '7-10 days',
        },
    ],
    'inf-3': [  # Baddoo - Lifestyle & Fashion (TikTok)
        {
            'id': 'pkg-1',
            'title': 'Fashion Showcase Video',
            'description': 'Stylish TikTok video featuring your fashion brand or clothing line',
            'price': 70000,
            'deliverables': ['1 TikTok fashion video (2-3 mins)', 'Multiple outfit shots', 'Product tags', 'Posted to 380K followers'],
            'turnaround': '3-5 days',
        },
        {
            'id': 'pkg-2',
            'title': 'GRWM (Get Ready With Me)',
            'description': 'Get Ready With Me video featuring your beauty/fashion products',
            'price': 65000,
            'deliverables': ['1 GRWM TikTok video', 'Product showcase', 'Step-by-step styling', 'Story highlights'],
            'turnaround': '3-5 days',
        },
        {
            'id': 'pkg-3',
            'title': 'Brand Collaboration Post',
            'description': 'Single branded TikTok post with outfit/product feature',
            'price': 40000,
            'deliverables': ['1 TikTok post', 'Product mention', 'Shopping tags', '24-hour story'],
            'turnaround': '2-3 days',
        },
        {
            'id': 'pkg-4',
            'title': 'Lifestyle Day-in-the-Life',
            'description': 'Day-in-the-life content featuring your brand naturally',
            'price': 90000,
            'deliverables': ['1 day-in-the-life TikTok', 'Multiple brand touchpoints', 'Authentic integration', 'Instagram cross-post'],
            'turnaround': '5-7 days',
        },
        {
            'id': 'pkg-5',
            'title': 'Fashion Campaign Bundle',
            'description': 'Complete fashion campaign across platforms',
            'price': 180000,
            'deliverables': ['3 TikTok videos', '2 Instagram reels', '10 stories', 'Lookbook feature', 'Analytics report'],
            'turnaround': '10-14 days',
        },
    ],
    'inf-4': [  # Maryamaaah_ - Food & Cooking (Instagram)
        {
            'id': 'pkg-1',
            'title': 'Recipe Video with Your Product',
            'description': 'Full recipe video featuring your food product as the star ingredient',
            'price': 70000,
            'deliverables': ['1 Instagram reel recipe (2-3 mins)', 'Recipe integration', 'Product showcase', 'Posted to 320K followers'],
            'turnaround': '5-7 days',
        },
        {
            'id': 'pkg-2',
            'title': 'Kitchen Equipment Review',
            'description': 'Detailed review of your kitchen appliance or cooking equipment',
            'price': 60000,
            'deliverables': ['2-minute Instagram review', 'Demonstration of features', 'Honest assessment', 'Story highlights'],
            'turnaround': '3-5 days',
        },
        {
            'id': 'pkg-3',
            'title': 'Brand Placement in Cooking Video',
            'description': 'Your product/brand visible in kitchen setup during recipe video',
            'price': 30000,
            'deliverables': ['Product visible in frame', 'Natural integration', '2-3 second focus shot', 'Posted within 7 days'],
            'turnaround': '5-7 days',
        },
        {
            'id': 'pkg-4',
            'title': 'Recipe Series (3 Videos)',
            'description': 'Three recipe videos featuring your product in different dishes',
            'price': 180000,
            'deliverables': ['3 Instagram reels', 'Different recipes each', 'Full product integration', 'Story cross-post'],
            'turnaround': '10-14 days',
        },
        {
            'id': 'pkg-5',
            'title': 'Instagram Reel + Story Bundle',
            'description': 'Short-form reel with extended behind-the-scenes stories',
            'price': 50000,
            'deliverables': ['1 Instagram reel (60 seconds)', '5 behind-the-scenes stories', 'Recipe card', 'Swipe-up link'],
            'turnaround': '3-5 days',
        },
    ],
    'inf-5': [  # Meenal Ahmad - Fashion & Culture (TikTok)
        {
            'id': 'pkg-1',
            'title': 'Traditional Fashion Showcase',
            'description': 'Beautiful TikTok video showcasing traditional Nigerian fashion with your brand',
            'price': 60000,
            'deliverables': ['1 TikTok fashion video', 'Traditional styling', 'Product feature', 'Posted to 290K followers'],
            'turnaround': '3-5 days',
        },
        {
            'id': 'pkg-2',
            'title': 'Cultural Style Video',
            'description': 'Cultural celebration video featuring your fashion/beauty products',
            'price': 55000,
            'deliverables': ['1 TikTok cultural video', 'Outfit showcase', 'Brand mention', 'Story highlights'],
            'turnaround': '3-5 days',
        },
        {
            'id': 'pkg-3',
            'title': 'Brand Styling Post',
            'description': 'Single styled post featuring your fashion brand',
            'price': 35000,
            'deliverables': ['1 TikTok post', 'Professional styling', 'Product tags', '24-hour story'],
            'turnaround': '2-3 days',
        },
        {
            'id': 'pkg-4',
            'title': 'Event/Occasion Styling',
            'description': 'Special occasion styling video perfect for event wear brands',
            'price': 75000,
            'deliverables': ['1 occasion styling TikTok', 'Full look breakdown', 'Shopping details', 'Instagram cross-post'],
            'turnaround': '5-7 days',
        },
        {
            'id': 'pkg-5',
            'title': 'Fashion Culture Campaign',
            'description': 'Complete cultural fashion campaign with multiple looks',
            'price': 150000,
            'deliverables': ['3 TikTok videos', '2 Instagram posts', '8 stories', 'Brand ambassador feature', 'Analytics report'],
            'turnaround': '10-14 days',
        },
    ],
    'inf-6': [  # Ibrahim Sani - Technology (Twitter/X)
        {
            'id': 'pkg-1',
            'title': 'Twitter/X Thread Review',
            'description': 'Comprehensive thread reviewing your tech product or service',
            'price': 45000,
            'deliverables': ['10-15 tweet thread', 'Product photos/screenshots', 'Pinned for 48 hours', 'Reach 180K followers'],
            'turnaround': '3-5 days',
        },
        {
            'id': 'pkg-2',
            'title': 'Video Demo Tweet',
            'description': '2-minute video demonstration with detailed commentary',
            'price': 55000,
            'deliverables': ['Video tweet (up to 2 minutes)', 'Written review', 'Follow-up engagement', 'Retweet campaign'],
            'turnaround': '5-7 days',
        },
        {
            'id': 'pkg-3',
            'title': 'Sponsored Tweet',
            'description': 'Single sponsored tweet with your brand message',
            'price': 25000,
            'deliverables': ['1 branded tweet', 'Up to 280 characters + media', 'Posted to 180K followers', 'Active for 24 hours'],
            'turnaround': '1-2 days',
        },
        {
            'id': 'pkg-4',
            'title': 'Tech Launch Campaign',
            'description': 'Multi-platform campaign for product/app launch',
            'price': 120000,
            'deliverables': ['Launch thread (15 tweets)', 'Video review', '3 follow-up posts', 'Twitter Space discussion (optional)'],
            'turnaround': '7-10 days',
        },
    ],
}

# Default packages for Kannywood productions
KANNYWOOD_PACKAGES = {
    'kw-1': [  # 'Ya Daga Allah
        {
            'id': 'pkg-1',
            'title': 'Background Product Placement',
            'description': 'Your product visible in background scenes - kitchen, office, or living room settings',
            'price': 150000,
            'deliverables': ['Product visible in 3-5 scenes', 'Natural background placement', 'No dialogue mention', 'Certificate of placement', 'Behind-the-scenes photo'],
            'turnaround': 'Film Release Date',
            'reach': '500,000+ viewers',
        },
        {
            'id': 'pkg-2',
            'title': 'Active Product Integration',
            'description': 'Character actively uses your product as part of the storyline',
            'price': 350000,
            'deliverables': ['Product used by main/supporting character', '2-3 active usage scenes', 'Natural storyline integration', 'Social media mention', 'Press kit inclusion', 'Premiere invitation (2 tickets)'],
            'turnaround': 'Film Release Date',
            'reach': '1,000,000+ viewers',
        },
        {
            'id': 'pkg-3',
            'title': 'Verbal Mention Package',
            'description': 'Character mentions your brand/product name in dialogue',
            'price': 500000,
            'deliverables': ['Verbal brand mention in dialogue', 'Active product usage scene', 'Background placements (5+ scenes)', 'Trailer inclusion (if applicable)', 'Social media campaign', 'Red carpet presence'],
            'turnaround': 'Film Release Date',
            'reach': '1,500,000+ viewers',
        },
        {
            'id': 'pkg-4',
            'title': 'Title Sponsorship',
            'description': 'Premium sponsorship with brand name in opening credits',
            'price': 950000,
            'deliverables': ['"Sponsored by [Your Brand]" in opening credits', 'Logo on all promotional materials', 'Verbal mentions (2-3 scenes)', 'Product integration throughout', 'VIP premiere access (10 tickets)', 'Press conference participation', 'Exclusive promotional clip rights'],
            'turnaround': 'Film Release Date',
            'reach': '2,800,000+ viewers',
        },
    ],
    'kw-2': [  # Labarina Season 14
        {
            'id': 'pkg-1',
            'title': 'Single Episode Placement',
            'description': 'Product placement in one episode of the season',
            'price': 120000,
            'deliverables': ['Product visible in 2-3 scenes', 'One episode feature', 'Social media story mention', 'Certificate of placement'],
            'turnaround': 'Episode Air Date',
            'reach': '250,000+ per episode',
        },
        {
            'id': 'pkg-2',
            'title': 'Multi-Episode Package (5 Episodes)',
            'description': 'Consistent product presence across 5 episodes',
            'price': 450000,
            'deliverables': ['Product placement in 5 episodes', 'Character interaction with product', 'Instagram/Facebook posts (3)', 'Behind-the-scenes content', 'Analytics report'],
            'turnaround': '5-week campaign',
            'reach': '1,200,000+ viewers',
        },
        {
            'id': 'pkg-3',
            'title': 'Full Season Integration',
            'description': 'Your brand woven into the entire season storyline',
            'price': 850000,
            'deliverables': ['Presence in all season episodes', 'Recurring product/brand mentions', 'Character association with brand', 'Social media campaign (season-long)', 'Promotional video clip', 'Meet & greet with cast'],
            'turnaround': 'Full Season',
            'reach': '2,500,000+ viewers',
        },
        {
            'id': 'pkg-4',
            'title': 'Season Title Sponsor',
            'description': '"Labarina Season 14 - Presented by [Your Brand]"',
            'price': 1400000,
            'deliverables': ['Title card: "Presented by [Brand]"', 'Logo in all episode intros/outros', 'Full season product integration', 'Cast promotional appearances (2)', 'Exclusive premiere event hosting', 'Custom promotional skit', 'YouTube/streaming ad rights'],
            'turnaround': 'Full Season',
            'reach': '3,200,000+ viewers',
        },
    ],
    'kw-3': [  # Gidan Badamasi
        {
            'id': 'pkg-1',
            'title': 'Kitchen/Home Product Placement',
            'description': 'Ideal for food, beverages, and household products',
            'price': 100000,
            'deliverables': ['Product in kitchen/living room scenes', 'Natural family usage context', '3-4 visibility moments', 'Social media mention', 'Placement certificate'],
            'turnaround': 'Episode Air Date',
            'reach': '200,000+ per episode',
        },
        {
            'id': 'pkg-2',
            'title': 'Comedy Skit Integration',
            'description': 'Your product featured in a comedic scene/skit',
            'price': 280000,
            'deliverables': ['Dedicated comedy skit featuring product', 'Funny/memorable usage scenario', 'Shareable clip for your marketing', 'Cast social media posts', 'Behind-the-scenes content'],
            'turnaround': '2-3 weeks',
            'reach': '800,000+ viewers',
        },
        {
            'id': 'pkg-3',
            'title': 'Character Endorsement',
            'description': 'Popular character becomes associated with your brand',
            'price': 500000,
            'deliverables': ['Character regularly uses/mentions product', 'Running gag or catchphrase opportunity', '"Badamasi\'s favorite [product]" positioning', 'Promotional video with character', 'Social media campaign', 'Event appearance (1)'],
            'turnaround': 'Multi-episode arc',
            'reach': '1,500,000+ viewers',
        },
        {
            'id': 'pkg-4',
            'title': 'Show Sponsorship',
            'description': 'Full show sponsorship with maximum brand exposure',
            'price': 750000,
            'deliverables': ['Opening sponsor mention', 'Regular product integration', 'Mid-show sponsor bumper', 'Cast promotional content', 'Exclusive advertising slot', 'Premiere/finale event hosting', 'Merchandise collaboration opportunity'],
            'turnaround': 'Season/Series',
            'reach': '2,200,000+ viewers',
        },
    ],
}

# Billboard pricing by location (for LED billboards)
BILLBOARD_PACKAGES = {
    'bb-1': {  # LED Billboard
        'pricing_by_state': {
            'Jos': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 24000, 'per_impression': 93},
            'Kastina': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
            'Minna': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
            'Ilorin': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
            'Yola': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
            'Kano (Sabowar Kofa)': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
            'Kano (Airport)': {'monthly': 2283333, 'weekly': 577917, 'daily': 89565, 'hourly': 9200, 'belt_buying': 33761, 'per_impression': 116},
            'Maiduguri': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
            'Kaduna': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
            'Sokoto': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
            'Makurdi': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
            'Owerri': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
            'Calabar': {'monthly': 1866666, 'weekly': 489333, 'daily': 69476, 'hourly': 8000, 'belt_buying': 27000, 'per_impression': 93},
        }
    }
}

# Digital Ads platform packages
DIGITAL_ADS_PACKAGES = {
    'facebook': {
        'id': 'facebook',
        'name': 'Facebook Ads',
        'platform': 'Facebook',
        'description': 'Reach over 2.9 billion monthly active users with targeted advertising. Perfect for brand awareness, lead generation, and driving sales.',
        'image_url': 'https://images.unsplash.com/photo-1662070479020-73f77887c87c?w=800&h=400&fit=crop',
        'status': 'approved',
        'packages': [
            {'id': 'fb-starter', 'title': 'Starter Package', 'description': 'Perfect for small businesses starting with Facebook advertising', 'price': 50000, 'duration': '1 Month', 'ad_spend': '30,000 included', 'deliverables': ['Campaign setup & optimization', '2 ad creatives (image/carousel)', 'Audience research & targeting', 'Basic A/B testing', 'Weekly performance report', 'Up to 10,000 reach']},
            {'id': 'fb-growth', 'title': 'Growth Package', 'description': 'Scale your reach with advanced targeting and multiple campaigns', 'price': 150000, 'duration': '1 Month', 'ad_spend': '100,000 included', 'deliverables': ['Multiple campaign management', '5 ad creatives (image/video/carousel)', 'Advanced audience segmentation', 'Retargeting campaign setup', 'Conversion tracking setup', 'Bi-weekly strategy calls', 'Up to 50,000 reach']},
            {'id': 'fb-premium', 'title': 'Premium Package', 'description': 'Full-service Facebook advertising for maximum ROI', 'price': 350000, 'duration': '1 Month', 'ad_spend': '250,000 included', 'deliverables': ['Dedicated account manager', '10+ ad creatives with professional design', 'Custom audience & lookalike creation', 'Full funnel campaign strategy', 'Landing page optimization', 'Weekly strategy calls', 'Detailed ROI reporting', 'Up to 150,000 reach']},
            {'id': 'fb-enterprise', 'title': 'Enterprise Package', 'description': 'Enterprise-level advertising with unlimited support', 'price': 750000, 'duration': '1 Month', 'ad_spend': '500,000+ included', 'deliverables': ['Priority account management', 'Unlimited ad creatives', 'Multi-market campaigns', 'Advanced analytics & attribution', 'CRM integration', 'Daily optimization', '24/7 monitoring', 'Monthly strategy review', 'Up to 500,000+ reach']},
        ]
    },
    'instagram': {
        'id': 'instagram',
        'name': 'Instagram Ads',
        'platform': 'Instagram',
        'description': 'Visual-first advertising on the most engaging social platform. Leverage Stories, Reels, and Shopping features to drive results.',
        'image_url': 'https://images.unsplash.com/photo-1689852501130-e89d9e54aa41?w=800&h=400&fit=crop',
        'status': 'approved',
        'packages': [
            {'id': 'ig-starter', 'title': 'Feed & Stories Starter', 'description': 'Get started with Instagram advertising on Feed and Stories', 'price': 60000, 'duration': '1 Month', 'ad_spend': '35,000 included', 'deliverables': ['Feed + Stories ad setup', '3 creative designs', 'Hashtag strategy', 'Audience targeting', 'Instagram Shopping setup (if applicable)', 'Weekly analytics report', 'Up to 15,000 reach']},
            {'id': 'ig-reels', 'title': 'Reels Growth Package', 'description': 'Maximize reach with Instagram Reels advertising', 'price': 120000, 'duration': '1 Month', 'ad_spend': '70,000 included', 'deliverables': ['Reels ad campaign management', '5 Reels video creatives', 'Trending audio integration', 'Stories + Feed cross-promotion', 'Influencer collaboration support', 'Bi-weekly reports', 'Up to 50,000 reach']},
            {'id': 'ig-ecommerce', 'title': 'E-commerce Pro Package', 'description': 'Drive sales with Instagram Shopping and product tags', 'price': 250000, 'duration': '1 Month', 'ad_spend': '150,000 included', 'deliverables': ['Instagram Shop optimization', 'Product catalog ads', 'Collection ads setup', 'Dynamic product ads', 'Checkout integration', 'Shopping tags management', 'Conversion tracking', 'Up to 100,000 reach']},
            {'id': 'ig-brand', 'title': 'Brand Awareness Campaign', 'description': 'Build brand recognition with full Instagram presence', 'price': 400000, 'duration': '1 Month', 'ad_spend': '280,000 included', 'deliverables': ['Full platform coverage (Feed, Stories, Reels, Explore)', '15+ creative assets', 'Branded content partnerships', 'AR filter creation', 'User-generated content strategy', 'Dedicated creative team', 'Up to 250,000 reach']},
        ]
    },
    'tiktok': {
        'id': 'tiktok',
        'name': 'TikTok Ads',
        'platform': 'TikTok',
        'description': 'Capture Gen Z and millennial audiences with viral short-form video content. Highest organic reach potential among social platforms.',
        'image_url': 'https://images.unsplash.com/photo-1620396748669-46bd3128ccce?w=800&h=400&fit=crop',
        'status': 'approved',
        'packages': [
            {'id': 'tt-starter', 'title': 'In-Feed Starter', 'description': 'Get started with TikTok In-Feed ads', 'price': 75000, 'duration': '1 Month', 'ad_spend': '50,000 included', 'deliverables': ['In-Feed ad campaign setup', '3 video creatives (15-60 sec)', 'Trending sound integration', 'Basic audience targeting', 'Performance tracking', 'Weekly reports', 'Up to 25,000 views']},
            {'id': 'tt-spark', 'title': 'Spark Ads Package', 'description': 'Boost organic content with Spark Ads for authentic reach', 'price': 150000, 'duration': '1 Month', 'ad_spend': '100,000 included', 'deliverables': ['Spark Ads setup & management', '5 boosted videos', 'Creator content amplification', 'Native look & feel optimization', 'Interest-based targeting', 'Comment management', 'Bi-weekly optimization', 'Up to 75,000 views']},
            {'id': 'tt-viral', 'title': 'Viral Campaign Package', 'description': 'Designed for maximum viral potential and engagement', 'price': 300000, 'duration': '1 Month', 'ad_spend': '200,000 included', 'deliverables': ['Multi-format campaign (In-Feed + TopView)', '10 video creatives', 'Trend jacking strategy', 'Hashtag challenge participation', 'Creator partnership coordination', 'Daily optimization', 'Real-time trend monitoring', 'Up to 200,000 views']},
            {'id': 'tt-branded', 'title': 'Branded Hashtag Challenge', 'description': 'Create your own viral challenge with branded hashtag', 'price': 500000, 'duration': '6 Days Campaign', 'ad_spend': '350,000 included', 'deliverables': ['Custom branded hashtag', 'Challenge concept & strategy', 'Official challenge page', 'Creator seeding (5+ creators)', 'In-Feed promotion', 'Music/sound creation', 'UGC management', 'Up to 500,000+ views']},
        ]
    },
    'snapchat': {
        'id': 'snapchat',
        'name': 'Snapchat Ads',
        'platform': 'Snapchat',
        'description': 'Connect with young audiences (13-34 age group) through immersive AR experiences, vertical video, and story ads.',
        'image_url': 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/cdbi8ulp_snapchat.png',
        'status': 'approved',
        'packages': [
            {'id': 'snap-starter', 'title': 'Snap Ads Starter', 'description': 'Entry-level Snapchat advertising with Snap Ads', 'price': 55000, 'duration': '1 Month', 'ad_spend': '30,000 included', 'deliverables': ['Single Image/Video Snap Ads', '3 creative variations', 'Swipe-up action setup', 'Demographic targeting', 'Basic pixel tracking', 'Weekly performance report', 'Up to 20,000 impressions']},
            {'id': 'snap-story', 'title': 'Story Ads Package', 'description': 'Full-screen Story Ads for deeper engagement', 'price': 120000, 'duration': '1 Month', 'ad_spend': '75,000 included', 'deliverables': ['Story Ads (3-20 images/videos)', 'Branded tile design', 'Attachment page setup', 'Interest-based targeting', 'Swipe-up conversions', 'Bi-weekly optimization', 'Up to 60,000 impressions']},
            {'id': 'snap-collection', 'title': 'Collection Ads Package', 'description': 'Showcase products with shoppable Collection Ads', 'price': 200000, 'duration': '1 Month', 'ad_spend': '130,000 included', 'deliverables': ['Collection Ads setup', 'Product catalog integration', '4 featured products per ad', 'Dynamic retargeting', 'Tappable product tiles', 'Conversion optimization', 'Up to 100,000 impressions']},
            {'id': 'snap-ar', 'title': 'AR Lens Campaign', 'description': 'Create immersive AR experiences with branded lenses', 'price': 450000, 'duration': '1 Month', 'ad_spend': '300,000 included', 'deliverables': ['Custom AR Lens creation', 'Face lens OR World lens', 'Branded elements integration', 'Lens promotion campaign', 'Engagement analytics', 'Lens sharing features', 'Premium placement', 'Up to 300,000 lens plays']},
        ]
    },
    'google': {
        'id': 'google',
        'name': 'Google Ads',
        'platform': 'Google',
        'description': 'Dominate search results, display network, and YouTube. Best for intent-based marketing when users are actively searching.',
        'image_url': 'https://images.unsplash.com/photo-1628320281190-89b24da58b0f?w=800&h=400&fit=crop',
        'status': 'approved',
        'packages': [
            {'id': 'google-search', 'title': 'Search Ads Starter', 'description': 'Get found when customers search for your products/services', 'price': 100000, 'duration': '1 Month', 'ad_spend': '60,000 included', 'deliverables': ['Search campaign setup', 'Keyword research (50+ keywords)', '5 ad groups', '10 responsive search ads', 'Negative keyword management', 'Conversion tracking', 'Weekly optimization', 'Monthly report']},
            {'id': 'google-display', 'title': 'Display Network Package', 'description': 'Reach customers across millions of websites', 'price': 180000, 'duration': '1 Month', 'ad_spend': '120,000 included', 'deliverables': ['Display campaign setup', '10 banner designs (multiple sizes)', 'Responsive display ads', 'Audience targeting', 'Placement optimization', 'Remarketing setup', 'View-through tracking', 'Bi-weekly reports']},
            {'id': 'google-youtube', 'title': 'YouTube Ads Package', 'description': 'Video advertising on the world\'s largest video platform', 'price': 250000, 'duration': '1 Month', 'ad_spend': '170,000 included', 'deliverables': ['YouTube campaign setup', 'Video ad optimization', 'TrueView In-Stream ads', 'Bumper ads (6 sec)', 'Discovery ads', 'Channel targeting', 'Audience lists creation', 'View & engagement reports']},
            {'id': 'google-full', 'title': 'Full Google Suite', 'description': 'Comprehensive Google Ads management across all networks', 'price': 500000, 'duration': '1 Month', 'ad_spend': '350,000 included', 'deliverables': ['Search + Display + YouTube', 'Performance Max campaigns', '100+ keywords managed', '20+ ad creatives', 'Shopping ads (if applicable)', 'App campaigns (if applicable)', 'Advanced audience strategies', 'Dedicated account manager', 'Weekly strategy calls']},
        ]
    },
    'whatsapp': {
        'id': 'whatsapp',
        'name': 'WhatsApp Business Ads',
        'platform': 'WhatsApp',
        'description': 'Direct customer communication through Click-to-WhatsApp ads. Perfect for customer service, lead generation, and direct sales.',
        'image_url': 'https://images.unsplash.com/photo-1642724978500-c13b821afe04?w=800&h=400&fit=crop',
        'status': 'approved',
        'packages': [
            {'id': 'wa-starter', 'title': 'Click-to-Chat Starter', 'description': 'Start conversations with Click-to-WhatsApp ads', 'price': 45000, 'duration': '1 Month', 'ad_spend': '25,000 included', 'deliverables': ['Click-to-WhatsApp ad setup', 'WhatsApp Business optimization', '3 ad creatives', 'Quick reply templates', 'Welcome message setup', 'Basic automation', 'Weekly conversation report', 'Up to 500 conversations']},
            {'id': 'wa-business', 'title': 'Business Messaging Package', 'description': 'Full WhatsApp Business integration with catalog', 'price': 100000, 'duration': '1 Month', 'ad_spend': '60,000 included', 'deliverables': ['Full catalog setup', 'Click-to-WhatsApp campaigns', '5 ad creatives', 'Product messaging templates', 'Order notification setup', 'Chat flow automation', 'CRM integration support', 'Up to 1,500 conversations']},
            {'id': 'wa-broadcast', 'title': 'Broadcast Campaign Package', 'description': 'Reach existing customers with broadcast messages', 'price': 180000, 'duration': '1 Month', 'ad_spend': '100,000 included', 'deliverables': ['Broadcast list management', 'Message template approval', 'Marketing message campaigns', 'Utility message setup', 'Opt-in management', 'Delivery analytics', 'Up to 5,000 messages', 'A/B testing']},
            {'id': 'wa-enterprise', 'title': 'WhatsApp API Enterprise', 'description': 'Full WhatsApp Business API integration', 'price': 350000, 'duration': '1 Month', 'ad_spend': '200,000 included', 'deliverables': ['WhatsApp Business API setup', 'Custom chatbot development', 'Multi-agent support', 'Advanced automation flows', 'Payment integration', 'Order tracking messages', 'Priority support', 'Unlimited conversations', 'Custom reporting dashboard']},
        ]
    },
}


async def migrate_packages():
    """Run the data migration to populate packages for all items"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print("=" * 60)
    print("STARTING DATA MIGRATION: Populating default packages")
    print("=" * 60)
    
    # 1. Migrate Influencers
    print("\n[1/4] Migrating Influencer Packages...")
    influencer_count = 0
    for inf_id, packages in INFLUENCER_PACKAGES.items():
        result = await db.influencers.update_one(
            {"id": inf_id, "$or": [{"packages": {"$exists": False}}, {"packages": []}, {"packages": None}]},
            {"$set": {"packages": packages, "migrated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.modified_count > 0:
            influencer_count += 1
            print(f"   + Updated {inf_id} with {len(packages)} packages")
    print(f"   Total influencers updated: {influencer_count}")
    
    # 2. Migrate Kannywood Productions
    print("\n[2/4] Migrating Kannywood Packages...")
    kannywood_count = 0
    for kw_id, packages in KANNYWOOD_PACKAGES.items():
        result = await db.kannywood.update_one(
            {"id": kw_id, "$or": [{"packages": {"$exists": False}}, {"packages": []}, {"packages": None}]},
            {"$set": {"packages": packages, "migrated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.modified_count > 0:
            kannywood_count += 1
            print(f"   + Updated {kw_id} with {len(packages)} packages")
    
    # Also update kannywood_placements collection if it exists separately
    for kw_id, packages in KANNYWOOD_PACKAGES.items():
        await db.kannywood_placements.update_one(
            {"id": kw_id, "$or": [{"packages": {"$exists": False}}, {"packages": []}, {"packages": None}]},
            {"$set": {"packages": packages, "migrated_at": datetime.now(timezone.utc).isoformat()}}
        )
    print(f"   Total kannywood productions updated: {kannywood_count}")
    
    # 3. Migrate Billboard Pricing
    print("\n[3/4] Migrating Billboard Pricing Data...")
    billboard_count = 0
    for bb_id, data in BILLBOARD_PACKAGES.items():
        result = await db.billboards.update_one(
            {"id": bb_id, "$or": [{"pricing_by_state": {"$exists": False}}, {"pricing_by_state": {}}]},
            {"$set": {"pricing_by_state": data['pricing_by_state'], "migrated_at": datetime.now(timezone.utc).isoformat()}}
        )
        if result.modified_count > 0:
            billboard_count += 1
            print(f"   + Updated {bb_id} with pricing for {len(data['pricing_by_state'])} states")
    print(f"   Total billboards updated: {billboard_count}")
    
    # 4. Populate Digital Ads Collection
    print("\n[4/4] Populating Digital Ads Collection...")
    digital_ads_count = 0
    for platform_id, data in DIGITAL_ADS_PACKAGES.items():
        existing = await db.digital_ads.find_one({"id": platform_id})
        if not existing:
            data["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.digital_ads.insert_one(data)
            digital_ads_count += 1
            print(f"   + Created {platform_id} with {len(data['packages'])} packages")
        else:
            # Update existing with packages if missing
            result = await db.digital_ads.update_one(
                {"id": platform_id, "$or": [{"packages": {"$exists": False}}, {"packages": []}, {"packages": None}]},
                {"$set": {"packages": data['packages'], "migrated_at": datetime.now(timezone.utc).isoformat()}}
            )
            if result.modified_count > 0:
                digital_ads_count += 1
                print(f"   + Updated {platform_id} with {len(data['packages'])} packages")
    print(f"   Total digital ads updated/created: {digital_ads_count}")
    
    print("\n" + "=" * 60)
    print("DATA MIGRATION COMPLETE!")
    print("=" * 60)
    print(f"\nSummary:")
    print(f"  - Influencers updated: {influencer_count}")
    print(f"  - Kannywood productions updated: {kannywood_count}")
    print(f"  - Billboards updated: {billboard_count}")
    print(f"  - Digital ads updated/created: {digital_ads_count}")
    
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate_packages())
