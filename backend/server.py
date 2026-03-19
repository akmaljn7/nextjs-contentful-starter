from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import httpx
import hmac
import hashlib

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Paystack settings
PAYSTACK_SECRET_KEY = os.environ.get('PAYSTACK_SECRET_KEY')
PAYSTACK_PUBLIC_KEY = os.environ.get('PAYSTACK_PUBLIC_KEY')

security = HTTPBearer()

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ============= MODELS =============

# Auth Models
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: str
    role: Literal["advertiser", "supplier", "admin"] = "advertiser"
    language_preference: Literal["en", "ha"] = "en"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: str
    role: str
    language_preference: str = "en"
    verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

# Listing Models
class InfluencerCreate(BaseModel):
    name: str
    handle: str
    platform: str  # Instagram, Twitter, TikTok, Facebook
    followers: int
    niche: str
    bio: str
    location: str
    price_per_post: float
    engagement_rate: Optional[float] = None
    audience_demographics: Optional[str] = None
    image_url: Optional[str] = None

class Influencer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_id: str
    name: str
    handle: str
    platform: str
    followers: int
    niche: str
    bio: str
    location: str
    price_per_post: float
    engagement_rate: Optional[float] = None
    audience_demographics: Optional[str] = None
    image_url: Optional[str] = None
    verified: bool = False
    rating: float = 0.0
    total_reviews: int = 0
    response_time: str = "Within 24 hours"
    completion_rate: float = 100.0
    status: str = "pending"  # pending, approved, rejected
    packages: Optional[List[dict]] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BillboardCreate(BaseModel):
    location_name: str
    city: str
    state: str
    dimensions: str  # e.g., "48x14 feet"
    billboard_type: str  # Digital, Static, LED
    traffic_daily: int
    price_monthly: float
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image_url: Optional[str] = None

