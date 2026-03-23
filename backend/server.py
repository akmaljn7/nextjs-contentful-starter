from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
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
import shutil
import base64
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import asyncio
from concurrent.futures import ThreadPoolExecutor

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create uploads directory
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

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

# Email settings
SMTP_EMAIL = os.environ.get('SMTP_EMAIL')
SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD')
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))

# Thread pool for sending emails in background
email_executor = ThreadPoolExecutor(max_workers=2)

security = HTTPBearer(auto_error=False)

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
    role: Literal["user", "advertiser", "supplier", "admin"] = "user"
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

# Billboard Location Models (States, Roads, Sizes, Packages)
class BillboardRoad(BaseModel):
    name: str
    description: Optional[str] = None

class BillboardStateCreate(BaseModel):
    name: str
    roads: List[BillboardRoad] = []

class BillboardState(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    roads: List[BillboardRoad] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class BillboardSizeCreate(BaseModel):
    name: str  # e.g., "40ft x 12ft"
    description: Optional[str] = None

class BillboardSize(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class LEDBillboardPackageCreate(BaseModel):
    state_id: str
    road_name: str
    size_id: str
    title: str
    description: str
    price: float
    duration: str  # e.g., "1 Month", "1 Week", "1 Day"
    deliverables: List[str] = []
    image_url: Optional[str] = None

class LEDBillboardPackage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    state_id: str
    state_name: Optional[str] = None
    road_name: str
    size_id: str
    size_name: Optional[str] = None
    title: str
    description: str
    price: float
    duration: str
    deliverables: List[str] = []
    image_url: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Static Banner & Lightbox Billboard Models
class BillboardTypeCreate(BaseModel):
    name: str  # e.g., "Standard", "Premium", "Illuminated"
    description: Optional[str] = None
    billboard_category: str  # "static_banner" or "lightbox"

class BillboardType(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    billboard_category: str  # "static_banner" or "lightbox"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StaticBillboardPackageCreate(BaseModel):
    billboard_category: str  # "static_banner" or "lightbox"
    state_id: str
    road_name: str
    type_id: str
    title: str
    description: str
    price: float
    duration: str
    deliverables: List[str] = []
    image_url: Optional[str] = None

class StaticBillboardPackage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    billboard_category: str  # "static_banner" or "lightbox"
    state_id: str
    state_name: Optional[str] = None
    road_name: str
    type_id: str
    type_name: Optional[str] = None
    title: str
    description: str
    price: float
    duration: str
    deliverables: List[str] = []
    image_url: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Order Models
class OrderCreate(BaseModel):
    listing_type: str  # influencer, billboard, digital_ad, kannywood
    listing_id: str
    package_details: dict
    total_amount: float
    package_price: Optional[float] = None  # Original package price for fee calculation
    payment_method: Optional[str] = "online"  # online or cash (pay at office)

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
    payment_method: str = "online"  # online or cash
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
    # Check if credentials were provided
    if credentials is None:
        raise HTTPException(
            status_code=401, 
            detail="Not authenticated", 
            headers={"WWW-Authenticate": "Bearer"}
        )
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

# ============= EMAIL UTILITIES =============

def get_email_base_template(content: str, title: str = "Lightban Ads Network") -> str:
    """Generate base HTML email template with Lightban branding"""
    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
                <td align="center" style="padding: 40px 0;">
                    <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #0d1b2a 0%, #1b3a4b 100%); padding: 30px 40px; text-align: center;">
                                <h1 style="color: #ff6b35; margin: 0; font-size: 28px; font-weight: bold;">LIGHTBAN</h1>
                                <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px;">Northern Nigeria's Premier Ad Marketplace</p>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px;">
                                {content}
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8fafc; padding: 30px 40px; border-top: 1px solid #e2e8f0;">
                                <table role="presentation" style="width: 100%;">
                                    <tr>
                                        <td style="text-align: center;">
                                            <p style="color: #64748b; font-size: 14px; margin: 0 0 10px 0;">
                                                <strong>Lightban Ads Network</strong>
                                            </p>
                                            <p style="color: #94a3b8; font-size: 13px; margin: 0 0 5px 0;">
                                                No 671, Zoo Road, Inec Street, Kano
                                            </p>
                                            <p style="color: #94a3b8; font-size: 13px; margin: 0 0 5px 0;">
                                                Phone: +234 8080000805 | Email: lightbantechnologies@gmail.com
                                            </p>
                                            <p style="color: #94a3b8; font-size: 12px; margin: 15px 0 0 0;">
                                                &copy; 2026 Lightban Ads Network. All rights reserved.
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

def generate_order_confirmation_email(order_data: dict, user_data: dict, settings: dict) -> str:
    """Generate beautiful HTML email for pay-at-office order confirmation"""
    
    office_address = settings.get('office_address', 'No 671, Zoo Road, Inec Street, Kano')
    business_hours = settings.get('business_hours', 'Monday - Saturday: 9:00 AM - 5:00 PM')
    contact_phone = settings.get('contact_phone', '+234 8080000805')
    
    # Format amount with Naira
    total_amount = f"₦{order_data.get('total_amount', 0):,.2f}"
    
    content = f"""
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 80px; height: 80px; background-color: #dcfce7; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
            <span style="font-size: 40px;">✓</span>
        </div>
        <h2 style="color: #0d1b2a; margin: 0 0 10px 0; font-size: 24px;">Order Confirmed!</h2>
        <p style="color: #64748b; margin: 0; font-size: 16px;">Thank you for your order, {user_data.get('name', 'Valued Customer')}!</p>
    </div>
    
    <!-- Order Details Card -->
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
        <h3 style="color: #0d1b2a; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #ff6b35; padding-bottom: 10px;">Order Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Order ID:</td>
                <td style="padding: 8px 0; color: #0d1b2a; font-size: 14px; text-align: right; font-weight: 600;">{order_data.get('id', 'N/A')[:8].upper()}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Service:</td>
                <td style="padding: 8px 0; color: #0d1b2a; font-size: 14px; text-align: right;">{order_data.get('package_details', {}).get('title', 'Advertising Service')}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Category:</td>
                <td style="padding: 8px 0; color: #0d1b2a; font-size: 14px; text-align: right; text-transform: capitalize;">{order_data.get('listing_type', 'N/A').replace('_', ' ')}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Payment Method:</td>
                <td style="padding: 8px 0; color: #ff6b35; font-size: 14px; text-align: right; font-weight: 600;">Pay at Office</td>
            </tr>
            <tr style="border-top: 1px dashed #e2e8f0;">
                <td style="padding: 15px 0 8px 0; color: #0d1b2a; font-size: 16px; font-weight: bold;">Total Amount:</td>
                <td style="padding: 15px 0 8px 0; color: #ff6b35; font-size: 20px; text-align: right; font-weight: bold;">{total_amount}</td>
            </tr>
        </table>
    </div>
    
    <!-- Office Location Card -->
    <div style="background: linear-gradient(135deg, #0d1b2a 0%, #1b3a4b 100%); border-radius: 8px; padding: 25px; margin-bottom: 25px; color: white;">
        <h3 style="color: #ff6b35; margin: 0 0 15px 0; font-size: 18px;">
            <span style="margin-right: 8px;">📍</span> Visit Our Office
        </h3>
        <p style="color: #e2e8f0; margin: 0 0 10px 0; font-size: 15px; line-height: 1.6;">
            <strong>Address:</strong><br>
            {office_address}
        </p>
        <p style="color: #e2e8f0; margin: 0 0 10px 0; font-size: 15px;">
            <strong>Business Hours:</strong><br>
            {business_hours}
        </p>
        <p style="color: #e2e8f0; margin: 0; font-size: 15px;">
            <strong>Contact:</strong> {contact_phone}
        </p>
    </div>
    
    <!-- Important Notice -->
    <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 15px 20px; margin-bottom: 25px;">
        <p style="color: #92400e; margin: 0; font-size: 14px;">
            <strong>⚠️ Important:</strong> Please bring a copy of this email or your Order ID when visiting our office. Payment is due within 3 business days to confirm your order.
        </p>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center;">
        <p style="color: #64748b; font-size: 14px; margin: 0 0 15px 0;">Have questions? We're here to help!</p>
        <a href="https://wa.me/2348080000805" style="display: inline-block; background-color: #25d366; color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: 600; font-size: 14px;">
            💬 Chat on WhatsApp
        </a>
    </div>
    """
    
    return get_email_base_template(content, "Order Confirmation - Lightban Ads Network")

def generate_consultation_scheduled_email(consultation_data: dict, user_data: dict, settings: dict) -> str:
    """Generate beautiful HTML email for consultation scheduling confirmation"""
    
    office_address = settings.get('office_address', 'No 671, Zoo Road, Inec Street, Kano')
    contact_phone = settings.get('contact_phone', '+234 8080000805')
    
    consultation_type = consultation_data.get('consultation_type', 'online')
    is_online = consultation_type.lower() == 'online'
    
    scheduled_date = consultation_data.get('scheduled_date', 'To be confirmed')
    scheduled_time = consultation_data.get('scheduled_time', 'To be confirmed')
    
    # Format price
    price = f"₦{consultation_data.get('price', 0):,.2f}"
    
    # Location section based on type
    if is_online:
        location_section = """
        <div style="background-color: #dbeafe; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 15px 20px; margin-bottom: 25px;">
            <p style="color: #1e40af; margin: 0; font-size: 14px;">
                <strong>💻 Online Consultation</strong><br>
                A meeting link will be shared with you via email or WhatsApp before the scheduled time.
            </p>
        </div>
        """
    else:
        location_section = f"""
        <div style="background: linear-gradient(135deg, #0d1b2a 0%, #1b3a4b 100%); border-radius: 8px; padding: 25px; margin-bottom: 25px; color: white;">
            <h3 style="color: #ff6b35; margin: 0 0 15px 0; font-size: 18px;">
                <span style="margin-right: 8px;">📍</span> Office Location
            </h3>
            <p style="color: #e2e8f0; margin: 0 0 10px 0; font-size: 15px; line-height: 1.6;">
                {office_address}
            </p>
            <p style="color: #e2e8f0; margin: 0; font-size: 15px;">
                <strong>Contact:</strong> {contact_phone}
            </p>
        </div>
        """
    
    content = f"""
    <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 80px; height: 80px; background-color: #dbeafe; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
            <span style="font-size: 40px;">📅</span>
        </div>
        <h2 style="color: #0d1b2a; margin: 0 0 10px 0; font-size: 24px;">Consultation Scheduled!</h2>
        <p style="color: #64748b; margin: 0; font-size: 16px;">Your consultation has been confirmed, {user_data.get('name', 'Valued Customer')}!</p>
    </div>
    
    <!-- Consultation Details Card -->
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
        <h3 style="color: #0d1b2a; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #ff6b35; padding-bottom: 10px;">Appointment Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Consultation ID:</td>
                <td style="padding: 8px 0; color: #0d1b2a; font-size: 14px; text-align: right; font-weight: 600;">{consultation_data.get('id', 'N/A')[:8].upper()}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Package:</td>
                <td style="padding: 8px 0; color: #0d1b2a; font-size: 14px; text-align: right;">{consultation_data.get('package_title', 'Expert Consultation')}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Type:</td>
                <td style="padding: 8px 0; color: #3b82f6; font-size: 14px; text-align: right; font-weight: 600; text-transform: capitalize;">{'🖥️ Online' if is_online else '🏢 In-Office'}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Business:</td>
                <td style="padding: 8px 0; color: #0d1b2a; font-size: 14px; text-align: right;">{consultation_data.get('business_name', 'N/A')}</td>
            </tr>
        </table>
    </div>
    
    <!-- Schedule Highlight -->
    <div style="background: linear-gradient(135deg, #ff6b35 0%, #f97316 100%); border-radius: 8px; padding: 25px; margin-bottom: 25px; text-align: center; color: white;">
        <p style="margin: 0 0 5px 0; font-size: 14px; opacity: 0.9;">Scheduled For</p>
        <p style="margin: 0; font-size: 28px; font-weight: bold;">{scheduled_date}</p>
        <p style="margin: 5px 0 0 0; font-size: 20px;">{scheduled_time}</p>
    </div>
    
    {location_section}
    
    <!-- Price Info -->
    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 25px; text-align: center;">
        <p style="color: #166534; margin: 0 0 5px 0; font-size: 14px;">Consultation Fee</p>
        <p style="color: #166534; margin: 0; font-size: 24px; font-weight: bold;">{price}</p>
        <p style="color: #16a34a; margin: 8px 0 0 0; font-size: 13px;">
            Payment Status: <strong style="text-transform: capitalize;">{consultation_data.get('payment_status', 'Pending')}</strong>
        </p>
    </div>
    
    <!-- Preparation Tips -->
    <div style="margin-bottom: 25px;">
        <h3 style="color: #0d1b2a; margin: 0 0 15px 0; font-size: 16px;">📋 Prepare for Your Consultation:</h3>
        <ul style="color: #64748b; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
            <li>Have your business goals and objectives ready</li>
            <li>Prepare questions about advertising strategies</li>
            <li>Bring examples of ads or campaigns you admire</li>
            <li>Know your target audience and budget range</li>
        </ul>
    </div>
    
    <!-- CTA Button -->
    <div style="text-align: center;">
        <p style="color: #64748b; font-size: 14px; margin: 0 0 15px 0;">Need to reschedule? Contact us!</p>
        <a href="https://wa.me/2348080000805" style="display: inline-block; background-color: #25d366; color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: 600; font-size: 14px;">
            💬 Chat on WhatsApp
        </a>
    </div>
    """
    
    return get_email_base_template(content, "Consultation Scheduled - Lightban Ads Network")

def send_email_sync(to_email: str, subject: str, html_content: str) -> bool:
    """Synchronous function to send email via SMTP"""
    try:
        if not SMTP_EMAIL or not SMTP_PASSWORD:
            logger.warning("SMTP credentials not configured")
            return False
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Lightban Ads Network <{SMTP_EMAIL}>"
        msg['To'] = to_email
        
        # Attach HTML content
        html_part = MIMEText(html_content, 'html')
        msg.attach(html_part)
        
        # Connect and send
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        
        logger.info(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False

async def send_email_async(to_email: str, subject: str, html_content: str) -> bool:
    """Async wrapper for sending emails in background"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(email_executor, send_email_sync, to_email, subject, html_content)

async def get_site_settings() -> dict:
    """Helper to get site settings from database"""
    settings = await db.site_settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "office_address": "No 671, Zoo Road, Inec Street, Kano",
            "contact_phone": "+234 8080000805",
            "business_hours": "Monday - Saturday: 9:00 AM - 5:00 PM",
            "platform_fee_percentage": 10.0
        }
    return settings

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
    # Allow user, supplier, and admin to create influencers
    if current_user.role not in ["user", "supplier", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    influencer = Influencer(supplier_id=current_user.id, **data.model_dump())
    doc = influencer.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.influencers.insert_one(doc)
    return influencer

# Global Search API
@api_router.get("/search")
async def global_search(
    q: Optional[str] = None,
    category: Optional[str] = None,  # influencer, billboard, digital_ad, kannywood, led_billboard, static_billboard
    city: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    limit: int = 20
):
    """
    Global search across all service categories with filters.
    Returns combined results from influencers, billboards, digital ads, kannywood, and billboard packages.
    """
    results = []
    
    # Build text search query
    text_query = {}
    if q:
        text_query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"title": {"$regex": q, "$options": "i"}},
            {"location": {"$regex": q, "$options": "i"}},
            {"location_name": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"niche": {"$regex": q, "$options": "i"}},
            {"genre": {"$regex": q, "$options": "i"}},
            {"platform": {"$regex": q, "$options": "i"}},
            {"service_name": {"$regex": q, "$options": "i"}},
            {"road_name": {"$regex": q, "$options": "i"}},
            {"state_name": {"$regex": q, "$options": "i"}},
        ]
    
    # Search Influencers
    if not category or category == "influencer":
        inf_query = {"status": "approved"}
        if q:
            inf_query["$or"] = [
                {"name": {"$regex": q, "$options": "i"}},
                {"handle": {"$regex": q, "$options": "i"}},
                {"bio": {"$regex": q, "$options": "i"}},
                {"niche": {"$regex": q, "$options": "i"}},
                {"location": {"$regex": q, "$options": "i"}},
            ]
        if city:
            inf_query["location"] = {"$regex": city, "$options": "i"}
        if max_price:
            inf_query["price_per_post"] = {"$lte": max_price}
        if min_price:
            inf_query.setdefault("price_per_post", {})["$gte"] = min_price
        
        influencers = await db.influencers.find(inf_query, {"_id": 0}).to_list(limit)
        for inf in influencers:
            results.append({
                "id": inf["id"],
                "type": "influencer",
                "category": "Influencer",
                "title": inf.get("name", ""),
                "subtitle": f"@{inf.get('handle', '')} • {inf.get('platform', '')}",
                "description": inf.get("bio", ""),
                "location": inf.get("location", ""),
                "price": inf.get("price_per_post", 0),
                "price_label": "per post",
                "image_url": inf.get("profile_image_url") or inf.get("image_url", ""),
                "url": f"/influencers/{inf['id']}",
                "stats": {
                    "followers": inf.get("followers", 0),
                    "engagement": inf.get("engagement_rate", 0)
                }
            })
    
    # Search Billboards
    if not category or category == "billboard":
        bb_query = {"status": "approved"}
        if q:
            bb_query["$or"] = [
                {"location_name": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
                {"billboard_type": {"$regex": q, "$options": "i"}},
                {"location": {"$regex": q, "$options": "i"}},
            ]
        if city:
            bb_query["$or"] = [
                {"location": {"$regex": city, "$options": "i"}},
                {"location_name": {"$regex": city, "$options": "i"}}
            ]
        if max_price:
            bb_query["price_monthly"] = {"$lte": max_price}
        if min_price:
            bb_query.setdefault("price_monthly", {})["$gte"] = min_price
        
        billboards = await db.billboards.find(bb_query, {"_id": 0}).to_list(limit)
        for bb in billboards:
            results.append({
                "id": bb["id"],
                "type": "billboard",
                "category": bb.get("billboard_type", "Billboard"),
                "title": bb.get("location_name", ""),
                "subtitle": bb.get("billboard_type", ""),
                "description": bb.get("description", ""),
                "location": bb.get("location", ""),
                "price": bb.get("price_monthly", 0),
                "price_label": "per month",
                "image_url": bb.get("image_url", ""),
                "url": f"/billboards/{bb['id']}",
                "stats": {
                    "traffic": bb.get("traffic_daily", 0)
                }
            })
    
    # Search LED Billboard Packages
    if not category or category == "led_billboard":
        led_query = {"status": "active"}
        if q:
            led_query["$or"] = [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
                {"state_name": {"$regex": q, "$options": "i"}},
                {"road_name": {"$regex": q, "$options": "i"}},
            ]
        if city:
            led_query["state_name"] = {"$regex": city, "$options": "i"}
        if max_price:
            led_query["price"] = {"$lte": max_price}
        if min_price:
            led_query.setdefault("price", {})["$gte"] = min_price
        
        led_packages = await db.led_billboard_packages.find(led_query, {"_id": 0}).to_list(limit)
        for pkg in led_packages:
            results.append({
                "id": pkg["id"],
                "type": "led_billboard",
                "category": "LED Billboard",
                "title": pkg.get("title", ""),
                "subtitle": f"{pkg.get('state_name', '')} • {pkg.get('road_name', '')}",
                "description": pkg.get("description", ""),
                "location": f"{pkg.get('state_name', '')}, {pkg.get('road_name', '')}",
                "price": pkg.get("price", 0),
                "price_label": pkg.get("duration", ""),
                "image_url": pkg.get("image_url", ""),
                "url": "/billboards",
                "stats": {
                    "size": pkg.get("size_name", "")
                }
            })
    
    # Search Static Billboard Packages
    if not category or category == "static_billboard":
        static_query = {"status": "active"}
        if q:
            static_query["$or"] = [
                {"title": {"$regex": q, "$options": "i"}},
                {"description": {"$regex": q, "$options": "i"}},
                {"state_name": {"$regex": q, "$options": "i"}},
                {"road_name": {"$regex": q, "$options": "i"}},
            ]
        if city:
            static_query["state_name"] = {"$regex": city, "$options": "i"}
        if max_price:
            static_query["price"] = {"$lte": max_price}
        if min_price:
            static_query.setdefault("price", {})["$gte"] = min_price
        
        static_packages = await db.static_billboard_packages.find(static_query, {"_id": 0}).to_list(limit)
        for pkg in static_packages:
            category_label = "Static Banner" if pkg.get("billboard_category") == "static_banner" else "Lightbox"
            results.append({
                "id": pkg["id"],
                "type": pkg.get("billboard_category", "static_billboard"),
                "category": category_label,
                "title": pkg.get("title", ""),
                "subtitle": f"{pkg.get('state_name', '')} • {pkg.get('road_name', '')}",
                "description": pkg.get("description", ""),
                "location": f"{pkg.get('state_name', '')}, {pkg.get('road_name', '')}",
                "price": pkg.get("price", 0),
                "price_label": pkg.get("duration", ""),
                "image_url": pkg.get("image_url", ""),
                "url": "/billboards",
                "stats": {
                    "type": pkg.get("type_name", "")
                }
            })
    
    # Search Digital Ads
    if not category or category == "digital_ad":
        da_query = {"status": "approved"}
        if q:
            da_query["$or"] = [
                {"platform": {"$regex": q, "$options": "i"}},
                {"service_name": {"$regex": q, "$options": "i"}},
                {"name": {"$regex": q, "$options": "i"}},
            ]
        
        digital_ads = await db.digital_ad_services.find(da_query, {"_id": 0}).to_list(limit)
        for da in digital_ads:
            packages = da.get("packages", [])
            min_pkg_price = min([p.get("price", 0) for p in packages]) if packages else 0
            
            results.append({
                "id": da["id"],
                "type": "digital_ad",
                "category": "Digital Ads",
                "title": da.get("platform") or da.get("name", ""),
                "subtitle": da.get("service_name", ""),
                "description": da.get("description", ""),
                "location": "Online",
                "price": min_pkg_price,
                "price_label": "starting from",
                "image_url": da.get("image_url", ""),
                "url": f"/digital-ads/{da['id']}",
                "stats": {
                    "packages": len(packages)
                }
            })
    
    # Search Kannywood
    if not category or category == "kannywood":
        kw_query = {"status": "approved"}
        if q:
            kw_query["$or"] = [
                {"title": {"$regex": q, "$options": "i"}},
                {"director": {"$regex": q, "$options": "i"}},
                {"genre": {"$regex": q, "$options": "i"}},
                {"production_company": {"$regex": q, "$options": "i"}},
            ]
        if max_price:
            kw_query["price"] = {"$lte": max_price}
        if min_price:
            kw_query.setdefault("price", {})["$gte"] = min_price
        
        kannywood = await db.kannywood_placements.find(kw_query, {"_id": 0}).to_list(limit)
        for kw in kannywood:
            results.append({
                "id": kw["id"],
                "type": "kannywood",
                "category": "Kannywood",
                "title": kw.get("title", ""),
                "subtitle": f"Directed by {kw.get('director', '')}",
                "description": kw.get("description", ""),
                "location": kw.get("production_company", ""),
                "price": kw.get("price", 0),
                "price_label": "per placement",
                "image_url": kw.get("image_url", ""),
                "url": f"/kannywood/{kw['id']}",
                "stats": {
                    "genre": kw.get("genre", "")
                }
            })
    
    # Sort by relevance (if search query) or by price
    if q:
        def relevance_score(item):
            title = (item.get("title") or "").lower()
            query = q.lower()
            if title == query:
                return 0
            if title.startswith(query):
                return 1
            if query in title:
                return 2
            return 3
        results.sort(key=relevance_score)
    else:
        results.sort(key=lambda x: x.get("price", 0))
    
    return {
        "results": results[:limit],
        "total": len(results),
        "filters": {
            "query": q,
            "category": category,
            "city": city,
            "min_price": min_price,
            "max_price": max_price
        }
    }

# Get search suggestions (for autocomplete)
@api_router.get("/search/suggestions")
async def get_search_suggestions(q: str, limit: int = 5):
    """Get search suggestions based on partial query"""
    if not q or len(q) < 2:
        return {"suggestions": []}
    
    suggestions = set()
    
    influencers = await db.influencers.find(
        {"name": {"$regex": q, "$options": "i"}, "status": "approved"},
        {"_id": 0, "name": 1}
    ).to_list(limit)
    for inf in influencers:
        suggestions.add(inf["name"])
    
    billboards = await db.billboards.find(
        {"location_name": {"$regex": q, "$options": "i"}, "status": "approved"},
        {"_id": 0, "location_name": 1}
    ).to_list(limit)
    for bb in billboards:
        suggestions.add(bb["location_name"])
    
    states = await db.billboard_states.find(
        {"name": {"$regex": q, "$options": "i"}},
        {"_id": 0, "name": 1}
    ).to_list(limit)
    for state in states:
        suggestions.add(state["name"])
    
    kannywood = await db.kannywood_placements.find(
        {"title": {"$regex": q, "$options": "i"}, "status": "approved"},
        {"_id": 0, "title": 1}
    ).to_list(limit)
    for kw in kannywood:
        suggestions.add(kw["title"])
    
    return {"suggestions": list(suggestions)[:limit]}

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
    # Allow user, supplier, and admin to create billboards
    if current_user.role not in ["user", "supplier", "admin"]:
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

# LED Billboard Location Routes (States, Roads, Sizes, Packages)

@api_router.get("/led-billboard/states")
async def get_billboard_states():
    """Get all states with their roads"""
    states = await db.billboard_states.find({}, {"_id": 0}).to_list(100)
    return states

@api_router.post("/led-billboard/states", response_model=BillboardState)
async def create_billboard_state(data: BillboardStateCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if state already exists
    existing = await db.billboard_states.find_one({"name": {"$regex": f"^{data.name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="State already exists")
    
    state = BillboardState(**data.model_dump())
    doc = state.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.billboard_states.insert_one(doc)
    return state

@api_router.put("/led-billboard/states/{state_id}")
async def update_billboard_state(state_id: str, data: BillboardStateCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.billboard_states.update_one(
        {"id": state_id},
        {"$set": {"name": data.name, "roads": [r.model_dump() for r in data.roads]}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="State not found")
    
    # Update state_name in existing packages
    await db.led_billboard_packages.update_many(
        {"state_id": state_id},
        {"$set": {"state_name": data.name}}
    )
    
    return {"status": "success", "message": "State updated"}

@api_router.delete("/led-billboard/states/{state_id}")
async def delete_billboard_state(state_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.billboard_states.delete_one({"id": state_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="State not found")
    
    return {"status": "success", "message": "State deleted"}

@api_router.get("/led-billboard/sizes")
async def get_billboard_sizes():
    """Get all LED billboard sizes"""
    sizes = await db.billboard_sizes.find({}, {"_id": 0}).to_list(100)
    return sizes

@api_router.post("/led-billboard/sizes", response_model=BillboardSize)
async def create_billboard_size(data: BillboardSizeCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if size already exists
    existing = await db.billboard_sizes.find_one({"name": {"$regex": f"^{data.name}$", "$options": "i"}})
    if existing:
        raise HTTPException(status_code=400, detail="Size already exists")
    
    size = BillboardSize(**data.model_dump())
    doc = size.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.billboard_sizes.insert_one(doc)
    return size

@api_router.put("/led-billboard/sizes/{size_id}")
async def update_billboard_size(size_id: str, data: BillboardSizeCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.billboard_sizes.update_one(
        {"id": size_id},
        {"$set": {"name": data.name, "description": data.description}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Size not found")
    
    # Update size_name in existing packages
    await db.led_billboard_packages.update_many(
        {"size_id": size_id},
        {"$set": {"size_name": data.name}}
    )
    
    return {"status": "success", "message": "Size updated"}

@api_router.delete("/led-billboard/sizes/{size_id}")
async def delete_billboard_size(size_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.billboard_sizes.delete_one({"id": size_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Size not found")
    
    return {"status": "success", "message": "Size deleted"}

@api_router.get("/led-billboard/packages")
async def get_led_billboard_packages(
    state_id: Optional[str] = None,
    road_name: Optional[str] = None,
    size_id: Optional[str] = None
):
    """Get LED billboard packages with optional filters"""
    query = {"status": "active"}
    
    if state_id:
        query["state_id"] = state_id
    if road_name:
        query["road_name"] = {"$regex": road_name, "$options": "i"}
    if size_id:
        query["size_id"] = size_id
    
    packages = await db.led_billboard_packages.find(query, {"_id": 0}).to_list(100)
    return packages

@api_router.post("/led-billboard/packages", response_model=LEDBillboardPackage)
async def create_led_billboard_package(data: LEDBillboardPackageCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get state and size names for denormalization
    state = await db.billboard_states.find_one({"id": data.state_id}, {"_id": 0, "name": 1})
    size = await db.billboard_sizes.find_one({"id": data.size_id}, {"_id": 0, "name": 1})
    
    if not state:
        raise HTTPException(status_code=400, detail="Invalid state ID")
    if not size:
        raise HTTPException(status_code=400, detail="Invalid size ID")
    
    package = LEDBillboardPackage(
        state_name=state["name"],
        size_name=size["name"],
        **data.model_dump()
    )
    doc = package.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.led_billboard_packages.insert_one(doc)
    return package

@api_router.put("/led-billboard/packages/{package_id}")
async def update_led_billboard_package(package_id: str, data: LEDBillboardPackageCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get state and size names
    state = await db.billboard_states.find_one({"id": data.state_id}, {"_id": 0, "name": 1})
    size = await db.billboard_sizes.find_one({"id": data.size_id}, {"_id": 0, "name": 1})
    
    update_data = data.model_dump()
    update_data["state_name"] = state["name"] if state else None
    update_data["size_name"] = size["name"] if size else None
    
    result = await db.led_billboard_packages.update_one(
        {"id": package_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    
    return {"status": "success", "message": "Package updated"}

@api_router.delete("/led-billboard/packages/{package_id}")
async def delete_led_billboard_package(package_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.led_billboard_packages.delete_one({"id": package_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    
    return {"status": "success", "message": "Package deleted"}

# Static Banner & Lightbox Billboard Routes

@api_router.get("/billboard-types")
async def get_billboard_types(category: Optional[str] = None):
    """Get billboard types (for Static Banner and Lightbox)"""
    query = {}
    if category:
        query["billboard_category"] = category
    types = await db.billboard_types.find(query, {"_id": 0}).to_list(100)
    return types

@api_router.post("/billboard-types", response_model=BillboardType)
async def create_billboard_type(data: BillboardTypeCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if type already exists for this category
    existing = await db.billboard_types.find_one({
        "name": {"$regex": f"^{data.name}$", "$options": "i"},
        "billboard_category": data.billboard_category
    })
    if existing:
        raise HTTPException(status_code=400, detail="Type already exists for this category")
    
    billboard_type = BillboardType(**data.model_dump())
    doc = billboard_type.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.billboard_types.insert_one(doc)
    return billboard_type

@api_router.put("/billboard-types/{type_id}")
async def update_billboard_type(type_id: str, data: BillboardTypeCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.billboard_types.update_one(
        {"id": type_id},
        {"$set": {"name": data.name, "description": data.description, "billboard_category": data.billboard_category}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Type not found")
    
    # Update type_name in existing packages
    await db.static_billboard_packages.update_many(
        {"type_id": type_id},
        {"$set": {"type_name": data.name}}
    )
    
    return {"status": "success", "message": "Type updated"}

@api_router.delete("/billboard-types/{type_id}")
async def delete_billboard_type(type_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.billboard_types.delete_one({"id": type_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Type not found")
    
    return {"status": "success", "message": "Type deleted"}

@api_router.get("/static-billboard/packages")
async def get_static_billboard_packages(
    category: Optional[str] = None,
    state_id: Optional[str] = None,
    road_name: Optional[str] = None,
    type_id: Optional[str] = None
):
    """Get Static Banner or Lightbox billboard packages with optional filters"""
    query = {"status": "active"}
    
    if category:
        query["billboard_category"] = category
    if state_id:
        query["state_id"] = state_id
    if road_name:
        query["road_name"] = {"$regex": road_name, "$options": "i"}
    if type_id:
        query["type_id"] = type_id
    
    packages = await db.static_billboard_packages.find(query, {"_id": 0}).to_list(100)
    return packages

@api_router.post("/static-billboard/packages", response_model=StaticBillboardPackage)
async def create_static_billboard_package(data: StaticBillboardPackageCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get state and type names for denormalization
    state = await db.billboard_states.find_one({"id": data.state_id}, {"_id": 0, "name": 1})
    billboard_type = await db.billboard_types.find_one({"id": data.type_id}, {"_id": 0, "name": 1})
    
    if not state:
        raise HTTPException(status_code=400, detail="Invalid state ID")
    if not billboard_type:
        raise HTTPException(status_code=400, detail="Invalid type ID")
    
    package = StaticBillboardPackage(
        state_name=state["name"],
        type_name=billboard_type["name"],
        **data.model_dump()
    )
    doc = package.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.static_billboard_packages.insert_one(doc)
    return package

@api_router.put("/static-billboard/packages/{package_id}")
async def update_static_billboard_package(package_id: str, data: StaticBillboardPackageCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get state and type names
    state = await db.billboard_states.find_one({"id": data.state_id}, {"_id": 0, "name": 1})
    billboard_type = await db.billboard_types.find_one({"id": data.type_id}, {"_id": 0, "name": 1})
    
    update_data = data.model_dump()
    update_data["state_name"] = state["name"] if state else None
    update_data["type_name"] = billboard_type["name"] if billboard_type else None
    
    result = await db.static_billboard_packages.update_one(
        {"id": package_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    
    return {"status": "success", "message": "Package updated"}

@api_router.delete("/static-billboard/packages/{package_id}")
async def delete_static_billboard_package(package_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.static_billboard_packages.delete_one({"id": package_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    
    return {"status": "success", "message": "Package deleted"}

# Digital Ad Service Routes
@api_router.post("/digital-ads", response_model=DigitalAdService)
async def create_digital_ad_service(data: DigitalAdServiceCreate, current_user: User = Depends(get_current_user)):
    # Allow user, supplier, and admin to create digital ads
    if current_user.role not in ["user", "supplier", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    service = DigitalAdService(supplier_id=current_user.id, **data.model_dump())
    doc = service.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    
    await db.digital_ad_services.insert_one(doc)
    return service

@api_router.get("/digital-ads")
async def get_digital_ad_services(platform: Optional[str] = None):
    """Get all digital ad platforms (from admin-managed digital_ads collection)"""
    # Query the digital_ads collection (admin-managed)
    query = {}
    if platform:
        query["platform"] = {"$regex": platform, "$options": "i"}
    
    digital_ads = await db.digital_ads.find(query, {"_id": 0}).to_list(100)
    
    # If no admin-created entries exist, fall back to digital_ad_services for backwards compatibility
    if not digital_ads:
        services = await db.digital_ad_services.find({}, {"_id": 0}).to_list(100)
        return services
    
    return digital_ads

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
    # Allow user, supplier, and admin to create kannywood placements
    if current_user.role not in ["user", "supplier", "admin"]:
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
    
    # Handle platform-managed services (no listing lookup required)
    if listing_type in ["digital-ad", "led_billboard", "static_banner", "lightbox"]:
        # These are managed by Lightban platform, use a default supplier
        supplier_id = "lightban-platform"
    else:
        if listing_type not in collection_map:
            raise HTTPException(status_code=400, detail=f"Invalid listing type: {listing_type}")
        
        collection = db[collection_map.get(listing_type)]
        listing = await collection.find_one({"id": data.listing_id}, {"_id": 0})
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")
        supplier_id = listing['supplier_id']
    
    # Get platform fee percentage from settings
    settings = await get_site_settings()
    fee_percentage = settings.get('platform_fee_percentage', 10.0) / 100.0  # Convert to decimal
    
    # Use package_price if provided, otherwise try to get from package_details, 
    # otherwise reverse-calculate from total_amount
    base_price = data.package_price
    if not base_price:
        base_price = data.package_details.get('price')
    if not base_price:
        # Reverse calculate: if total = base + base*fee%, then base = total / (1 + fee%)
        base_price = data.total_amount / (1 + fee_percentage)
    
    platform_fee = base_price * fee_percentage
    supplier_payout = base_price  # Supplier gets the base package price
    
    # Determine payment method and initial status
    payment_method = data.payment_method or "online"
    payment_status = "pending_cash" if payment_method == "cash" else "pending"
    
    order = Order(
        advertiser_id=current_user.id,
        supplier_id=supplier_id,
        listing_type=data.listing_type,
        listing_id=data.listing_id,
        package_details=data.package_details,
        total_amount=data.total_amount,
        platform_fee=platform_fee,
        supplier_payout=supplier_payout,
        payment_method=payment_method,
        payment_status=payment_status
    )
    
    doc = order.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    
    await db.orders.insert_one(doc)
    
    # Send email for pay-at-office orders
    if payment_method == "cash":
        try:
            settings = await get_site_settings()
            user_data = {"name": current_user.name, "email": current_user.email}
            order_data = doc.copy()
            
            email_html = generate_order_confirmation_email(order_data, user_data, settings)
            # Send email in background (don't wait)
            asyncio.create_task(send_email_async(
                current_user.email,
                "Order Confirmed - Pay at Office | Lightban Ads Network",
                email_html
            ))
            logger.info(f"Order confirmation email queued for {current_user.email}")
        except Exception as e:
            logger.error(f"Failed to queue order email: {str(e)}")
    
    return order

@api_router.get("/orders", response_model=List[Order])
async def get_orders(current_user: User = Depends(get_current_user)):
    query = {}
    # "user" role gets full access to their own orders (can act as both advertiser and supplier)
    if current_user.role in ["user", "advertiser"]:
        query["advertiser_id"] = current_user.id
    elif current_user.role == "supplier":
        query["supplier_id"] = current_user.id
    # admin sees all orders (no query filter)
    
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
    payment_method: Optional[str] = None

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
    if data.payment_method:
        update_data['payment_method'] = data.payment_method
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    
    # Send email notification for cash/pay-at-office orders
    if data.payment_method == 'cash' or data.payment_status == 'pending_cash':
        try:
            updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
            settings = await get_site_settings()
            user_data = {"name": current_user.name, "email": current_user.email}
            
            email_html = generate_order_confirmation_email(updated_order, user_data, settings)
            asyncio.create_task(send_email_async(
                current_user.email,
                "Order Confirmed - Pay at Office | Lightban Ads Network",
                email_html
            ))
            logger.info(f"Pay-at-office order email queued for {current_user.email}")
        except Exception as e:
            logger.error(f"Failed to queue order email: {str(e)}")
    
    return {"status": "success", "message": "Order status updated", "order_id": order_id}

# Paystack Payment Models
class PaymentInitialize(BaseModel):
    order_id: str  # Can be single order ID or comma-separated list of order IDs
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
        # Handle order payment - supports multiple orders (comma-separated IDs)
        order_ids = [oid.strip() for oid in data.order_id.split(',')]
        
        # Fetch all orders
        orders = []
        total_amount = 0
        for oid in order_ids:
            order = await db.orders.find_one({"id": oid}, {"_id": 0})
            if not order:
                raise HTTPException(status_code=404, detail=f"Order not found: {oid}")
            if order['advertiser_id'] != current_user.id:
                raise HTTPException(status_code=403, detail=f"Not authorized to pay for order: {oid}")
            orders.append(order)
            total_amount += order['total_amount']
        
        # Convert to kobo (smallest unit)
        amount_kobo = int(total_amount * 100)
        # Use first order ID for reference but store all IDs in metadata
        reference = f"lightban_{order_ids[0]}_{uuid.uuid4().hex[:8]}"
        
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
                            "order_id": data.order_id,  # Store all order IDs (comma-separated)
                            "order_ids": order_ids,  # Also store as array for easier processing
                            "order_count": len(order_ids),
                            "user_id": current_user.id,
                            "custom_fields": [
                                {
                                    "display_name": "Order IDs",
                                    "variable_name": "order_ids",
                                    "value": data.order_id
                                },
                                {
                                    "display_name": "Total Items",
                                    "variable_name": "order_count",
                                    "value": str(len(order_ids))
                                }
                            ]
                        }
                    }
                )
                result = response.json()
            
            if result.get("status"):
                # Store payment reference in ALL orders
                for oid in order_ids:
                    await db.orders.update_one(
                        {"id": oid},
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
            metadata = result["data"].get("metadata", {})
            payment_type = metadata.get("type")
            
            # Handle consultation payment
            if payment_type == "consultation":
                consultation_id = metadata.get("consultation_id")
                if consultation_id:
                    await db.consultations.update_one(
                        {"id": consultation_id},
                        {"$set": {
                            "payment_status": "paid",
                            "payment_reference": reference,
                            "payment_verified_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }}
                    )
                    logger.info(f"Consultation payment verified for {consultation_id}")
                    
                    return {
                        "status": "success",
                        "message": "Payment verified successfully",
                        "consultation_id": consultation_id,
                        "amount": result["data"]["amount"] / 100
                    }
            
            # Handle regular order payment - supports multiple orders
            order_id = metadata.get("order_id")
            order_ids = metadata.get("order_ids", [])
            
            # If we have order_ids array, use it; otherwise parse comma-separated string
            if not order_ids and order_id:
                order_ids = [oid.strip() for oid in order_id.split(',')]
            
            # Update all orders
            for oid in order_ids:
                await db.orders.update_one(
                    {"id": oid},
                    {"$set": {
                        "payment_status": "paid",
                        "payment_method": "online",
                        "payment_reference": reference,
                        "payment_verified_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logger.info(f"Order payment verified for {oid}")
            
            return {
                "status": "success",
                "message": "Payment verified successfully",
                "order_id": order_id,
                "order_ids": order_ids,
                "order_count": len(order_ids),
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
        metadata = event["data"].get("metadata", {})
        payment_type = metadata.get("type")
        
        # Handle consultation payment
        if payment_type == "consultation":
            consultation_id = metadata.get("consultation_id")
            if consultation_id:
                await db.consultations.update_one(
                    {"id": consultation_id},
                    {"$set": {
                        "payment_status": "paid",
                        "payment_reference": reference,
                        "payment_verified_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logger.info(f"Webhook: Payment successful for consultation {consultation_id}")
        else:
            # Handle regular order payment - supports multiple orders
            order_id = metadata.get("order_id")
            order_ids = metadata.get("order_ids", [])
            
            # If we have order_ids array, use it; otherwise parse comma-separated string
            if not order_ids and order_id:
                order_ids = [oid.strip() for oid in order_id.split(',')]
            
            # Update all orders
            for oid in order_ids:
                await db.orders.update_one(
                    {"id": oid},
                    {"$set": {
                        "payment_status": "paid",
                        "payment_method": "online",
                        "payment_reference": reference,
                        "payment_verified_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                logger.info(f"Webhook: Payment successful for order {oid}")
    
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
    # Allow user and advertiser roles to leave reviews
    if current_user.role not in ["user", "advertiser"]:
        raise HTTPException(status_code=403, detail="Only users can leave reviews")
    
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
    reviews = await db.reviews.find({"listing_id": data.listing_id}, {"_id": 0, "rating": 1}).to_list(1000)
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

# Get all conversations for user (messaging center)
@api_router.get("/conversations")
async def get_conversations(current_user: User = Depends(get_current_user)):
    """Get all orders with their latest message for the messaging center"""
    # Get all orders for this user
    if current_user.role == "admin":
        orders = await db.orders.find({}, {"_id": 0}).to_list(1000)
        consultations = await db.consultations.find({}, {"_id": 0}).to_list(1000)
    else:
        orders = await db.orders.find({"advertiser_id": current_user.id}, {"_id": 0}).to_list(1000)
        consultations = await db.consultations.find({"user_id": current_user.id}, {"_id": 0}).to_list(1000)
    
    conversations = []
    
    # Batch fetch all messages for orders and consultations to avoid N+1 queries
    all_item_ids = [o.get("id") for o in orders] + [c.get("id") for c in consultations]
    
    if all_item_ids:
        # Fetch latest message per order/consultation using aggregation
        pipeline = [
            {"$match": {"order_id": {"$in": all_item_ids}}},
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": "$order_id",
                "last_message": {"$first": "$message"},
                "last_message_time": {"$first": "$created_at"},
                "last_sender_id": {"$first": "$sender_id"}
            }}
        ]
        messages_agg = await db.messages.aggregate(pipeline).to_list(1000)
        messages_map = {m["_id"]: m for m in messages_agg}
        
        # Batch count unread messages
        unread_pipeline = [
            {"$match": {
                "order_id": {"$in": all_item_ids},
                "sender_id": {"$ne": current_user.id},
                "read": {"$ne": True}
            }},
            {"$group": {"_id": "$order_id", "count": {"$sum": 1}}}
        ]
        unread_agg = await db.messages.aggregate(unread_pipeline).to_list(1000)
        unread_map = {u["_id"]: u["count"] for u in unread_agg}
    else:
        messages_map = {}
        unread_map = {}
    
    # Process orders
    for order in orders:
        order_id = order.get("id")
        msg_data = messages_map.get(order_id, {})
        
        conversations.append({
            "id": order_id,
            "type": "order",
            "title": order.get("package_details", {}).get("title", "Order"),
            "subtitle": f"Order #{order_id[:8]}",
            "status": order.get("order_status", "pending"),
            "last_message": msg_data.get("last_message"),
            "last_message_time": msg_data.get("last_message_time") or order.get("created_at"),
            "unread_count": unread_map.get(order_id, 0),
            "created_at": order.get("created_at")
        })
    
    # Process consultations
    for consultation in consultations:
        cons_id = consultation.get("id")
        msg_data = messages_map.get(cons_id, {})
        
        conversations.append({
            "id": cons_id,
            "type": "consultation",
            "title": f"{consultation.get('consultation_type', 'Consultation')} Consultation",
            "subtitle": consultation.get("business_name", "Consultation"),
            "status": consultation.get("status", "pending"),
            "last_message": msg_data.get("last_message"),
            "last_message_time": msg_data.get("last_message_time") or consultation.get("created_at"),
            "unread_count": unread_map.get(cons_id, 0),
            "created_at": consultation.get("created_at")
        })
    
    # Sort by last message time (most recent first)
    conversations.sort(key=lambda x: x.get("last_message_time") or x.get("created_at") or "", reverse=True)
    
    return conversations

# Mark messages as read
@api_router.put("/messages/{order_id}/read")
async def mark_messages_read(order_id: str, current_user: User = Depends(get_current_user)):
    """Mark all messages in a conversation as read"""
    await db.messages.update_many(
        {"order_id": order_id, "sender_id": {"$ne": current_user.id}},
        {"$set": {"read": True}}
    )
    return {"status": "success"}

# Get order tracking details
@api_router.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str, current_user: User = Depends(get_current_user)):
    """Get detailed order tracking information with timeline"""
    # Try to find as order first
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    
    if order:
        # Verify ownership unless admin
        if current_user.role != "admin" and order.get("advertiser_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this order")
        
        # Get package/listing details
        listing_type = order.get("listing_type", "")
        listing_id = order.get("listing_id", "")
        listing_info = {}
        
        # Fetch listing info based on type
        if listing_type == "influencer":
            listing = await db.influencers.find_one({"id": listing_id}, {"_id": 0})
            if listing:
                listing_info = {
                    "name": listing.get("name"),
                    "image_url": listing.get("profile_image_url") or listing.get("image_url"),
                    "platform": listing.get("platform"),
                    "handle": listing.get("handle")
                }
        elif listing_type in ["billboard", "led_billboard", "static_banner", "lightbox"]:
            listing_info = {
                "name": order.get("package_details", {}).get("title", "Billboard"),
                "image_url": order.get("package_details", {}).get("image_url"),
                "location": order.get("package_details", {}).get("location")
            }
        elif listing_type == "digital_ad":
            listing = await db.digital_ad_services.find_one({"id": listing_id}, {"_id": 0})
            if listing:
                listing_info = {
                    "name": listing.get("platform") or listing.get("name"),
                    "image_url": listing.get("image_url")
                }
        elif listing_type == "kannywood":
            listing = await db.kannywood_placements.find_one({"id": listing_id}, {"_id": 0})
            if listing:
                listing_info = {
                    "name": listing.get("title"),
                    "image_url": listing.get("image_url"),
                    "director": listing.get("director")
                }
        
        # Build timeline based on order status
        timeline = []
        status = order.get("order_status", "pending")
        payment_status = order.get("payment_status", "pending")
        created_at = order.get("created_at")
        updated_at = order.get("updated_at")
        
        # Order placed
        timeline.append({
            "status": "placed",
            "title": "Order Placed",
            "description": "Your order has been submitted",
            "date": created_at,
            "completed": True
        })
        
        # Payment status
        if payment_status == "paid":
            timeline.append({
                "status": "paid",
                "title": "Payment Confirmed",
                "description": "Payment received successfully",
                "date": updated_at,
                "completed": True
            })
        else:
            timeline.append({
                "status": "payment_pending",
                "title": "Awaiting Payment",
                "description": "Complete payment to proceed",
                "date": None,
                "completed": False
            })
        
        # Status-based timeline items
        status_order = ["pending", "accepted", "in_progress", "proof_submitted", "completed"]
        current_idx = status_order.index(status) if status in status_order else 0
        
        if status not in ["cancelled", "disputed"]:
            timeline.append({
                "status": "accepted",
                "title": "Order Accepted",
                "description": "Supplier has accepted your order",
                "date": updated_at if current_idx >= 1 else None,
                "completed": current_idx >= 1
            })
            
            timeline.append({
                "status": "in_progress",
                "title": "In Progress",
                "description": "Work is being done on your order",
                "date": updated_at if current_idx >= 2 else None,
                "completed": current_idx >= 2
            })
            
            timeline.append({
                "status": "proof_submitted",
                "title": "Proof Submitted",
                "description": "Supplier has submitted proof of work",
                "date": updated_at if current_idx >= 3 else None,
                "completed": current_idx >= 3
            })
            
            timeline.append({
                "status": "completed",
                "title": "Completed",
                "description": "Order has been completed successfully",
                "date": updated_at if current_idx >= 4 else None,
                "completed": current_idx >= 4
            })
        elif status == "cancelled":
            timeline.append({
                "status": "cancelled",
                "title": "Order Cancelled",
                "description": "This order has been cancelled",
                "date": updated_at,
                "completed": True,
                "is_cancelled": True
            })
        elif status == "disputed":
            timeline.append({
                "status": "disputed",
                "title": "Under Dispute",
                "description": "This order is under review",
                "date": updated_at,
                "completed": True,
                "is_disputed": True
            })
        
        # Get customer info for admin
        customer_info = None
        if current_user.role == "admin":
            advertiser_id = order.get("advertiser_id")
            if advertiser_id:
                customer = await db.users.find_one({"id": advertiser_id}, {"_id": 0, "password": 0})
                if customer:
                    customer_info = {
                        "id": customer.get("id"),
                        "name": customer.get("name"),
                        "email": customer.get("email"),
                        "phone": customer.get("phone"),
                        "company_name": customer.get("company_name"),
                        "created_at": customer.get("created_at")
                    }
        
        return {
            "order": order,
            "listing_info": listing_info,
            "timeline": timeline,
            "type": "order",
            "customer_info": customer_info
        }
    
    # Try as consultation
    consultation = await db.consultations.find_one({"id": order_id}, {"_id": 0})
    if consultation:
        if current_user.role != "admin" and consultation.get("user_id") != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this consultation")
        
        status = consultation.get("status", "pending")
        created_at = consultation.get("created_at")
        scheduled_date = consultation.get("scheduled_date")
        
        timeline = [
            {
                "status": "submitted",
                "title": "Consultation Requested",
                "description": "Your consultation request was submitted",
                "date": created_at,
                "completed": True
            },
            {
                "status": "scheduled",
                "title": "Scheduled",
                "description": f"Consultation scheduled for {scheduled_date}" if scheduled_date else "Awaiting scheduling",
                "date": scheduled_date,
                "completed": status in ["scheduled", "completed"]
            },
            {
                "status": "completed",
                "title": "Completed",
                "description": "Consultation completed",
                "date": None,
                "completed": status == "completed"
            }
        ]
        
        # Get customer info for admin
        customer_info = None
        if current_user.role == "admin":
            user_id = consultation.get("user_id")
            if user_id:
                customer = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
                if customer:
                    customer_info = {
                        "id": customer.get("id"),
                        "name": customer.get("name"),
                        "email": customer.get("email"),
                        "phone": customer.get("phone"),
                        "company_name": customer.get("company_name"),
                        "created_at": customer.get("created_at")
                    }
        
        return {
            "order": consultation,
            "listing_info": {
                "name": f"{consultation.get('consultation_type', 'Consultation')} Consultation",
                "business_name": consultation.get("business_name")
            },
            "timeline": timeline,
            "type": "consultation",
            "customer_info": customer_info
        }
    
    raise HTTPException(status_code=404, detail="Order not found")

# Dashboard Stats
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    # 'user' role gets same treatment as 'advertiser' (full access to both)
    if current_user.role in ["user", "advertiser"]:
        # Get all orders for this user with only needed fields
        all_orders = await db.orders.find(
            {"advertiser_id": current_user.id}, 
            {"_id": 0, "order_status": 1, "payment_status": 1, "total_amount": 1}
        ).to_list(1000)
        
        # Get all consultations for this user with only needed fields
        all_consultations = await db.consultations.find(
            {"user_id": current_user.id}, 
            {"_id": 0, "status": 1, "payment_status": 1, "price": 1}
        ).to_list(1000)
        
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
    
    # Get regular orders
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Batch fetch all users for orders
    advertiser_ids = list(set(o.get("advertiser_id") for o in orders if o.get("advertiser_id")))
    users_list = await db.users.find({"id": {"$in": advertiser_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1}).to_list(1000)
    users_map = {u["id"]: u for u in users_list}
    
    # Batch fetch listing info by type
    influencer_ids = list(set(o.get("listing_id") for o in orders if o.get("listing_type") == "influencer" and o.get("listing_id")))
    billboard_ids = list(set(o.get("listing_id") for o in orders if o.get("listing_type") == "billboard" and o.get("listing_id")))
    kannywood_ids = list(set(o.get("listing_id") for o in orders if o.get("listing_type") == "kannywood" and o.get("listing_id")))
    digital_ad_ids = list(set(o.get("listing_id") for o in orders if o.get("listing_type") == "digital_ad" and o.get("listing_id")))
    
    influencers_list = await db.influencers.find({"id": {"$in": influencer_ids}}, {"_id": 0, "id": 1, "name": 1, "handle": 1, "image_url": 1, "platform": 1}).to_list(500) if influencer_ids else []
    billboards_list = await db.billboards.find({"id": {"$in": billboard_ids}}, {"_id": 0, "id": 1, "name": 1, "type": 1, "image_url": 1, "location": 1}).to_list(500) if billboard_ids else []
    kannywood_list = await db.kannywood.find({"id": {"$in": kannywood_ids}}, {"_id": 0, "id": 1, "title": 1, "production_company": 1, "image_url": 1}).to_list(500) if kannywood_ids else []
    digital_ads_list = await db.digital_ads.find({"id": {"$in": digital_ad_ids}}, {"_id": 0, "id": 1, "name": 1, "platform": 1, "image_url": 1}).to_list(500) if digital_ad_ids else []
    
    influencers_map = {i["id"]: i for i in influencers_list}
    billboards_map = {b["id"]: b for b in billboards_list}
    kannywood_map = {k["id"]: k for k in kannywood_list}
    digital_ads_map = {d["id"]: d for d in digital_ads_list}
    
    # Add user info and type to each order, enriched with seller info
    for order in orders:
        order["user_info"] = users_map.get(order.get("advertiser_id"), {})
        order["order_type"] = "service"  # Regular service order
        
        # Ensure package details has title
        if not order.get("package_details"):
            order["package_details"] = {}
        if not order["package_details"].get("title") and not order["package_details"].get("packageTitle"):
            order["package_details"]["title"] = order.get("listing_type", "Service").replace("_", " ").title()
        
        # Enrich with seller/listing information based on listing_type
        listing_type = order.get("listing_type", "")
        listing_id = order.get("listing_id", "")
        
        if listing_type == "influencer" and listing_id:
            influencer = influencers_map.get(listing_id)
            if influencer:
                order["package_details"]["seller_name"] = influencer.get("name", "")
                order["package_details"]["handle"] = influencer.get("handle", "")
                order["package_details"]["image_url"] = influencer.get("image_url", "")
                order["package_details"]["platform"] = influencer.get("platform", "")
        
        elif listing_type == "billboard" and listing_id:
            billboard = billboards_map.get(listing_id)
            if billboard:
                order["package_details"]["seller_name"] = billboard.get("name", "")
                order["package_details"]["billboard_type"] = billboard.get("type", "")
                order["package_details"]["image_url"] = billboard.get("image_url", "")
                order["package_details"]["location"] = billboard.get("location", "")
        
        elif listing_type == "kannywood" and listing_id:
            kannywood = kannywood_map.get(listing_id)
            if kannywood:
                order["package_details"]["seller_name"] = kannywood.get("title", "")
                order["package_details"]["production_company"] = kannywood.get("production_company", "")
                order["package_details"]["image_url"] = kannywood.get("image_url", "")
        
        elif listing_type == "digital_ad" and listing_id:
            digital_ad = digital_ads_map.get(listing_id)
            if digital_ad:
                order["package_details"]["seller_name"] = digital_ad.get("name", "")
                order["package_details"]["platform"] = digital_ad.get("platform", "")
                order["package_details"]["image_url"] = digital_ad.get("image_url", "")
    
    # Get consultations as orders
    consultations = await db.consultations.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    
    # Batch fetch users for consultations
    consultation_user_ids = list(set(c.get("user_id") for c in consultations if c.get("user_id")))
    consultation_users_list = await db.users.find({"id": {"$in": consultation_user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1}).to_list(1000) if consultation_user_ids else []
    consultation_users_map = {u["id"]: u for u in consultation_users_list}
    
    # Transform consultations to order format
    for consultation in consultations:
        user = consultation_users_map.get(consultation.get("user_id"))
        
        # Create order-like structure for consultation with ALL form fields
        consultation_order = {
            "id": consultation.get("id"),
            "order_type": "consultation",
            "listing_type": "consultation",
            "listing_id": consultation.get("id"),
            "advertiser_id": consultation.get("user_id"),
            "user_info": user or {"name": consultation.get("contact_name"), "email": consultation.get("contact_email"), "phone": consultation.get("contact_phone")},
            "package_details": {
                "title": consultation.get("package_title", "Consultation"),
                "packageTitle": consultation.get("package_title", "Consultation"),
                "consultation_type": consultation.get("consultation_type", "online"),
                "business_name": consultation.get("business_name"),
                "industry": consultation.get("industry"),
                # Include ALL consultation form fields
                "business_stage": consultation.get("business_stage"),
                "description": consultation.get("description"),
                "goals": consultation.get("goals"),
                "budget_range": consultation.get("budget_range"),
                "contact_name": consultation.get("contact_name"),
                "contact_email": consultation.get("contact_email"),
                "contact_phone": consultation.get("contact_phone"),
            },
            "total_amount": consultation.get("price", 0),
            "supplier_payout": consultation.get("price", 0),  # For consultations, no platform fee
            "platform_fee": 0,
            "order_status": consultation.get("status", "pending"),
            "payment_status": consultation.get("payment_status", "pending"),
            "payment_method": consultation.get("payment_method", "online"),
            "scheduled_date": consultation.get("scheduled_date"),
            "scheduled_time": consultation.get("scheduled_time"),
            "preferred_date": consultation.get("preferred_date"),
            "preferred_time": consultation.get("preferred_time"),
            "created_at": consultation.get("created_at"),
            "updated_at": consultation.get("updated_at")
        }
        orders.append(consultation_order)
    
    # Sort combined list by created_at (most recent first)
    orders.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    
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
    
    # Batch fetch user info for all consultations
    user_ids = list(set(c.get("user_id") for c in consultations if c.get("user_id")))
    users_list = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1}).to_list(1000) if user_ids else []
    users_map = {u["id"]: u for u in users_list}
    
    # Get user info for each consultation
    for consultation in consultations:
        consultation["user_info"] = users_map.get(consultation.get("user_id"), {})
    
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
    
    # Check if schedule is being set (send email notification)
    should_send_email = (
        consultation_update.scheduled_date and 
        consultation_update.scheduled_time and
        (existing.get('scheduled_date') != consultation_update.scheduled_date or
         existing.get('scheduled_time') != consultation_update.scheduled_time)
    )
    
    await db.consultations.update_one({"id": consultation_id}, {"$set": update_data})
    
    updated = await db.consultations.find_one({"id": consultation_id}, {"_id": 0})
    
    # Send scheduling confirmation email
    if should_send_email:
        try:
            # Get user info
            user = await db.users.find_one({"id": existing.get('user_id')}, {"_id": 0})
            if user and user.get('email'):
                settings = await get_site_settings()
                user_data = {"name": user.get('name', 'Valued Customer'), "email": user.get('email')}
                
                email_html = generate_consultation_scheduled_email(updated, user_data, settings)
                # Send email in background
                asyncio.create_task(send_email_async(
                    user['email'],
                    "Consultation Scheduled | Lightban Ads Network",
                    email_html
                ))
                logger.info(f"Consultation scheduling email queued for {user['email']}")
        except Exception as e:
            logger.error(f"Failed to queue consultation email: {str(e)}")
    
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
    
    # Revenue calculation (include paid consultations)
    paid_orders = await db.orders.find({"payment_status": "paid"}, {"total_amount": 1}).to_list(10000)
    paid_consultations = await db.consultations.find({"payment_status": "paid"}, {"price": 1}).to_list(10000)
    order_revenue = sum(o.get("total_amount", 0) for o in paid_orders)
    consultation_revenue = sum(c.get("price", 0) for c in paid_consultations)
    total_revenue = order_revenue + consultation_revenue
    
    # Consultation stats
    pending_consultations = await db.consultations.count_documents({"status": "pending"})
    scheduled_consultations = await db.consultations.count_documents({"status": "scheduled"})
    completed_consultations = await db.consultations.count_documents({"status": "completed"})
    
    # Combined totals (orders + consultations)
    combined_total = total_orders + total_consultations
    combined_pending = pending_orders + pending_consultations + scheduled_consultations
    combined_completed = completed_orders + completed_consultations
    
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
            "total": combined_total,  # Include consultations in total orders
            "service_orders": total_orders,
            "consultations": total_consultations,
            "pending": combined_pending,
            "completed": combined_completed,
            "cancelled": cancelled_orders,
            "revenue": total_revenue
        },
        "consultations": {
            "total": total_consultations,
            "pending": pending_consultations,
            "completed": completed_consultations
        }
    }

# ========== FILE UPLOAD ENDPOINTS ==========

ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

class UploadChunkRequest(BaseModel):
    filename: str
    chunk: str  # Base64 encoded chunk
    chunk_index: int
    total_chunks: int
    file_id: Optional[str] = None

@api_router.post("/upload/chunk")
async def upload_chunk(
    data: UploadChunkRequest,
    current_user: User = Depends(get_current_user)
):
    """Handle chunked file uploads to bypass proxy limits"""
    await check_admin(current_user)
    
    # Validate file extension
    ext = Path(data.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Generate or use existing file ID
    file_id = data.file_id or str(uuid.uuid4())
    temp_dir = UPLOAD_DIR / "temp" / file_id
    temp_dir.mkdir(parents=True, exist_ok=True)
    
    # Save chunk
    chunk_data = base64.b64decode(data.chunk)
    chunk_path = temp_dir / f"chunk_{data.chunk_index}"
    with open(chunk_path, 'wb') as f:
        f.write(chunk_data)
    
    # If this is the last chunk, combine all chunks
    if data.chunk_index == data.total_chunks - 1:
        # Generate final filename
        final_filename = f"{file_id}{ext}"
        final_path = UPLOAD_DIR / final_filename
        
        # Combine chunks
        with open(final_path, 'wb') as final_file:
            for i in range(data.total_chunks):
                chunk_file = temp_dir / f"chunk_{i}"
                if chunk_file.exists():
                    with open(chunk_file, 'rb') as cf:
                        final_file.write(cf.read())
        
        # Clean up temp directory
        shutil.rmtree(temp_dir)
        
        # Check file size
        if final_path.stat().st_size > MAX_FILE_SIZE:
            final_path.unlink()
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
        
        # Return the URL to the uploaded file
        return {
            "status": "complete",
            "file_id": file_id,
            "filename": final_filename,
            "url": f"/api/uploads/{final_filename}"
        }
    
    return {
        "status": "chunk_received",
        "file_id": file_id,
        "chunk_index": data.chunk_index
    }

@api_router.post("/upload/simple")
async def simple_upload(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Simple file upload for smaller files"""
    await check_admin(current_user)
    
    # Validate file extension
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
    
    # Read file content
    content = await file.read()
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")
    
    # Generate filename and save
    file_id = str(uuid.uuid4())
    final_filename = f"{file_id}{ext}"
    final_path = UPLOAD_DIR / final_filename
    
    with open(final_path, 'wb') as f:
        f.write(content)
    
    return {
        "status": "complete",
        "file_id": file_id,
        "filename": final_filename,
        "url": f"/api/uploads/{final_filename}"
    }

@api_router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    """Serve uploaded files"""
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Security: Ensure the path is within UPLOAD_DIR
    try:
        file_path.resolve().relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return FileResponse(file_path)

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
