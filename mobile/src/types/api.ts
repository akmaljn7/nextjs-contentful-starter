// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  company?: string;
  role: 'user' | 'supplier' | 'admin';
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
  company?: string;
  role?: 'user' | 'supplier';
}

// Influencer Types
export interface Influencer {
  id: string;
  name: string;
  handle: string;
  platform: string;
  followers: number;
  category: string;
  description: string;
  image_url?: string;
  verified: boolean;
  engagement_rate?: number;
  location?: string;
  packages?: Package[];
  rating?: number;
  reviews_count?: number;
}

// Billboard Types
export interface Billboard {
  id: string;
  location_name: string;
  billboard_type: string;
  description: string;
  traffic_daily: number;
  price_monthly: number;
  image_url?: string;
  verified: boolean;
  state?: string;
  city?: string;
}

export interface BillboardState {
  id: string;
  name: string;
  code: string;
  roads: BillboardRoad[];
}

export interface BillboardRoad {
  name: string;
  traffic: number;
}

export interface BillboardSize {
  id: string;
  name: string;
  dimensions: string;
  description?: string;
}

export interface BillboardType {
  id: string;
  name: string;
  description?: string;
  billboard_category?: string;
  is_independent: boolean;
  image_url?: string;
  traffic_daily?: number;
  price_starting?: number;
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
  billboard_category?: string;
  image_url?: string;
}

// Digital Ad Types
export interface DigitalAd {
  id: string;
  platform: string;
  name: string;
  description: string;
  icon?: string;
  image_url?: string;
  min_budget: number;
  packages?: Package[];
}

// Kannywood Types
export interface KannywoodProduction {
  id: string;
  title: string;
  type: string;
  genre: string;
  description: string;
  director?: string;
  cast?: string[];
  release_date?: string;
  image_url?: string;
  packages?: Package[];
  verified: boolean;
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

// Order Types
export interface Order {
  id: string;
  user_id: string;
  items: CartItem[];
  total_amount: number;
  platform_fee?: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method?: 'online' | 'cash';
  payment_reference?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'pending_cash' | 'failed' | 'refunded';

// Consultation Types
export interface Consultation {
  id: string;
  user_id: string;
  consultation_type: 'online' | 'in_office';
  business_name: string;
  industry: string;
  business_stage: string;
  description: string;
  goals: string;
  budget_range: string;
  phone: string;
  email: string;
  price: number;
  status: 'pending' | 'scheduled' | 'completed' | 'cancelled';
  payment_status: PaymentStatus;
  scheduled_date?: string;
  scheduled_time?: string;
  meeting_link?: string;
  notes?: string;
  created_at: string;
}

// Message Types
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  content: string;
  read: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  order_id?: string;
  participants: string[];
  last_message?: Message;
  unread_count: number;
  created_at: string;
  updated_at: string;
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

// Search Types
export interface SearchResult {
  id: string;
  type: 'influencer' | 'billboard' | 'digital_ad' | 'kannywood';
  name: string;
  description: string;
  image_url?: string;
  price?: number;
}

// Stats Types
export interface UserStats {
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_spent: number;
}

export interface AdminStats {
  total_users: number;
  total_orders: number;
  total_consultations: number;
  total_revenue: number;
  pending_orders: number;
  pending_consultations: number;
}
