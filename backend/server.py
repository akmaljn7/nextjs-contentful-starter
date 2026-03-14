from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
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
    except Exception as e:
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

@api_router.get("/influencers/{influencer_id}", response_model=Influencer)
async def get_influencer(influencer_id: str):
    influencer = await db.influencers.find_one({"id": influencer_id}, {"_id": 0})
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")
    
    if isinstance(influencer['created_at'], str):
        influencer['created_at'] = datetime.fromisoformat(influencer['created_at'])
    
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

@api_router.get("/billboards", response_model=List[Billboard])
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
        query["billboard_type"] = billboard_type
    if max_price:
        query["price_monthly"] = {"$lte": max_price}
    
    billboards = await db.billboards.find(query, {"_id": 0}).to_list(100)
    for bb in billboards:
        if isinstance(bb['created_at'], str):
            bb['created_at'] = datetime.fromisoformat(bb['created_at'])
    
    return billboards

@api_router.get("/billboards/{billboard_id}", response_model=Billboard)
async def get_billboard(billboard_id: str):
    billboard = await db.billboards.find_one({"id": billboard_id}, {"_id": 0})
    if not billboard:
        raise HTTPException(status_code=404, detail="Billboard not found")
    
    if isinstance(billboard['created_at'], str):
        billboard['created_at'] = datetime.fromisoformat(billboard['created_at'])
    
    return billboard

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

@api_router.get("/kannywood", response_model=List[KannywoodPlacement])
async def get_kannywood_placements(status: str = "approved"):
    placements = await db.kannywood_placements.find({"status": status}, {"_id": 0}).to_list(100)
    for p in placements:
        if isinstance(p['created_at'], str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
    
    return placements

# Order Routes
@api_router.post("/orders", response_model=Order)
async def create_order(data: OrderCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "advertiser":
        raise HTTPException(status_code=403, detail="Only advertisers can create orders")
    
    # Get supplier_id from listing
    collection_map = {
        "influencer": "influencers",
        "billboard": "billboards",
        "digital_ad": "digital_ad_services",
        "kannywood": "kannywood_placements"
    }
    
    collection = db[collection_map.get(data.listing_type)]
    listing = await collection.find_one({"id": data.listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    platform_fee = data.total_amount * 0.10  # 10% platform fee
    supplier_payout = data.total_amount - platform_fee
    
    order = Order(
        advertiser_id=current_user.id,
        supplier_id=listing['supplier_id'],
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

# Mock Payment Routes
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
        total_orders = await db.orders.count_documents({"advertiser_id": current_user.id})
        active_orders = await db.orders.count_documents({
            "advertiser_id": current_user.id,
            "order_status": {"$in": ["pending", "accepted", "in_progress", "proof_submitted"]}
        })
        total_spent = 0
        orders = await db.orders.find({"advertiser_id": current_user.id, "payment_status": "paid"}).to_list(1000)
        for order in orders:
            total_spent += order.get('total_amount', 0)
        
        return {
            "total_orders": total_orders,
            "active_orders": active_orders,
            "completed_orders": total_orders - active_orders,
            "total_spent": total_spent
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
    
    elif current_user.role == "admin":
        total_users = await db.users.count_documents({})
        pending_verifications = await db.influencers.count_documents({"status": "pending"})
        pending_verifications += await db.billboards.count_documents({"status": "pending"})
        total_orders = await db.orders.count_documents({})
        
        return {
            "total_users": total_users,
            "pending_verifications": pending_verifications,
            "total_orders": total_orders
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
