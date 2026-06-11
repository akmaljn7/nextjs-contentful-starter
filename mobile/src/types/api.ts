// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  company?: string;
  role: 'user' | 'supplier' | 'admin' | 'advertiser';
  language_preference?: string;
  verified?: boolean;
  avatar_url?: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: 'user' | 'supplier' | 'advertiser';
  language_preference?: 'en' | 'ha';
}

// Influencer Types
export interface Influencer {
  id: string;
  supplier_id: string;
  name: string;
  handle: string;
  platform: string;
  followers: number;
  niche: string;
  bio: string;
  location: string;
  price_per_post: number;
  engagement_rate?: number;
  audience_demographics?: string;
  image_url?: string;
  profile_image_url?: string;
  profile_link?: string;
  verified: boolean;
  rating: number;
  total_reviews: number;
  response_time?: string;
  completion_rate?: number;
  status: string;
  packages?: Package[];
  is_busy?: boolean;
  created_at: string;
}

// Billboard Types
export interface Billboard {
  id: string;
  supplier_id?: string;
  location_name: string;
  name?: string;
  city?: string;
  state?: string;
  dimensions?: string;
  billboard_type: string;
  type?: string;
  traffic_daily: number;
  traffic?: string;
  price_monthly: number;
  price?: number;
  description: string;
  latitude?: number;
  longitude?: number;
  image_url?: string;
  verified: boolean;
  availability?: boolean;
  status?: string;
  pricing_by_state?: Record<string, any>;
  created_at?: string;
}

export interface BillboardState {
  id: string;
  name: string;
  roads: BillboardRoad[];
  created_at?: string;
}

export interface BillboardRoad {
  name: string;
  description?: string;
}

export interface BillboardSize {
  id: string;
  name: string;
  description?: string;
  created_at?: string;
}

export interface BillboardType {
  id: string;
  name: string;
  description?: string;
  billboard_category?: string | null;
  is_independent: boolean;
  image_url?: string;
  traffic_daily?: number;
  price_starting?: number;
  created_at?: string;
}

export interface BillboardPackage {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  deliverables: string[];
  state_id: string;
  state_name?: string;
  road_name: string;
  size_id?: string;
  size_name?: string;
  type_id?: string;
  type_name?: string;
  billboard_type_id?: string;
  billboard_type_name?: string;
  billboard_category?: string | null;
  image_url?: string;
  status?: string;
  created_at?: string;
}

// Digital Ad Types
export interface DigitalAd {
  id: string;
  supplier_id?: string;
  platform?: string;
  name: string;
  service_name?: string;
  description: string;
  image_url?: string;
  status?: string;
  packages?: Package[];
  rating?: number;
  total_reviews?: number;
  created_at?: string;
}

// Kannywood Types
export interface KannywoodProduction {
  id: string;
  supplier_id?: string;
  title: string;
  production_name?: string;
  placement_type?: string;
  genre?: string;
  description: string;
  director?: string;
  production_company?: string;
  cast?: string[];
  estimated_reach?: number;
  est_reach?: string;
  price: number;
  release_date?: string;
  image_url?: string;
  verified?: boolean;
  status?: string;
  packages?: Package[];
  is_fully_booked?: boolean;
  created_at?: string;
}

// Package Types
export interface Package {
  id: string;
  title: string;
  description: string;
  price: number;
  duration?: string;
  deliverables: string[];
  turnaround?: string;
}

// Cart Types
export interface CartItem {
  id: string;
  listingType: 'influencer' | 'billboard' | 'led_billboard' | 'static_banner' | 'lightbox' | 'independent_billboard' | 'digital_ad' | 'kannywood';
  listingId: string;
  listingName: string;
  packageId: string;
  packageTitle: string;
  price: number;
  duration?: string;
  deliverables: string[];
  image_url?: string;
  // Billboard specific
  location?: string;
  state_name?: string;
  road_name?: string;
  size_name?: string;
  type_name?: string;
}

// Order Create Data (matches backend OrderCreate model)
export interface OrderCreateData {
  listing_type: string;
  listing_id: string;
  package_details: {
    packageId: string;
    packageTitle: string;
    deliverables: string[];
    turnaround?: string;
    price: number;
    location?: string;
    state_name?: string;
    road_name?: string;
    [key: string]: any;
  };
  total_amount: number;
  package_price?: number;
  payment_method?: 'online' | 'cash';
}

// Order Types (matches backend Order model)
export interface Order {
  id: string;
  advertiser_id: string;
  supplier_id: string;
  listing_type: string;
  listing_id: string;
  package_details: {
    packageId?: string;
    packageTitle?: string;
    title?: string;
    deliverables?: string[];
    turnaround?: string;
    price?: number;
    location?: string;
    state_name?: string;
    road_name?: string;
    [key: string]: any;
  };
  total_amount: number;
  platform_fee: number;
  supplier_payout: number;
  payment_status: PaymentStatus;
  payment_method: 'online' | 'cash';
  order_status: OrderStatus;
  brief_url?: string;
  proof_url?: string;
  payment_reference?: string;
  ad_media?: Array<{
    type: 'image' | 'video' | 'link';
    url: string;
    filename?: string;
    title?: string;
    uploaded_at?: string;
  }>;
  completion_proof?: Array<{
    type: 'image' | 'video';
    url: string;
  }>;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'pending' | 'accepted' | 'in_progress' | 'proof_submitted' | 'completed' | 'disputed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'pending_cash' | 'held' | 'released' | 'refunded';

// Consultation Types
export interface Consultation {
  id: string;
  user_id: string;
  consultation_type: 'online' | 'physical';
  package_title?: string;
  price: number;
  business_name: string;
  industry: string;
  business_stage?: string;
  description: string;
  goals?: string;
  budget_range?: string;
  preferred_date?: string;
  preferred_time?: string;
  contact_name: string;
  contact_email?: string;
  contact_phone: string;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  payment_status: PaymentStatus;
  payment_method?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  created_at: string;
  updated_at?: string;
}

// Message Types (matches backend Message model)
export interface Message {
  id: string;
  order_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  media?: Array<{
    type: 'image' | 'video';
    url: string;
    filename?: string;
  }>;
  read?: boolean;
  created_at: string;
}

// Conversation Types (from /api/conversations endpoint)
export interface Conversation {
  id: string;
  type: 'order' | 'consultation' | 'support';
  title: string;
  subtitle: string;
  status: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  created_at: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Search Types (matches backend search response)
export interface SearchResult {
  id: string;
  type: 'influencer' | 'billboard' | 'led_billboard' | 'static_banner' | 'lightbox' | 'digital_ad' | 'kannywood';
  category: string;
  title: string;
  subtitle: string;
  description: string;
  location: string;
  price: number;
  price_label: string;
  image_url?: string;
  url: string;
  stats?: {
    followers?: number;
    engagement?: number;
    traffic?: number;
    size?: string;
    type?: string;
    genre?: string;
    reach?: number;
    packages?: number;
  };
}

// Stats Types (matches backend dashboard/stats response)
export interface UserStats {
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_spent: number;
  active_orders?: number;
  orders_count?: number;
  consultations_count?: number;
}

export interface AdminStats {
  total_users: number;
  total_orders: number;
  total_consultations: number;
  total_revenue: number;
  pending_orders: number;
  pending_consultations: number;
  completed_orders: number;
  cancelled_orders: number;
  orders_count: number;
  consultations_count: number;
}