class Billboard(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_id: str
    location_name: str
    city: str
    state: str
    dimensions: str
    billboard_type: str
    traffic_daily: int
    price_monthly: float
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    image_url: Optional[str] = None
    verified: bool = False
    availability: bool = True
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DigitalAdServiceCreate(BaseModel):
    service_name: str
    platform: str  # Facebook, Instagram, Google, Snapchat
    description: str
    price_starting: float
    includes: List[str]  # e.g., ["Ad creative", "Targeting", "Optimization"]

class DigitalAdService(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_id: str
    service_name: str
    platform: str
    description: str
    price_starting: float
    includes: List[str]
    verified: bool = False
    rating: float = 0.0
    total_reviews: int = 0
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class KannywoodPlacementCreate(BaseModel):
    production_name: str
    placement_type: str  # Product Integration, Sponsorship, Brand Placement
    description: str
    estimated_reach: int
    price: float
    release_date: Optional[str] = None

class KannywoodPlacement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    supplier_id: str
    production_name: str
    placement_type: str
    description: str
    estimated_reach: int
    price: float
    release_date: Optional[str] = None
    verified: bool = False
    status: str = "pending"
    packages: Optional[List[dict]] = []
    title: Optional[str] = None
    director: Optional[str] = None
    genre: Optional[str] = None
    est_reach: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Order Models
class OrderCreate(BaseModel):
    listing_type: str  # influencer, billboard, digital_ad, kannywood
    listing_id: str
    package_details: dict
    total_amount: float

class Order(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    advertiser_id: str
    supplier_id: str
    listing_type: str
    listing_id: str
    package_details: dict
    total_amount: float
    platform_fee: float
    supplier_payout: float
    payment_status: str = "pending"  # pending, paid, held, released, refunded
    order_status: str = "pending"  # pending, accepted, in_progress, proof_submitted, completed, disputed, cancelled
    brief_url: Optional[str] = None
    proof_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrderUpdate(BaseModel):
    order_status: Optional[str] = None
    payment_status: Optional[str] = None
    brief_url: Optional[str] = None
    proof_url: Optional[str] = None

# Review Models
class ReviewCreate(BaseModel):
    order_id: str
    listing_type: str
    listing_id: str
    rating: int  # 1-5
    comment: str

class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    advertiser_id: str
    listing_type: str
    listing_id: str
    rating: int
    comment: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Message Models
class MessageCreate(BaseModel):
    order_id: str
    message: str

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_id: str
    sender_id: str
    sender_role: str
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============= UTILITIES =============

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication")
        
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user_doc:
            raise HTTPException(status_code=401, detail="User not found")
        
        if isinstance(user_doc['created_at'], str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        
        return User(**user_doc)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid authentication")

# ============= ROUTES =============

# Auth Routes
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed_password = pwd_context.hash(user_data.password)
    
    # Create user
    user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        role=user_data.role,
        language_preference=user_data.language_preference
    )
    
    user_dict = user.model_dump()
    user_dict['password'] = hashed_password
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Create token
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not pwd_context.verify(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user = User(**user_doc)
    access_token = create_access_token(data={"sub": user.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Influencer Routes
@api_router.post("/influencers", response_model=Influencer)
async def create_influencer(data: InfluencerCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["supplier", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    influencer = Influencer(supplier_id=current_user.id, **data.model_dump())
    doc = influencer.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.influencers.insert_one(doc)
    return influencer

@api_router.get("/influencers", response_model=List[Influencer])
async def get_influencers(
    city: Optional[str] = None,
    niche: Optional[str] = None,
    min_followers: Optional[int] = None,
    max_price: Optional[float] = None,
    status: str = "approved"
):
    query = {"status": status}
    if city:
        query["location"] = {"$regex": city, "$options": "i"}
    if niche:
        query["niche"] = {"$regex": niche, "$options": "i"}
    if min_followers:
        query["followers"] = {"$gte": min_followers}
    if max_price:
        query["price_per_post"] = {"$lte": max_price}
    
    influencers = await db.influencers.find(query, {"_id": 0}).to_list(100)
    for inf in influencers:
        if isinstance(inf['created_at'], str):
            inf['created_at'] = datetime.fromisoformat(inf['created_at'])
    
    return influencers

@api_router.get("/influencers/{influencer_id}")
async def get_influencer(influencer_id: str):
    influencer = await db.influencers.find_one({"id": influencer_id}, {"_id": 0})
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    return influencer

# Billboard Routes
@api_router.post("/billboards", response_model=Billboard)
async def create_billboard(data: BillboardCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["supplier", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    billboard = Billboard(supplier_id=current_user.id, **data.model_dump())
    doc = billboard.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.billboards.insert_one(doc)
    return billboard

@api_router.get("/billboards")
async def get_billboards(
    city: Optional[str] = None,
    billboard_type: Optional[str] = None,
    max_price: Optional[float] = None,
    status: str = "approved"
):
    query = {"status": status}
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if billboard_type:
        query["$or"] = [{"billboard_type": billboard_type}, {"type": billboard_type}]
    if max_price:
        query["$or"] = [{"price_monthly": {"$lte": max_price}}, {"price": {"$lte": max_price}}]
    
    billboards = await db.billboards.find(query, {"_id": 0}).to_list(100)
    
    # Normalize billboard data to handle both old and new formats
    normalized = []
    for bb in billboards:
        normalized_bb = {
            "id": bb.get("id"),
            "supplier_id": bb.get("supplier_id", "admin"),
            "location_name": bb.get("location_name") or bb.get("name") or bb.get("location", ""),
            "name": bb.get("name") or bb.get("location_name", ""),
            "city": bb.get("city", ""),
            "state": bb.get("state", ""),
            "dimensions": bb.get("dimensions", ""),
            "billboard_type": bb.get("billboard_type") or bb.get("type", "LED"),
            "type": bb.get("type") or bb.get("billboard_type", "LED"),
            "traffic_daily": bb.get("traffic_daily", 0),
            "traffic": bb.get("traffic", ""),
            "price_monthly": bb.get("price_monthly") or bb.get("price", 0),
            "price": bb.get("price") or bb.get("price_monthly", 0),
            "description": bb.get("description", ""),
            "latitude": bb.get("latitude"),
            "longitude": bb.get("longitude"),
            "image_url": bb.get("image_url", ""),
            "verified": bb.get("verified", False),
            "availability": bb.get("availability", True),
            "status": bb.get("status", "approved"),
            "pricing_by_state": bb.get("pricing_by_state", {}),
            "created_at": bb.get("created_at")
        }
        normalized.append(normalized_bb)
    
    return normalized

@api_router.get("/billboards/{billboard_id}")
async def get_billboard(billboard_id: str):
    billboard = await db.billboards.find_one({"id": billboard_id}, {"_id": 0})
    if not billboard:
        raise HTTPException(status_code=404, detail="Billboard not found")
    
    # Normalize billboard data
    normalized_bb = {
        "id": billboard.get("id"),
        "supplier_id": billboard.get("supplier_id", "admin"),
        "location_name": billboard.get("location_name") or billboard.get("name") or billboard.get("location", ""),
        "name": billboard.get("name") or billboard.get("location_name", ""),
        "city": billboard.get("city", ""),
        "state": billboard.get("state", ""),
        "dimensions": billboard.get("dimensions", ""),
        "billboard_type": billboard.get("billboard_type") or billboard.get("type", "LED"),
        "type": billboard.get("type") or billboard.get("billboard_type", "LED"),
        "traffic_daily": billboard.get("traffic_daily", 0),
        "traffic": billboard.get("traffic", ""),
        "price_monthly": billboard.get("price_monthly") or billboard.get("price", 0),
        "price": billboard.get("price") or billboard.get("price_monthly", 0),
        "description": billboard.get("description", ""),
        "latitude": billboard.get("latitude"),
        "longitude": billboard.get("longitude"),
        "image_url": billboard.get("image_url", ""),
        "verified": billboard.get("verified", False),
        "availability": billboard.get("availability", True),
        "status": billboard.get("status", "approved"),
        "pricing_by_state": billboard.get("pricing_by_state", {}),
        "created_at": billboard.get("created_at")
    }
    
    return normalized_bb

# Digital Ad Service Routes
@api_router.post("/digital-ads", response_model=DigitalAdService)
async def create_digital_ad_service(data: DigitalAdServiceCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["supplier", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    service = DigitalAdService(supplier_id=current_user.id, **data.model_dump())
    doc = service.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.digital_ad_services.insert_one(doc)
    return service

@api_router.get("/digital-ads", response_model=List[DigitalAdService])
async def get_digital_ad_services(platform: Optional[str] = None, status: str = "approved"):
    query = {"status": status}
    if platform:
        query["platform"] = platform
    
    services = await db.digital_ad_services.find(query, {"_id": 0}).to_list(100)
    for svc in services:
        if isinstance(svc['created_at'], str):
            svc['created_at'] = datetime.fromisoformat(svc['created_at'])
    
    return services

@api_router.get("/digital-ads/{platform_id}")
async def get_digital_ad_by_id(platform_id: str):
    """Get a single digital ad platform with its packages"""
    # Try new digital_ads collection first (has packages)
    digital_ad = await db.digital_ads.find_one({"id": platform_id}, {"_id": 0})
    if digital_ad:
        return digital_ad
    
    # Fallback to digital_ad_services collection
    service = await db.digital_ad_services.find_one({"id": platform_id}, {"_id": 0})
    if service:
        if isinstance(service.get('created_at'), str):
            service['created_at'] = datetime.fromisoformat(service['created_at'])
        return service
    
    raise HTTPException(status_code=404, detail="Digital ad platform not found")

# Kannywood Routes
@api_router.post("/kannywood", response_model=KannywoodPlacement)
async def create_kannywood_placement(data: KannywoodPlacementCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["supplier", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    placement = KannywoodPlacement(supplier_id=current_user.id, **data.model_dump())
    doc = placement.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.kannywood_placements.insert_one(doc)
    return placement

@api_router.get("/kannywood")
async def get_kannywood_placements(status: str = "approved"):
    # Get from both collections
    placements = await db.kannywood_placements.find({"status": status}, {"_id": 0}).to_list(100)
    admin_placements = await db.kannywood.find({"status": status}, {"_id": 0}).to_list(100)
    
    # Combine both
    all_placements = placements + admin_placements
    
    # Helper to safely parse estimated reach
    def parse_reach(value):
        if value is None:
            return 0
        if isinstance(value, int):
            return value
        if isinstance(value, str):
            # Remove commas and spaces
            clean = value.replace(",", "").replace(" ", "").lower()
            # Handle formats like "1.5m", "2m", "500k"
            try:
                if 'm' in clean:
                    return int(float(clean.replace('m', '')) * 1000000)
                elif 'k' in clean:
                    return int(float(clean.replace('k', '')) * 1000)
                else:
                    return int(float(clean)) if clean else 0
            except (ValueError, TypeError):
                return 0
        return 0
    
    # Normalize data for response
    normalized = []
    for p in all_placements:
        normalized.append({
            "id": p.get("id"),
            "supplier_id": p.get("supplier_id", "admin"),
            "production_name": p.get("production_name") or p.get("title", ""),
            "title": p.get("title") or p.get("production_name", ""),
            "placement_type": p.get("placement_type") or p.get("genre", "Feature Film"),
            "genre": p.get("genre") or p.get("placement_type", ""),
            "description": p.get("description", ""),
            "estimated_reach": parse_reach(p.get("estimated_reach") or p.get("est_reach")),
            "est_reach": p.get("est_reach") or str(p.get("estimated_reach", 0)),
            "price": p.get("price", 0),
            "release_date": p.get("release_date"),
            "director": p.get("director"),
            "image_url": p.get("image_url"),
            "verified": p.get("verified", False),
            "status": p.get("status", "approved"),
            "packages": p.get("packages", []),
            "created_at": p.get("created_at")
        })
    
    return normalized

@api_router.get("/kannywood/{placement_id}")
async def get_kannywood_placement(placement_id: str):
    # First check the kannywood_placements collection
    placement = await db.kannywood_placements.find_one({"id": placement_id}, {"_id": 0})
    
    # Also check the kannywood collection (admin-created)
    if not placement:
        placement = await db.kannywood.find_one({"id": placement_id}, {"_id": 0})
    
    if not placement:
        raise HTTPException(status_code=404, detail="Kannywood placement not found")
    
    return placement

# Order Routes
@api_router.post("/orders", response_model=Order)
async def create_order(data: OrderCreate, current_user: User = Depends(get_current_user)):
    # Allow any authenticated user to create orders (they can be both advertiser and supplier)
    # if current_user.role != "advertiser":
    #     raise HTTPException(status_code=403, detail="Only advertisers can create orders")
    
    # Get supplier_id from listing
    collection_map = {
        "influencer": "influencers",
        "billboard": "billboards",
        "digital_ad": "digital_ad_services",
        "digital-ad": "digital_ad_services",
        "kannywood": "kannywood_placements"
    }
    
    # Normalize listing_type
    listing_type = data.listing_type
    
    # Handle digital-ad type specially - these are platform-managed services
    if listing_type == "digital-ad":
        # Digital ads are managed by Lightban platform, use a default supplier
        supplier_id = "lightban-platform"
    else:
        if listing_type not in collection_map:
            raise HTTPException(status_code=400, detail=f"Invalid listing type: {listing_type}")
        
        collection = db[collection_map.get(listing_type)]
        listing = await collection.find_one({"id": data.listing_id}, {"_id": 0})
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        supplier_id = listing['supplier_id']
    
    platform_fee = data.total_amount * 0.10  # 10% platform fee
    supplier_payout = data.total_amount - platform_fee
    
    order = Order(
        advertiser_id=current_user.id,
        supplier_id=supplier_id,
        listing_type=data.listing_type,
        listing_id=data.listing_id,
        package_details=data.package_details,
        total_amount=data.total_amount,
        platform_fee=platform_fee,
        supplier_payout=supplier_payout
    )
    
    doc = order.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.orders.insert_one(doc)
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_orders(current_user: User = Depends(get_current_user)):
    query = {}
    if current_user.role == "advertiser":
        query["advertiser_id"] = current_user.id
    elif current_user.role == "supplier":
        query["supplier_id"] = current_user.id
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    for order in orders:
        if isinstance(order['created_at'], str):
            order['created_at'] = datetime.fromisoformat(order['created_at'])
        if isinstance(order['updated_at'], str):
            order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    
    return orders

@api_router.get("/orders/{order_id}", response_model=Order)
async def get_order(order_id: str, current_user: User = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if isinstance(order['created_at'], str):
        order['created_at'] = datetime.fromisoformat(order['created_at'])
    if isinstance(order['updated_at'], str):
        order['updated_at'] = datetime.fromisoformat(order['updated_at'])
    
    return order

@api_router.patch("/orders/{order_id}", response_model=Order)
async def update_order(order_id: str, data: OrderUpdate, current_user: User = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if isinstance(updated_order['created_at'], str):
        updated_order['created_at'] = datetime.fromisoformat(updated_order['created_at'])
    if isinstance(updated_order['updated_at'], str):
        updated_order['updated_at'] = datetime.fromisoformat(updated_order['updated_at'])
    
    return updated_order

class OrderStatusUpdate(BaseModel):
    payment_status: Optional[str] = None
    order_status: Optional[str] = None

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, data: OrderStatusUpdate, current_user: User = Depends(get_current_user)):
    """Update order payment and order status"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Check if user owns this order
    if order['advertiser_id'] != current_user.id and current_user.role != 'admin':
        raise HTTPException(status_code=403, detail="Not authorized to update this order")
    
    update_data = {'updated_at': datetime.now(timezone.utc).isoformat()}
    if data.payment_status:
        update_data['payment_status'] = data.payment_status
    if data.order_status:
        update_data['order_status'] = data.order_status
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    return {"status": "success", "message": "Order status updated", "order_id": order_id}

# Paystack Payment Models
class PaymentInitialize(BaseModel):
    order_id: str
    email: str
    callback_url: str
    amount: Optional[float] = None  # Optional for direct amount (consultations)
    metadata: Optional[dict] = None  # Optional metadata for consultations

class PaymentVerifyResponse(BaseModel):
    status: str
    message: str
    order_id: Optional[str] = None
    amount: Optional[float] = None

# Paystack Payment Routes
@api_router.post("/payments/initialize")
async def initialize_payment(data: PaymentInitialize, current_user: User = Depends(get_current_user)):
    """Initialize Paystack payment transaction for orders or consultations"""
    
    # Check if this is a consultation payment
    is_consultation = data.metadata and data.metadata.get('type') == 'consultation'
    
    if is_consultation:
        # Handle consultation payment
        consultation = await db.consultations.find_one({"id": data.order_id}, {"_id": 0})
        if not consultation:
            raise HTTPException(status_code=404, detail="Consultation not found")
        
        if consultation['user_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to pay for this consultation")
        
        amount = data.amount or consultation.get('price', 0)
        amount_kobo = int(amount * 100)
        reference = f"lightban_consult_{data.order_id}_{uuid.uuid4().hex[:8]}"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.paystack.co/transaction/initialize",
                    headers={
                        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "email": data.email,
                        "amount": amount_kobo,
                        "reference": reference,
                        "callback_url": data.callback_url,
                        "metadata": {
                            "type": "consultation",
                            "consultation_id": data.order_id,
                            "user_id": current_user.id,
                            "custom_fields": [
                                {
                                    "display_name": "Consultation ID",
                                    "variable_name": "consultation_id",
                                    "value": data.order_id
                                }
                            ]
                        }
                    }
                )
                result = response.json()
            
            if result.get("status"):
                # Store payment reference
                await db.consultations.update_one(
                    {"id": data.order_id},
                    {"$set": {
                        "payment_reference": reference,
                        "payment_status": "pending",
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                return {
                    "status": "success",
                    "authorization_url": result["data"]["authorization_url"],
                    "access_code": result["data"]["access_code"],
                    "reference": result["data"]["reference"]
                }
            
            raise HTTPException(status_code=400, detail=result.get("message", "Payment initialization failed"))
        
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Payment service error: {str(e)}")
    
    else:
        # Handle order payment (original logic)
        order = await db.orders.find_one({"id": data.order_id}, {"_id": 0})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        if order['advertiser_id'] != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to pay for this order")
        
        # Convert to kobo (smallest unit)
        amount_kobo = int(order['total_amount'] * 100)
        reference = f"lightban_{data.order_id}_{uuid.uuid4().hex[:8]}"
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.paystack.co/transaction/initialize",
                    headers={
                        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "email": data.email,
                        "amount": amount_kobo,
                        "reference": reference,
                        "callback_url": data.callback_url,
                        "metadata": {
                            "order_id": data.order_id,
                            "user_id": current_user.id,
                            "custom_fields": [
                                {
                                    "display_name": "Order ID",
                                    "variable_name": "order_id",
                                    "value": data.order_id
                                }
                            ]
                        }
                    }
                )
                result = response.json()
            
            if result.get("status"):
                # Store payment reference
                await db.orders.update_one(
                    {"id": data.order_id},
                    {"$set": {
                        "payment_reference": reference,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                return {
                    "status": "success",
                    "authorization_url": result["data"]["authorization_url"],
                    "access_code": result["data"]["access_code"],
                    "reference": result["data"]["reference"]
                }
            
            raise HTTPException(status_code=400, detail=result.get("message", "Payment initialization failed"))
        
        except httpx.RequestError as e:
            raise HTTPException(status_code=500, detail=f"Payment service error: {str(e)}")

@api_router.get("/payments/verify/{reference}")
async def verify_payment(reference: str, current_user: User = Depends(get_current_user)):
    """Verify Paystack payment transaction"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.paystack.co/transaction/verify/{reference}",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"}
            )
            result = response.json()
        
        if result.get("status") and result["data"]["status"] == "success":
            # Get order_id from reference or metadata
            order_id = result["data"]["metadata"].get("order_id")
            
            if order_id:
                # Update order payment status
                await db.orders.update_one(
                    {"id": order_id},
                    {"$set": {
                        "payment_status": "paid",
                        "payment_reference": reference,
                        "payment_verified_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
            
            return {
                "status": "success",
                "message": "Payment verified successfully",
                "order_id": order_id,
                "amount": result["data"]["amount"] / 100  # Convert from kobo
            }
        
        return {
            "status": "failed",
            "message": result.get("message", "Payment verification failed")
        }
    
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Payment service error: {str(e)}")

@api_router.post("/payments/webhook")
async def paystack_webhook(request: Request):
    """Handle Paystack webhook events"""
    signature = request.headers.get("x-paystack-signature")
    body = await request.body()
    
    # Verify signature
    computed_signature = hmac.new(
        PAYSTACK_SECRET_KEY.encode('utf-8'),
        body,
        hashlib.sha512
    ).hexdigest()
    
    if not hmac.compare_digest(computed_signature, signature or ""):
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    event = await request.json()
    
    if event.get("event") == "charge.success":
        reference = event["data"]["reference"]
        order_id = event["data"]["metadata"].get("order_id")
        
        if order_id:
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {
                    "payment_status": "paid",
                    "payment_reference": reference,
                    "payment_verified_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"Payment successful for order {order_id}")
    
    return {"status": "ok"}

@api_router.get("/payments/config")
async def get_payment_config():
    """Get Paystack public key for frontend"""
    return {"public_key": PAYSTACK_PUBLIC_KEY}

# Mock Payment Routes (for testing)
@api_router.post("/payments/mock-payment")
async def mock_payment(order_id: str, current_user: User = Depends(get_current_user)):
    """Mock Paystack payment - simulates successful payment"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update order payment status
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {
            "payment_status": "paid",
            "order_status": "pending",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "status": "success",
        "message": "Payment processed successfully (MOCKED)",
        "order_id": order_id,
        "payment_status": "paid"
    }

# Review Routes
@api_router.post("/reviews", response_model=Review)
async def create_review(data: ReviewCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "advertiser":
        raise HTTPException(status_code=403, detail="Only advertisers can leave reviews")
    
    # Check if order exists and belongs to user
    order = await db.orders.find_one({"id": data.order_id, "advertiser_id": current_user.id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    review = Review(
        advertiser_id=current_user.id,
        order_id=data.order_id,
        listing_type=data.listing_type,
        listing_id=data.listing_id,
        rating=data.rating,
        comment=data.comment
    )
    
    doc = review.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.reviews.insert_one(doc)
    
    # Update listing ratings
    collection_map = {
        "influencer": "influencers",
        "billboard": "billboards",
        "digital_ad": "digital_ad_services",
        "kannywood": "kannywood_placements"
    }
    
    collection = db[collection_map.get(data.listing_type)]
    reviews = await db.reviews.find({"listing_id": data.listing_id}).to_list(1000)
    avg_rating = sum(r['rating'] for r in reviews) / len(reviews) if reviews else 0
    
    await collection.update_one(
        {"id": data.listing_id},
        {"$set": {"rating": round(avg_rating, 1), "total_reviews": len(reviews)}}
    )
    
    return review

@api_router.get("/reviews/{listing_id}")
async def get_reviews(listing_id: str):
    reviews = await db.reviews.find({"listing_id": listing_id}, {"_id": 0}).to_list(100)
    for review in reviews:
        if isinstance(review['created_at'], str):
            review['created_at'] = datetime.fromisoformat(review['created_at'])
    
    return reviews

# Message Routes
@api_router.post("/messages", response_model=Message)
async def create_message(data: MessageCreate, current_user: User = Depends(get_current_user)):
    message = Message(
        order_id=data.order_id,
        sender_id=current_user.id,
        sender_role=current_user.role,
        message=data.message
    )
    
    doc = message.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.messages.insert_one(doc)
    return message

@api_router.get("/messages/{order_id}")
async def get_messages(order_id: str, current_user: User = Depends(get_current_user)):
    messages = await db.messages.find({"order_id": order_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    for msg in messages:
        if isinstance(msg['created_at'], str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    
    return messages

# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role == "advertiser":
        # Get all orders for this user
        all_orders = await db.orders.find({"advertiser_id": current_user.id}, {"_id": 0}).to_list(1000)
        
        # Get all consultations for this user
        all_consultations = await db.consultations.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
        
        # Order stats
        order_total = len(all_orders)
        order_pending = len([o for o in all_orders if o.get('order_status') in ['pending', 'accepted', 'in_progress', 'awaiting_payment']])
        order_completed = len([o for o in all_orders if o.get('order_status') == 'completed'])
        order_cancelled = len([o for o in all_orders if o.get('order_status') == 'cancelled'])
        order_spent = sum(o.get('total_amount', 0) for o in all_orders if o.get('payment_status') == 'paid')
        
        # Consultation stats
        consultation_total = len(all_consultations)
        consultation_pending = len([c for c in all_consultations if c.get('status') in ['pending', 'scheduled']])
        consultation_completed = len([c for c in all_consultations if c.get('status') == 'completed'])
        consultation_cancelled = len([c for c in all_consultations if c.get('status') == 'cancelled'])
        consultation_spent = sum(c.get('price', 0) for c in all_consultations if c.get('payment_status') == 'paid')
        
        # Combined totals (orders + consultations)
        total_orders = order_total + consultation_total
        pending_orders = order_pending + consultation_pending
        completed_orders = order_completed + consultation_completed
        cancelled_orders = order_cancelled + consultation_cancelled
        total_spent = order_spent + consultation_spent
        
        return {
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "completed_orders": completed_orders,
            "cancelled_orders": cancelled_orders,
            "active_orders": pending_orders,  # For backward compatibility
            "total_spent": total_spent,
            # Breakdown for detailed view
            "orders_count": order_total,
            "consultations_count": consultation_total
        }
    
    elif current_user.role == "admin":
        # Admin sees all orders
        all_orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
        all_consultations = await db.consultations.find({}, {"_id": 0}).to_list(1000)
        
        # Order stats
        order_total = len(all_orders)
        order_pending = len([o for o in all_orders if o.get('order_status') in ['pending', 'accepted', 'in_progress', 'awaiting_payment']])
        order_completed = len([o for o in all_orders if o.get('order_status') == 'completed'])
        order_cancelled = len([o for o in all_orders if o.get('order_status') == 'cancelled'])
        order_revenue = sum(o.get('total_amount', 0) for o in all_orders if o.get('payment_status') == 'paid')
        
        # Consultation stats
        consultation_total = len(all_consultations)
        consultation_pending = len([c for c in all_consultations if c.get('status') in ['pending', 'scheduled']])
        consultation_completed = len([c for c in all_consultations if c.get('status') == 'completed'])
        consultation_cancelled = len([c for c in all_consultations if c.get('status') == 'cancelled'])
        consultation_revenue = sum(c.get('price', 0) for c in all_consultations if c.get('payment_status') == 'paid')
        
        total_users = await db.users.count_documents({})
        
        # Combined stats (orders + consultations)
        return {
            "total_orders": order_total + consultation_total,
            "pending_orders": order_pending + consultation_pending,
            "completed_orders": order_completed + consultation_completed,
            "cancelled_orders": order_cancelled + consultation_cancelled,
            "total_revenue": order_revenue + consultation_revenue,
            "total_spent": order_revenue + consultation_revenue,  # Alias for dashboard compatibility
            "total_consultations": consultation_total,
            "pending_consultations": consultation_pending,
            "total_users": total_users,
            # Breakdown
            "orders_count": order_total,
            "consultations_count": consultation_total
        }
    
    elif current_user.role == "supplier":
        total_listings = 0
        total_listings += await db.influencers.count_documents({"supplier_id": current_user.id})
        total_listings += await db.billboards.count_documents({"supplier_id": current_user.id})
        total_listings += await db.digital_ad_services.count_documents({"supplier_id": current_user.id})
        total_listings += await db.kannywood_placements.count_documents({"supplier_id": current_user.id})
        
        total_orders = await db.orders.count_documents({"supplier_id": current_user.id})
        pending_orders = await db.orders.count_documents({
            "supplier_id": current_user.id,
            "order_status": "pending"
        })
        
        total_earned = 0
        orders = await db.orders.find({
            "supplier_id": current_user.id,
            "payment_status": "released"
        }).to_list(1000)
        for order in orders:
            total_earned += order.get('supplier_payout', 0)
        
        return {
            "total_listings": total_listings,
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "total_earned": total_earned
        }
    
    return {}

# Admin Routes
@api_router.patch("/admin/listings/{listing_type}/{listing_id}")
async def admin_approve_listing(
    listing_type: str,
    listing_id: str,
    status: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    collection_map = {
        "influencer": "influencers",
        "billboard": "billboards",
        "digital_ad": "digital_ad_services",
        "kannywood": "kannywood_placements"
    }
    
    collection = db[collection_map.get(listing_type)]
    result = await collection.update_one(
        {"id": listing_id},
        {"$set": {"status": status, "verified": status == "approved"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    return {"status": "success", "message": f"Listing {status}"}

@api_router.get("/admin/pending-listings")
async def get_pending_listings(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    influencers = await db.influencers.find({"status": "pending"}, {"_id": 0}).to_list(50)
    billboards = await db.billboards.find({"status": "pending"}, {"_id": 0}).to_list(50)
    digital_ads = await db.digital_ad_services.find({"status": "pending"}, {"_id": 0}).to_list(50)
    kannywood = await db.kannywood_placements.find({"status": "pending"}, {"_id": 0}).to_list(50)
    
    return {
        "influencers": influencers,
        "billboards": billboards,
        "digital_ads": digital_ads,
        "kannywood": kannywood
    }

# Admin Order Management
@api_router.get("/admin/orders")
async def get_all_orders_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get user info for each order
    for order in orders:
        user = await db.users.find_one({"id": order.get("advertiser_id")}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        order["user_info"] = user or {}
    
    return orders

@api_router.put("/admin/orders/{order_id}/status")
async def admin_update_order_status(
    order_id: str,
    order_status: str,
    payment_status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {
        "order_status": order_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if payment_status:
        update_data["payment_status"] = payment_status
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    return {"status": "success", "message": f"Order status updated to {order_status}"}

# Admin Consultation Management
@api_router.get("/admin/consultations")
async def get_all_consultations_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    consultations = await db.consultations.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Get user info for each consultation
    for consultation in consultations:
        user = await db.users.find_one({"id": consultation.get("user_id")}, {"_id": 0, "name": 1, "email": 1, "phone": 1})
        consultation["user_info"] = user or {}
    
    return consultations

@api_router.put("/admin/consultations/{consultation_id}/status")
async def admin_update_consultation_status(
    consultation_id: str,
    status: str,
    payment_status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    consultation = await db.consultations.find_one({"id": consultation_id}, {"_id": 0})
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    update_data = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if payment_status:
        update_data["payment_status"] = payment_status
    
    await db.consultations.update_one({"id": consultation_id}, {"$set": update_data})
    
    return {"status": "success", "message": f"Consultation status updated to {status}"}

# ============= CONSULTATION ROUTES =============

class ConsultationCreate(BaseModel):
    user_id: str
    consultation_type: str  # physical or online
    package_title: str
    price: float
    business_name: str
    industry: str
    business_stage: Optional[str] = None
    description: str
    goals: Optional[str] = None
    budget_range: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None
    contact_name: str
    contact_email: Optional[str] = None
    contact_phone: str

@api_router.post("/consultations")
async def create_consultation(
    consultation: ConsultationCreate,
    current_user: User = Depends(get_current_user)
):
    consultation_data = consultation.model_dump()
    consultation_data["id"] = str(uuid.uuid4())
    consultation_data["status"] = "pending"
    consultation_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.consultations.insert_one(consultation_data)
    
    # Remove _id before returning
    consultation_data.pop("_id", None)
    
    return {
        "status": "success",
        "message": "Consultation request submitted successfully",
        "consultation": consultation_data
    }

@api_router.get("/consultations")
async def get_user_consultations(current_user: User = Depends(get_current_user)):
    consultations = await db.consultations.find(
        {"user_id": current_user.id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return consultations

@api_router.get("/consultations/{consultation_id}")
async def get_consultation(
    consultation_id: str,
    current_user: User = Depends(get_current_user)
):
    consultation = await db.consultations.find_one(
        {"id": consultation_id},
        {"_id": 0}
    )
    
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    # Only allow owner or admin to view
    if consultation["user_id"] != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return consultation

@api_router.patch("/consultations/{consultation_id}/status")
async def update_consultation_status(
    consultation_id: str,
    status: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.consultations.update_one(
        {"id": consultation_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    return {"status": "success", "message": f"Consultation status updated to {status}"}

class ConsultationPaymentUpdate(BaseModel):
    payment_status: str
    payment_method: str

@api_router.patch("/consultations/{consultation_id}/payment")
async def update_consultation_payment(
    consultation_id: str,
    payment_update: ConsultationPaymentUpdate,
    current_user: User = Depends(get_current_user)
):
    # Check if consultation exists and belongs to user
    consultation = await db.consultations.find_one({"id": consultation_id})
    
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    if consultation["user_id"] != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.consultations.update_one(
        {"id": consultation_id},
        {"$set": {
            "payment_status": payment_update.payment_status,
            "payment_method": payment_update.payment_method,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"status": "success", "message": "Payment status updated"}

# ============= COMPREHENSIVE ADMIN CRUD ROUTES =============

# Admin check decorator helper
async def check_admin(current_user: User):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return True

# ========== INFLUENCER MANAGEMENT ==========

class AdminInfluencerCreate(BaseModel):
    name: str
    handle: str
    platform: str
    followers: int
    niche: str
    bio: str
    location: str
    price_per_post: float
    engagement_rate: Optional[float] = 0.0
    audience_demographics: Optional[str] = ""
    image_url: Optional[str] = ""
    verified: bool = False
    rating: float = 0.0
    total_reviews: int = 0
    response_time: str = "Within 24 hours"
    completion_rate: float = 100.0
    status: str = "approved"
    packages: Optional[List[dict]] = []

class AdminInfluencerUpdate(BaseModel):
    name: Optional[str] = None
    handle: Optional[str] = None
    platform: Optional[str] = None
    followers: Optional[int] = None
    niche: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    price_per_post: Optional[float] = None
    engagement_rate: Optional[float] = None
    audience_demographics: Optional[str] = None
    image_url: Optional[str] = None
    verified: Optional[bool] = None
    rating: Optional[float] = None
    total_reviews: Optional[int] = None
    response_time: Optional[str] = None
    completion_rate: Optional[float] = None
    status: Optional[str] = None
    packages: Optional[List[dict]] = None

@api_router.get("/admin/influencers")
async def admin_get_all_influencers(current_user: User = Depends(get_current_user)):
    await check_admin(current_user)
    influencers = await db.influencers.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return influencers

@api_router.post("/admin/influencers")
async def admin_create_influencer(
    influencer: AdminInfluencerCreate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    influencer_data = influencer.model_dump()
    influencer_data["id"] = f"inf-{str(uuid.uuid4())[:8]}"
    influencer_data["supplier_id"] = "admin"
    influencer_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.influencers.insert_one(influencer_data)
    influencer_data.pop("_id", None)
    
    return {"status": "success", "message": "Influencer created", "influencer": influencer_data}

@api_router.put("/admin/influencers/{influencer_id}")
async def admin_update_influencer(
    influencer_id: str,
    influencer: AdminInfluencerUpdate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    existing = await db.influencers.find_one({"id": influencer_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    # Build update data, excluding None values
    update_data = {}
    for k, v in influencer.model_dump().items():
        if v is not None:
            # For packages, always update what's sent from admin (admin form is source of truth)
            # The frontend should load existing packages and send the complete list
            update_data[k] = v
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.influencers.update_one({"id": influencer_id}, {"$set": update_data})
    
    updated = await db.influencers.find_one({"id": influencer_id}, {"_id": 0})
    return {"status": "success", "message": "Influencer updated", "influencer": updated}

@api_router.delete("/admin/influencers/{influencer_id}")
async def admin_delete_influencer(
    influencer_id: str,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    result = await db.influencers.delete_one({"id": influencer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    return {"status": "success", "message": "Influencer deleted"}

# ========== BILLBOARD MANAGEMENT ==========

class AdminBillboardCreate(BaseModel):
    name: str
    type: str  # LED, Static, Lightbox
    location: str
    city: Optional[str] = ""
    state: Optional[str] = ""
    dimensions: Optional[str] = ""
    traffic: Optional[str] = ""
    traffic_daily: Optional[int] = 0
    price: float
    price_monthly: Optional[float] = 0
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    verified: bool = False
    availability: bool = True
    status: str = "approved"
    pricing_by_state: Optional[dict] = {}

class AdminBillboardUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    location: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    dimensions: Optional[str] = None
    traffic: Optional[str] = None
    traffic_daily: Optional[int] = None
    price: Optional[float] = None
    price_monthly: Optional[float] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    verified: Optional[bool] = None
    availability: Optional[bool] = None
    status: Optional[str] = None
    pricing_by_state: Optional[dict] = None

@api_router.get("/admin/billboards")
async def admin_get_all_billboards(current_user: User = Depends(get_current_user)):
    await check_admin(current_user)
    billboards = await db.billboards.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return billboards

@api_router.post("/admin/billboards")
async def admin_create_billboard(
    billboard: AdminBillboardCreate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    billboard_data = billboard.model_dump()
    billboard_data["id"] = f"bb-{str(uuid.uuid4())[:8]}"
    billboard_data["supplier_id"] = "admin"
    billboard_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.billboards.insert_one(billboard_data)
    billboard_data.pop("_id", None)
    
    return {"status": "success", "message": "Billboard created", "billboard": billboard_data}

@api_router.put("/admin/billboards/{billboard_id}")
async def admin_update_billboard(
    billboard_id: str,
    billboard: AdminBillboardUpdate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    existing = await db.billboards.find_one({"id": billboard_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Billboard not found")
    
    update_data = {k: v for k, v in billboard.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.billboards.update_one({"id": billboard_id}, {"$set": update_data})
    
    updated = await db.billboards.find_one({"id": billboard_id}, {"_id": 0})
    return {"status": "success", "message": "Billboard updated", "billboard": updated}

@api_router.delete("/admin/billboards/{billboard_id}")
async def admin_delete_billboard(
    billboard_id: str,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    result = await db.billboards.delete_one({"id": billboard_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Billboard not found")
    
    return {"status": "success", "message": "Billboard deleted"}

# ========== DIGITAL ADS MANAGEMENT ==========

class AdminDigitalAdCreate(BaseModel):
    platform: str  # Facebook, Instagram, TikTok, Google, WhatsApp, Snapchat
    name: str
    description: Optional[str] = ""
    image_url: Optional[str] = ""
    status: str = "approved"
    packages: Optional[List[dict]] = []

class AdminDigitalAdUpdate(BaseModel):
    platform: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[str] = None
    packages: Optional[List[dict]] = None

@api_router.get("/admin/digital-ads")
async def admin_get_all_digital_ads(current_user: User = Depends(get_current_user)):
    await check_admin(current_user)
    digital_ads = await db.digital_ads.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return digital_ads

@api_router.post("/admin/digital-ads")
async def admin_create_digital_ad(
    digital_ad: AdminDigitalAdCreate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    digital_ad_data = digital_ad.model_dump()
    digital_ad_data["id"] = digital_ad.platform.lower().replace(" ", "-")
    digital_ad_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    # Check if platform already exists
    existing = await db.digital_ads.find_one({"id": digital_ad_data["id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Digital ad platform already exists")
    
    await db.digital_ads.insert_one(digital_ad_data)
    digital_ad_data.pop("_id", None)
    
    return {"status": "success", "message": "Digital ad created", "digital_ad": digital_ad_data}

@api_router.put("/admin/digital-ads/{digital_ad_id}")
async def admin_update_digital_ad(
    digital_ad_id: str,
    digital_ad: AdminDigitalAdUpdate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    existing = await db.digital_ads.find_one({"id": digital_ad_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Digital ad not found")
    
    update_data = {k: v for k, v in digital_ad.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.digital_ads.update_one({"id": digital_ad_id}, {"$set": update_data})
    
    updated = await db.digital_ads.find_one({"id": digital_ad_id}, {"_id": 0})
    return {"status": "success", "message": "Digital ad updated", "digital_ad": updated}

@api_router.delete("/admin/digital-ads/{digital_ad_id}")
async def admin_delete_digital_ad(
    digital_ad_id: str,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    result = await db.digital_ads.delete_one({"id": digital_ad_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Digital ad not found")
    
    return {"status": "success", "message": "Digital ad deleted"}

# ========== KANNYWOOD MANAGEMENT ==========

class AdminKannywoodCreate(BaseModel):
    title: str
    director: Optional[str] = ""
    genre: Optional[str] = ""
    description: Optional[str] = ""
    est_reach: Optional[str] = ""
    release_date: Optional[str] = ""
    price: float
    image_url: Optional[str] = ""
    status: str = "approved"
    packages: Optional[List[dict]] = []

class AdminKannywoodUpdate(BaseModel):
    title: Optional[str] = None
    director: Optional[str] = None
    genre: Optional[str] = None
    description: Optional[str] = None
    est_reach: Optional[str] = None
    release_date: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    status: Optional[str] = None
    packages: Optional[List[dict]] = None

@api_router.get("/admin/kannywood")
async def admin_get_all_kannywood(current_user: User = Depends(get_current_user)):
    await check_admin(current_user)
    kannywood = await db.kannywood.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return kannywood

@api_router.post("/admin/kannywood")
async def admin_create_kannywood(
    kannywood: AdminKannywoodCreate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    kannywood_data = kannywood.model_dump()
    kannywood_data["id"] = f"kw-{str(uuid.uuid4())[:8]}"
    kannywood_data["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.kannywood.insert_one(kannywood_data)
    kannywood_data.pop("_id", None)
    
    return {"status": "success", "message": "Kannywood production created", "kannywood": kannywood_data}

@api_router.put("/admin/kannywood/{kannywood_id}")
async def admin_update_kannywood(
    kannywood_id: str,
    kannywood: AdminKannywoodUpdate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    existing = await db.kannywood.find_one({"id": kannywood_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Kannywood production not found")
    
    update_data = {k: v for k, v in kannywood.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.kannywood.update_one({"id": kannywood_id}, {"$set": update_data})
    
    updated = await db.kannywood.find_one({"id": kannywood_id}, {"_id": 0})
    return {"status": "success", "message": "Kannywood production updated", "kannywood": updated}

@api_router.delete("/admin/kannywood/{kannywood_id}")
async def admin_delete_kannywood(
    kannywood_id: str,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    result = await db.kannywood.delete_one({"id": kannywood_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Kannywood production not found")
    
    return {"status": "success", "message": "Kannywood production deleted"}

# ========== USER MANAGEMENT ==========

class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    verified: Optional[bool] = None
    language_preference: Optional[str] = None

@api_router.get("/admin/users")
async def admin_get_all_users(current_user: User = Depends(get_current_user)):
    await check_admin(current_user)
    users = await db.users.find({}, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(500)
    return users

@api_router.get("/admin/users/{user_id}")
async def admin_get_user(user_id: str, current_user: User = Depends(get_current_user)):
    await check_admin(current_user)
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@api_router.put("/admin/users/{user_id}")
async def admin_update_user(
    user_id: str,
    user_update: AdminUserUpdate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {k: v for k, v in user_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one({"id": user_id}, {"$set": update_data})
    
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
    return {"status": "success", "message": "User updated", "user": updated}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    # Prevent deleting self
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"status": "success", "message": "User deleted"}

# ========== COMPLETE ORDER MANAGEMENT ==========

class AdminOrderUpdate(BaseModel):
    order_status: Optional[str] = None
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    total_amount: Optional[float] = None
    notes: Optional[str] = None

@api_router.put("/admin/orders/{order_id}")
async def admin_update_order_full(
    order_id: str,
    order_update: AdminOrderUpdate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    existing = await db.orders.find_one({"id": order_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {k: v for k, v in order_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return {"status": "success", "message": "Order updated", "order": updated}

@api_router.delete("/admin/orders/{order_id}")
async def admin_delete_order(
    order_id: str,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    result = await db.orders.delete_one({"id": order_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return {"status": "success", "message": "Order deleted"}

# ========== COMPLETE CONSULTATION MANAGEMENT ==========

class AdminConsultationUpdate(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    payment_method: Optional[str] = None
    price: Optional[float] = None
    notes: Optional[str] = None
    scheduled_date: Optional[str] = None
    scheduled_time: Optional[str] = None

@api_router.put("/admin/consultations/{consultation_id}")
async def admin_update_consultation_full(
    consultation_id: str,
    consultation_update: AdminConsultationUpdate,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    existing = await db.consultations.find_one({"id": consultation_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    update_data = {k: v for k, v in consultation_update.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.consultations.update_one({"id": consultation_id}, {"$set": update_data})
    
    updated = await db.consultations.find_one({"id": consultation_id}, {"_id": 0})
    return {"status": "success", "message": "Consultation updated", "consultation": updated}

@api_router.delete("/admin/consultations/{consultation_id}")
async def admin_delete_consultation(
    consultation_id: str,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    result = await db.consultations.delete_one({"id": consultation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    return {"status": "success", "message": "Consultation deleted"}

# ========== SITE SETTINGS MANAGEMENT ==========

class SiteSettings(BaseModel):
    site_name: Optional[str] = "Lightban Ads Network"
    tagline: Optional[str] = "Northern Nigeria's Premier Ad Marketplace"
    contact_email: Optional[str] = "info@lightban.com"
    contact_phone: Optional[str] = "+234 800 000 0001"
    office_address: Optional[str] = "No 671, Zoo Road, Inec Street, Kano"
    business_hours: Optional[str] = "Monday - Saturday: 9:00 AM - 5:00 PM"
    currency: Optional[str] = "NGN"
    currency_symbol: Optional[str] = "₦"
    consultation_price_online: Optional[float] = 15000
    consultation_price_office: Optional[float] = 25000
    platform_fee_percentage: Optional[float] = 10.0
    social_links: Optional[dict] = {}
    seo_title: Optional[str] = ""
    seo_description: Optional[str] = ""

@api_router.get("/settings")
async def get_public_settings():
    """Public endpoint to get site settings (for consultation prices, contact info, etc.)"""
    settings = await db.site_settings.find_one({}, {"_id": 0})
    if not settings:
        # Return default settings if none exist
        return SiteSettings().model_dump()
    return settings

@api_router.get("/admin/settings")
async def admin_get_settings(current_user: User = Depends(get_current_user)):
    await check_admin(current_user)
    settings = await db.site_settings.find_one({}, {"_id": 0})
    if not settings:
        # Return default settings if none exist
        return SiteSettings().model_dump()
    return settings

@api_router.put("/admin/settings")
async def admin_update_settings(
    settings: SiteSettings,
    current_user: User = Depends(get_current_user)
):
    await check_admin(current_user)
    
    settings_data = settings.model_dump()
    settings_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Upsert settings
    await db.site_settings.update_one(
        {},
        {"$set": settings_data},
        upsert=True
    )
    
    return {"status": "success", "message": "Settings updated", "settings": settings_data}

# ========== ADMIN STATS SUMMARY ==========

@api_router.get("/admin/stats/summary")
async def admin_get_stats_summary(current_user: User = Depends(get_current_user)):
    await check_admin(current_user)
    
    # Get counts for all collections
    total_users = await db.users.count_documents({})
    total_influencers = await db.influencers.count_documents({})
    total_billboards = await db.billboards.count_documents({})
    total_digital_ads = await db.digital_ads.count_documents({})
    total_kannywood = await db.kannywood.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_consultations = await db.consultations.count_documents({})
    
    # Order stats
    pending_orders = await db.orders.count_documents({"order_status": {"$in": ["pending", "accepted", "in_progress"]}})
    completed_orders = await db.orders.count_documents({"order_status": "completed"})
    cancelled_orders = await db.orders.count_documents({"order_status": "cancelled"})
    
    # Revenue calculation
    paid_orders = await db.orders.find({"payment_status": "paid"}, {"total_amount": 1}).to_list(10000)
    total_revenue = sum(o.get("total_amount", 0) for o in paid_orders)
    
    # Consultation stats
    pending_consultations = await db.consultations.count_documents({"status": "pending"})
    completed_consultations = await db.consultations.count_documents({"status": "completed"})
    
    return {
        "users": {
            "total": total_users,
            "advertisers": await db.users.count_documents({"role": "advertiser"}),
            "suppliers": await db.users.count_documents({"role": "supplier"}),
            "admins": await db.users.count_documents({"role": "admin"})
        },
        "inventory": {
            "influencers": total_influencers,
            "billboards": total_billboards,
            "digital_ads": total_digital_ads,
            "kannywood": total_kannywood
        },
        "orders": {
            "total": total_orders,
            "pending": pending_orders,
            "completed": completed_orders,
            "cancelled": cancelled_orders,
            "revenue": total_revenue
        },
        "consultations": {
            "total": total_consultations,
            "pending": pending_consultations,
            "completed": completed_consultations
        }
    }

# Health check
@api_router.get("/")
async def root():
    return {"message": "Lightban Ads Network API", "status": "active"}

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
