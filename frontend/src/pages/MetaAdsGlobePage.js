import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import axios from 'axios';
import { 
  ArrowLeft, 
  Globe, 
  Target, 
  DollarSign, 
  Image as ImageIcon, 
  Link as LinkIcon,
  MapPin,
  Upload,
  CheckCircle,
  Loader2,
  X,
  Send,
  Info,
  PanelRightClose,
  PanelRight,
  Users,
  Share2,
  Facebook,
  Building2,
  BarChart3,
  Play,
  Pause,
  TrendingUp,
  MousePointerClick,
  Eye,
  Settings,
  ChevronDown,
  ChevronUp,
  Unlink,
  RefreshCw,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Ad Platforms Configuration
const AD_PLATFORMS = [
  { 
    id: 'meta', 
    name: 'Meta Ads', 
    icon: '/platforms/meta.svg',
    color: '#0668E1',
    bgColor: 'from-blue-600/20 to-blue-700/20',
    borderColor: 'border-blue-500/30',
    description: 'Facebook & Instagram',
    connected: false
  },
  { 
    id: 'tiktok', 
    name: 'TikTok', 
    icon: '/platforms/tiktok.svg',
    color: '#000000',
    bgColor: 'from-gray-800/30 to-gray-900/30',
    borderColor: 'border-gray-500/30',
    description: 'TikTok Ads Manager',
    connected: false
  },
  { 
    id: 'google', 
    name: 'Google', 
    icon: '/platforms/google.svg',
    color: '#4285F4',
    bgColor: 'from-red-500/10 via-yellow-500/10 to-green-500/10',
    borderColor: 'border-yellow-500/30',
    description: 'Google Ads & YouTube',
    connected: false
  },
  { 
    id: 'snapchat', 
    name: 'Snapchat', 
    icon: '/platforms/snapchat.svg',
    color: '#FFFC00',
    bgColor: 'from-yellow-400/20 to-yellow-500/20',
    borderColor: 'border-yellow-400/30',
    description: 'Snapchat Ads',
    connected: false
  },
  { 
    id: 'youtube', 
    name: 'YouTube', 
    icon: '/platforms/youtube.svg',
    color: '#FF0000',
    bgColor: 'from-red-600/20 to-red-700/20',
    borderColor: 'border-red-500/30',
    description: 'YouTube Ads',
    connected: false
  },
];

// Meta Campaign Objectives
const CAMPAIGN_OBJECTIVES = [
  { value: 'OUTCOME_AWARENESS', label: 'Awareness', description: 'Reach people likely to remember your ads' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic', description: 'Send people to a destination like your website' },
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement', description: 'Get more messages, video views, or post engagement' },
  { value: 'OUTCOME_LEADS', label: 'Leads', description: 'Collect leads for your business' },
  { value: 'OUTCOME_APP_PROMOTION', label: 'App Promotion', description: 'Get people to install or take action in your app' },
  { value: 'OUTCOME_SALES', label: 'Sales', description: 'Find people likely to purchase your product or service' },
];

// Special Ad Categories
const SPECIAL_AD_CATEGORIES = [
  { value: 'NONE', label: 'None', requiresVerification: false },
  { value: 'HOUSING', label: 'Housing', description: 'Real estate, rentals, mortgages', requiresVerification: true },
  { value: 'EMPLOYMENT', label: 'Employment', description: 'Job opportunities, career services', requiresVerification: true },
  { value: 'ISSUES_ELECTIONS_POLITICS', label: 'Social Issues/Politics', description: 'Political ads, social issues', requiresVerification: true, requiresDisclaimer: true },
];

// Call-to-Action Types
const CTA_TYPES = [
  { value: 'LEARN_MORE', label: 'Learn More' },
  { value: 'SHOP_NOW', label: 'Shop Now' },
  { value: 'SIGN_UP', label: 'Sign Up' },
  { value: 'BOOK_NOW', label: 'Book Now' },
  { value: 'CONTACT_US', label: 'Contact Us' },
  { value: 'GET_QUOTE', label: 'Get Quote' },
  { value: 'SUBSCRIBE', label: 'Subscribe' },
  { value: 'DOWNLOAD', label: 'Download' },
  { value: 'APPLY_NOW', label: 'Apply Now' },
  { value: 'GET_OFFER', label: 'Get Offer' },
  { value: 'ORDER_NOW', label: 'Order Now' },
  { value: 'WATCH_MORE', label: 'Watch More' },
];

// Optimization Goals based on Objective
const OPTIMIZATION_GOALS = {
  OUTCOME_AWARENESS: [
    { value: 'REACH', label: 'Reach' },
    { value: 'IMPRESSIONS', label: 'Impressions' },
    { value: 'AD_RECALL_LIFT', label: 'Ad Recall Lift' },
  ],
  OUTCOME_TRAFFIC: [
    { value: 'LINK_CLICKS', label: 'Link Clicks' },
    { value: 'LANDING_PAGE_VIEWS', label: 'Landing Page Views' },
  ],
  OUTCOME_ENGAGEMENT: [
    { value: 'POST_ENGAGEMENT', label: 'Post Engagement' },
    { value: 'PAGE_LIKES', label: 'Page Likes' },
    { value: 'EVENT_RESPONSES', label: 'Event Responses' },
  ],
  OUTCOME_LEADS: [
    { value: 'LEAD_GENERATION', label: 'Lead Generation' },
    { value: 'CONVERSATIONS', label: 'Conversations' },
  ],
  OUTCOME_APP_PROMOTION: [
    { value: 'APP_INSTALLS', label: 'App Installs' },
    { value: 'APP_EVENTS', label: 'App Events' },
  ],
  OUTCOME_SALES: [
    { value: 'OFFSITE_CONVERSIONS', label: 'Conversions' },
    { value: 'VALUE', label: 'Value' },
  ],
};

// Mock Facebook Pages (for pages_show_list permission demo)
const MOCK_FACEBOOK_PAGES = [
  { id: 'page_001', name: 'Loading...', category: 'Page', followers: 0, picture: 'https://ui-avatars.com/api/?name=Loading&background=1877f2&color=fff' },
];

// Mock Ad Accounts (fallback only)
const MOCK_AD_ACCOUNTS = [
  { id: 'act_loading', name: 'Loading...', currency: 'NGN', status: 'LOADING', spend_cap: 0 },
];

// Empty campaigns (will be populated with real data)
const EMPTY_CAMPAIGNS = [];

// Age options (13-65+)
const AGE_OPTIONS = [
  { value: '13', label: '13' },
  { value: '18', label: '18' },
  { value: '21', label: '21' },
  { value: '25', label: '25' },
  { value: '30', label: '30' },
  { value: '35', label: '35' },
  { value: '40', label: '40' },
  { value: '45', label: '45' },
  { value: '50', label: '50' },
  { value: '55', label: '55' },
  { value: '60', label: '60' },
  { value: '65', label: '65+' },
];

// Gender options
const GENDER_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
];

// Language options (Nigerian focus + common)
const LANGUAGE_OPTIONS = [
  { value: 'all', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'ha', label: 'Hausa' },
  { value: 'yo', label: 'Yoruba' },
  { value: 'ig', label: 'Igbo' },
  { value: 'pcm', label: 'Nigerian Pidgin' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
];

export default function MetaAdsGlobePage() {
  const navigate = useNavigate();
  const iframeRef = useRef(null);
  const sidebarRef = useRef(null);
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Platform state
  const [activePlatform, setActivePlatform] = useState('meta');
  const [platformSettings, setPlatformSettings] = useState({
    meta: { enabled: true, connected: false, accountName: '' },
    tiktok: { enabled: false, connected: false, accountName: '' },
    google: { enabled: false, connected: false, accountName: '' },
    snapchat: { enabled: false, connected: false, accountName: '' },
    youtube: { enabled: false, connected: false, accountName: '' },
  });
  const [showPlatformBar, setShowPlatformBar] = useState(false);  // Hidden for Meta App Review
  
  // Feature flags for Meta App Review
  const SHOW_POST_UP_FEATURE = false;  // Hidden for Meta App Review
  
  // Influencers for Post Up feature
  const [influencers, setInfluencers] = useState([]);
  const [loadingInfluencers, setLoadingInfluencers] = useState(true);
  
  // Form State
  const [formData, setFormData] = useState({
    campaignName: '',
    objective: '',
    // Facebook Page & Ad Account selection (for Meta permissions)
    selectedPageId: '',
    selectedAdAccountId: '',
    // Order type
    orderType: 'AUCTION',
    // Post Up feature
    postUpInfluencers: [],
    postUpContentUrl: '',
    specialAdCategory: 'NONE',
    adSetName: '',
    budgetType: 'daily',
    budgetAmount: '',
    startDate: '',
    endDate: '',
    optimizationGoal: '',
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    latitude: null,
    longitude: null,
    radius: 1,
    locationName: '',
    // Target Audience
    minAge: '18',
    maxAge: '65',
    gender: 'ALL',
    languages: ['all'],
    // Creative
    primaryText: '',
    headline: '',
    description: '',
    destinationUrl: '',
    ctaType: 'LEARN_MORE',
    imageFile: null,
    imagePreview: null,
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [activeSection, setActiveSection] = useState('campaigns');
  
  // Meta Login State
  const [showMetaLoginModal, setShowMetaLoginModal] = useState(true);  // Show login immediately
  const [isMetaConnected, setIsMetaConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedAccount, setConnectedAccount] = useState(null);
  
  // Real Meta Data State
  const [facebookPages, setFacebookPages] = useState([]);
  const [adAccounts, setAdAccounts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [isLoadingAdAccounts, setIsLoadingAdAccounts] = useState(false);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [metaApiError, setMetaApiError] = useState(null);
  
  // Special Ad Category Verification State
  const [identityVerificationStatus, setIdentityVerificationStatus] = useState(null); // 'verified', 'pending', 'not_verified'
  const [disclaimerStatus, setDisclaimerStatus] = useState(null); // 'active', 'pending', 'none'
  const [disclaimers, setDisclaimers] = useState([]); // List of user's disclaimers
  const [selectedDisclaimer, setSelectedDisclaimer] = useState(null); // Selected disclaimer for the campaign
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const [isLoadingDisclaimers, setIsLoadingDisclaimers] = useState(false);

  // Fetch influencers on mount
  useEffect(() => {
    const fetchInfluencers = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/influencers`);
        setInfluencers(response.data);
      } catch (error) {
        console.error('Failed to fetch influencers:', error);
        toast.error('Failed to load influencers');
      } finally {
        setLoadingInfluencers(false);
      }
    };
    fetchInfluencers();
  }, []);

  // Fetch Facebook Pages using Graph API
  const fetchFacebookPages = async (accessToken) => {
    setIsLoadingPages(true);
    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,category,fan_count,picture.width(100)&access_token=${accessToken}`
      );
      const data = await response.json();
      
      if (data.error) {
        console.error('Error fetching pages:', data.error);
        setMetaApiError(`Pages: ${data.error.message}`);
        setFacebookPages([]);
        return [];
      }
      
      const pages = (data.data || []).map(page => ({
        id: page.id,
        name: page.name,
        category: page.category || 'Page',
        followers: page.fan_count || 0,
        picture: page.picture?.data?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(page.name)}&background=1877f2&color=fff`
      }));
      
      setFacebookPages(pages);
      return pages;
    } catch (error) {
      console.error('Failed to fetch Facebook pages:', error);
      setMetaApiError('Failed to fetch Facebook pages');
      setFacebookPages([]);
      return [];
    } finally {
      setIsLoadingPages(false);
    }
  };

  // Fetch Ad Accounts using Graph API
  const fetchAdAccounts = async (accessToken) => {
    setIsLoadingAdAccounts(true);
    try {
      const response = await fetch(
        `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_status,currency,amount_spent,spend_cap,business_name&access_token=${accessToken}`
      );
      const data = await response.json();
      
      if (data.error) {
        console.error('Error fetching ad accounts:', data.error);
        setMetaApiError(`Ad Accounts: ${data.error.message}`);
        setAdAccounts([]);
        return [];
      }
      
      const accounts = (data.data || []).map(account => ({
        id: account.id,
        name: account.name || account.business_name || `Account ${account.id}`,
        currency: account.currency || 'NGN',
        status: account.account_status === 1 ? 'ACTIVE' : account.account_status === 2 ? 'DISABLED' : 'PENDING',
        spend_cap: account.spend_cap ? parseInt(account.spend_cap) / 100 : 0,
        amount_spent: account.amount_spent ? parseInt(account.amount_spent) / 100 : 0
      }));
      
      setAdAccounts(accounts);
      return accounts;
    } catch (error) {
      console.error('Failed to fetch ad accounts:', error);
      setMetaApiError('Failed to fetch ad accounts');
      setAdAccounts([]);
      return [];
    } finally {
      setIsLoadingAdAccounts(false);
    }
  };

  // Fetch Campaigns for a specific Ad Account
  const fetchCampaigns = async (accessToken, adAccountId) => {
    if (!adAccountId) return [];
    
    setIsLoadingCampaigns(true);
    try {
      // Fetch campaigns with insights
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,created_time,insights.date_preset(last_30d){impressions,reach,clicks,spend,ctr}&limit=50&access_token=${accessToken}`
      );
      const data = await response.json();
      
      if (data.error) {
        console.error('Error fetching campaigns:', data.error);
        setMetaApiError(`Campaigns: ${data.error.message}`);
        setCampaigns([]);
        return [];
      }
      
      const campaignList = (data.data || []).map(campaign => {
        const insights = campaign.insights?.data?.[0] || {};
        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          daily_budget: campaign.daily_budget ? parseInt(campaign.daily_budget) / 100 : 0,
          lifetime_budget: campaign.lifetime_budget ? parseInt(campaign.lifetime_budget) / 100 : 0,
          spent: insights.spend ? parseFloat(insights.spend) : 0,
          impressions: insights.impressions ? parseInt(insights.impressions) : 0,
          reach: insights.reach ? parseInt(insights.reach) : 0,
          clicks: insights.clicks ? parseInt(insights.clicks) : 0,
          ctr: insights.ctr ? parseFloat(insights.ctr) : 0,
          created_at: campaign.created_time ? campaign.created_time.split('T')[0] : ''
        };
      });
      
      setCampaigns(campaignList);
      return campaignList;
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
      setMetaApiError('Failed to fetch campaigns');
      setCampaigns([]);
      return [];
    } finally {
      setIsLoadingCampaigns(false);
    }
  };

  // Fetch all Meta data after successful login
  const fetchAllMetaData = async (accessToken) => {
    setMetaApiError(null);
    
    // Fetch pages and ad accounts in parallel
    const [pages, accounts] = await Promise.all([
      fetchFacebookPages(accessToken),
      fetchAdAccounts(accessToken)
    ]);
    
    // If we have ad accounts, fetch campaigns for the first one
    if (accounts.length > 0) {
      await fetchCampaigns(accessToken, accounts[0].id);
      // Auto-select the first ad account
      updateField('selectedAdAccountId', accounts[0].id);
    }
    
    // Auto-select the first page if available
    if (pages.length > 0) {
      updateField('selectedPageId', pages[0].id);
    }
    
    return { pages, accounts };
  };

  // Check identity verification status for Special Ad Categories
  const checkIdentityVerification = async (accessToken, adAccountId) => {
    if (!accessToken || !adAccountId) return null;
    
    setIsCheckingVerification(true);
    try {
      // Check ad account for any restrictions related to identity verification
      const response = await fetch(
        `https://graph.facebook.com/v19.0/${adAccountId}?fields=account_status,disable_reason,funding_source_details,is_personal&access_token=${accessToken}`
      );
      const data = await response.json();
      
      if (data.error) {
        console.error('Error checking verification:', data.error);
        return null;
      }
      
      // Account status 1 = ACTIVE, 2 = DISABLED, 3 = UNSETTLED, etc.
      // For Special Ad Categories, we need to check if the account is in good standing
      const isAccountActive = data.account_status === 1;
      
      // Check Page verification status for political ads
      // This requires checking the Page's verification status
      setIdentityVerificationStatus(isAccountActive ? 'verified' : 'not_verified');
      
      return {
        accountStatus: data.account_status,
        isActive: isAccountActive,
        disableReason: data.disable_reason,
        isPersonal: data.is_personal
      };
    } catch (error) {
      console.error('Failed to check verification status:', error);
      return null;
    } finally {
      setIsCheckingVerification(false);
    }
  };

  // Fetch disclaimers for political/social issue ads
  const fetchDisclaimers = async (accessToken, pageId) => {
    if (!accessToken || !pageId) {
      setDisclaimers([]);
      setDisclaimerStatus('none');
      return null;
    }
    
    setIsLoadingDisclaimers(true);
    try {
      // Fetch Page's ad disclaimers using the page_backed_instagram_accounts and ad authorization
      // First, get the Page's authorization status and any linked disclaimers
      const pageResponse = await fetch(
        `https://graph.facebook.com/v19.0/${pageId}?fields=id,name,ad_campaign,is_eligible_for_branded_content&access_token=${accessToken}`
      );
      const pageData = await pageResponse.json();
      
      // Try to fetch disclaimers from the ad account's perspective
      // The endpoint for disclaimers is typically through the business or funding_source
      const adAccountId = formData.selectedAdAccountId || adAccounts[0]?.id;
      
      if (adAccountId) {
        // Try to get funding source details which may contain disclaimer info
        const fundingResponse = await fetch(
          `https://graph.facebook.com/v19.0/${adAccountId}?fields=funding_source_details,name&access_token=${accessToken}`
        );
        const fundingData = await fundingResponse.json();
        
        // Also try to get ad disclaimers directly
        const disclaimerResponse = await fetch(
          `https://graph.facebook.com/v19.0/${adAccountId}/ad_creatives?fields=ad_disclaimer&limit=10&access_token=${accessToken}`
        );
        const disclaimerData = await disclaimerResponse.json();
        
        // Extract any disclaimers found
        const foundDisclaimers = [];
        
        // Check funding source for disclaimer info
        if (fundingData.funding_source_details) {
          const details = fundingData.funding_source_details;
          if (details.disclaimer || details.display_string) {
            foundDisclaimers.push({
              id: 'funding_disclaimer',
              name: details.display_string || details.disclaimer || 'Ad Account Disclaimer',
              type: 'funding_source',
              status: 'active'
            });
          }
        }
        
        // Check ad creatives for disclaimers
        if (disclaimerData.data) {
          disclaimerData.data.forEach((creative, idx) => {
            if (creative.ad_disclaimer) {
              foundDisclaimers.push({
                id: creative.id || `disclaimer_${idx}`,
                name: creative.ad_disclaimer.content || creative.ad_disclaimer,
                type: 'ad_creative',
                status: 'active'
              });
            }
          });
        }
        
        // If we found disclaimers, set them
        if (foundDisclaimers.length > 0) {
          // Remove duplicates
          const uniqueDisclaimers = foundDisclaimers.filter((d, i, arr) => 
            arr.findIndex(x => x.name === d.name) === i
          );
          setDisclaimers(uniqueDisclaimers);
          setDisclaimerStatus('active');
          return uniqueDisclaimers;
        }
      }
      
      // No disclaimers found
      setDisclaimers([]);
      setDisclaimerStatus('none');
      return [];
      
    } catch (error) {
      console.error('Failed to fetch disclaimers:', error);
      setDisclaimers([]);
      setDisclaimerStatus('none');
      return [];
    } finally {
      setIsLoadingDisclaimers(false);
    }
  };

  // Handle Special Ad Category selection
  const handleSpecialAdCategoryChange = async (value) => {
    updateField('specialAdCategory', value);
    
    const category = SPECIAL_AD_CATEGORIES.find(c => c.value === value);
    
    if (category?.requiresVerification) {
      const token = connectedAccount?.accessToken || localStorage.getItem('meta_access_token');
      const adAccountId = formData.selectedAdAccountId || adAccounts[0]?.id;
      
      if (token && adAccountId) {
        await checkIdentityVerification(token, adAccountId);
      }
      
      // If political ads, also fetch disclaimers
      if (category?.requiresDisclaimer) {
        const pageId = formData.selectedPageId || facebookPages[0]?.id;
        if (token && pageId) {
          await fetchDisclaimers(token, pageId);
        }
      }
    } else {
      // Reset verification states for non-special categories
      setIdentityVerificationStatus(null);
      setDisclaimerStatus(null);
      setDisclaimers([]);
      setSelectedDisclaimer(null);
    }
  };

  // Simulated Meta Login (will be replaced with real OAuth after Meta approval)
  const handleMetaLogin = async (loginType) => {
    setIsConnecting(true);
    
    // Facebook Login for Business uses config_id with redirect flow
    const configId = '1018089424501122';
    const appId = '26924612877172486';
    
    // Get the current URL for redirect
    const redirectUri = encodeURIComponent(window.location.href.split('?')[0]);
    
    // Build the Facebook OAuth URL for Login for Business
    const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&config_id=${configId}&redirect_uri=${redirectUri}&response_type=token&display=popup`;
    
    // Open popup window
    const width = 600;
    const height = 700;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    const popup = window.open(
      authUrl,
      'facebook-login',
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
    );
    
    // Listen for the popup to close or redirect back
    const checkPopup = setInterval(() => {
      try {
        // Check if popup is closed
        if (!popup || popup.closed) {
          clearInterval(checkPopup);
          setIsConnecting(false);
          
          // Check if we got a token in the URL hash
          const hash = window.location.hash;
          if (hash && hash.includes('access_token')) {
            handleOAuthCallback(hash, loginType);
          }
          return;
        }
        
        // Check if popup redirected back to our domain
        if (popup.location.href.includes(window.location.hostname)) {
          const popupHash = popup.location.hash;
          popup.close();
          clearInterval(checkPopup);
          
          if (popupHash && popupHash.includes('access_token')) {
            handleOAuthCallback(popupHash, loginType);
          } else {
            setIsConnecting(false);
            toast.error('Login was cancelled');
          }
        }
      } catch (e) {
        // Cross-origin error - popup is still on Facebook domain, keep waiting
      }
    }, 500);
    
    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkPopup);
      if (popup && !popup.closed) {
        popup.close();
      }
      setIsConnecting(false);
    }, 300000);
  };
  
  // Handle OAuth callback with access token
  const handleOAuthCallback = async (hash, loginType) => {
    // Parse the hash to get access token
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    
    if (!accessToken) {
      setIsConnecting(false);
      toast.error('Failed to get access token');
      return;
    }
    
    // Store the token
    localStorage.setItem('meta_access_token', accessToken);
    
    // Clear the hash from URL
    window.history.replaceState(null, '', window.location.pathname);
    
    try {
      // Get user info using the Graph API
      const userResponse = await fetch(`https://graph.facebook.com/me?fields=name,email,picture.width(100)&access_token=${accessToken}`);
      const userInfo = await userResponse.json();
      
      if (userInfo.error) {
        throw new Error(userInfo.error.message);
      }
      
      localStorage.setItem('meta_user_id', userInfo.id);
      
      setConnectedAccount({
        name: userInfo.name || 'Meta User',
        email: userInfo.email || '',
        profilePicture: userInfo.picture?.data?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.name || 'User')}&background=1877f2&color=fff`,
        loginType: loginType,
        accessToken: accessToken,
        userId: userInfo.id,
      });
      
      setIsMetaConnected(true);
      setIsConnecting(false);
      setShowMetaLoginModal(false);
      
      toast.success(`Welcome, ${userInfo.name}!`, {
        description: 'Fetching your Pages, Ad Accounts, and Campaigns...',
      });
      
      // Fetch all Meta data (pages, ad accounts, campaigns)
      await fetchAllMetaData(accessToken);
      
      toast.success('Meta data loaded successfully!');
      
    } catch (err) {
      console.error('Error during OAuth callback:', err);
      setIsConnecting(false);
      toast.error('Failed to connect: ' + err.message);
    }
  };

  const handleDisconnectMeta = () => {
    // Clear stored tokens
    localStorage.removeItem('meta_access_token');
    localStorage.removeItem('meta_user_id');
    
    // Clear all Meta data
    setFacebookPages([]);
    setAdAccounts([]);
    setCampaigns([]);
    setMetaApiError(null);
    
    setIsMetaConnected(false);
    setConnectedAccount(null);
    setShowMetaLoginModal(true);
    toast.info('Disconnected from Meta');
  };

  // Check for OAuth callback on page load (redirect flow)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      handleOAuthCallback(hash, 'facebook');
      return; // Don't check stored token if we have a new one
    }
    
    // Also check if user has a stored token
    const storedToken = localStorage.getItem('meta_access_token');
    const storedUserId = localStorage.getItem('meta_user_id');
    
    if (storedToken && storedUserId) {
      // Verify the token is still valid
      fetch(`https://graph.facebook.com/me?fields=name,email,picture.width(100)&access_token=${storedToken}`)
        .then(res => res.json())
        .then(async (userInfo) => {
          if (userInfo.error) {
            // Token expired, clear it
            localStorage.removeItem('meta_access_token');
            localStorage.removeItem('meta_user_id');
            return;
          }
          
          setConnectedAccount({
            name: userInfo.name || 'Meta User',
            email: userInfo.email || '',
            profilePicture: userInfo.picture?.data?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo.name || 'User')}&background=1877f2&color=fff`,
            loginType: 'facebook',
            accessToken: storedToken,
            userId: storedUserId,
          });
          
          setIsMetaConnected(true);
          setShowMetaLoginModal(false);
          
          // Fetch all Meta data with stored token
          await fetchAllMetaData(storedToken);
        })
        .catch(() => {
          // Token invalid, clear it
          localStorage.removeItem('meta_access_token');
          localStorage.removeItem('meta_user_id');
        });
    }
  }, []);

  // Silent keyboard shortcut to bypass login (Ctrl+Shift+B) - Uses demo data for testing
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+Shift+B to bypass login silently
      if (e.ctrlKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        setShowMetaLoginModal(false);
        setIsMetaConnected(true);
        setConnectedAccount({
          name: 'Demo User',
          email: 'demo@adlinka.com',
          profilePicture: 'https://ui-avatars.com/api/?name=Demo&background=1877f2&color=fff',
          loginType: 'bypass',
          accessToken: 'demo_token',
          userId: 'demo_user',
        });
        // Set demo data for testing purposes
        setFacebookPages([
          { id: 'demo_page_1', name: 'Demo Page', category: 'Business', followers: 1000, picture: 'https://ui-avatars.com/api/?name=Demo&background=1877f2&color=fff' }
        ]);
        setAdAccounts([
          { id: 'act_demo', name: 'Demo Ad Account', currency: 'NGN', status: 'ACTIVE', spend_cap: 100000 }
        ]);
        setCampaigns([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'GLOBE_LOCATION_UPDATE') {
        const { latitude, longitude, radius, locationName } = event.data;
        setFormData(prev => ({
          ...prev,
          latitude,
          longitude,
          radius: radius / 1000,
          locationName: locationName || prev.locationName,
        }));
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Toggle influencer selection for Post Up
  const toggleInfluencer = (influencerId) => {
    setFormData(prev => {
      const currentSelected = prev.postUpInfluencers;
      if (currentSelected.includes(influencerId)) {
        return { ...prev, postUpInfluencers: currentSelected.filter(id => id !== influencerId) };
      } else {
        return { ...prev, postUpInfluencers: [...currentSelected, influencerId] };
      }
    });
  };

  // Get selected influencer names for display
  const getSelectedInfluencerNames = () => {
    return formData.postUpInfluencers
      .map(id => influencers.find(inf => inf._id === id || inf.id === id)?.name)
      .filter(Boolean);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 30 * 1024 * 1024) {
        toast.error('Image must be less than 30MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          imageFile: file,
          imagePreview: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      imageFile: null,
      imagePreview: null,
    }));
  };

  const validateForm = () => {
    const errors = [];
    if (!formData.campaignName) errors.push('Campaign name is required');
    if (!formData.objective) errors.push('Campaign objective is required');
    if (!formData.budgetAmount || parseFloat(formData.budgetAmount) <= 0) errors.push('Valid budget amount is required');
    if (!formData.startDate) errors.push('Start date is required');
    if (formData.budgetType === 'lifetime' && !formData.endDate) errors.push('End date is required for lifetime budget');
    if (!formData.latitude || !formData.longitude) errors.push('Please select a location on the globe');
    if (!formData.primaryText) errors.push('Primary text is required');
    if (!formData.headline) errors.push('Headline is required');
    if (!formData.destinationUrl) errors.push('Destination URL is required');
    if (!formData.imageFile) errors.push('Ad image is required');
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
      return;
    }
    
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get selected influencer details for Post Up
    const selectedInfluencerDetails = formData.postUpInfluencers.map(id => {
      const inf = influencers.find(i => i._id === id || i.id === id);
      return inf ? { id: inf._id || inf.id, name: inf.name, platform: inf.platform, handle: inf.handle } : null;
    }).filter(Boolean);
    
    const payload = {
      campaign: {
        name: formData.campaignName,
        objective: formData.objective,
        special_ad_categories: formData.specialAdCategory === 'NONE' ? [] : [formData.specialAdCategory],
        status: 'PAUSED',
      },
      // Post Up feature - send content to influencers to repost
      postUp: {
        enabled: formData.postUpInfluencers.length > 0 && formData.postUpContentUrl,
        influencers: selectedInfluencerDetails,
        contentUrl: formData.postUpContentUrl,
      },
      adSet: {
        name: formData.adSetName || `${formData.campaignName} - Ad Set`,
        [`${formData.budgetType}_budget`]: Math.round(parseFloat(formData.budgetAmount) * 100),
        optimization_goal: formData.optimizationGoal || OPTIMIZATION_GOALS[formData.objective]?.[0]?.value,
        billing_event: 'IMPRESSIONS',
        bid_strategy: formData.bidStrategy,
        start_time: new Date(formData.startDate).toISOString(),
        end_time: formData.endDate ? new Date(formData.endDate).toISOString() : null,
        targeting: {
          geo_locations: {
            custom_locations: [{
              latitude: formData.latitude,
              longitude: formData.longitude,
              radius: formData.radius,
              distance_unit: 'kilometer',
              name: formData.locationName,
            }]
          }
        },
        status: 'PAUSED',
      },
      creative: {
        name: `${formData.campaignName} - Creative`,
        object_story_spec: {
          link_data: {
            message: formData.primaryText,
            name: formData.headline,
            description: formData.description,
            link: formData.destinationUrl,
            call_to_action: {
              type: formData.ctaType,
              value: { link: formData.destinationUrl }
            }
          }
        }
      },
      ad: {
        name: `${formData.campaignName} - Ad`,
        status: 'PAUSED',
      }
    };
    
    setSubmittedData(payload);
    setIsSubmitting(false);
    setShowSuccessModal(true);
  };

  const resetForm = () => {
    setFormData({
      campaignName: '',
      objective: '',
      selectedPageId: '',
      selectedAdAccountId: '',
      orderType: 'AUCTION',
      postUpInfluencers: [],
      postUpContentUrl: '',
      specialAdCategory: 'NONE',
      adSetName: '',
      budgetType: 'daily',
      budgetAmount: '',
      startDate: '',
      endDate: '',
      optimizationGoal: '',
      bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
      latitude: null,
      longitude: null,
      radius: 1,
      locationName: '',
      minAge: '18',
      maxAge: '65',
      gender: 'ALL',
      languages: ['all'],
      primaryText: '',
      headline: '',
      description: '',
      destinationUrl: '',
      ctaType: 'LEARN_MORE',
      imageFile: null,
      imagePreview: null,
    });
    setShowSuccessModal(false);
    setSubmittedData(null);
  };

  const sections = [
    { id: 'campaigns', label: 'Campaigns', icon: BarChart3, color: 'from-cyan-500 to-cyan-600' },
    { id: 'campaign', label: 'New Campaign', icon: Target, color: 'from-blue-500 to-blue-600' },
    { id: 'targeting', label: 'Target Audience', icon: Users, color: 'from-green-500 to-green-600' },
    { id: 'budget', label: 'Budget', icon: DollarSign, color: 'from-amber-500 to-amber-600' },
    { id: 'creative', label: 'Creative', icon: ImageIcon, color: 'from-purple-500 to-purple-600' },
    // Settings tab hidden for Meta App Review (contains multi-platform toggle)
    // { id: 'settings', label: 'Settings', icon: Settings, color: 'from-gray-500 to-gray-600' },
  ];

  // Toggle platform enabled state
  const togglePlatformEnabled = (platformId) => {
    setPlatformSettings(prev => ({
      ...prev,
      [platformId]: { ...prev[platformId], enabled: !prev[platformId].enabled }
    }));
  };

  // Connect platform account (simulated)
  const connectPlatformAccount = (platformId) => {
    // For now, simulate connection. Later integrate real OAuth for each platform
    if (platformId === 'meta') {
      // Use existing Meta login
      setShowMetaLoginModal(true);
      return;
    }
    
    // Simulate connection for other platforms
    toast.info(`${AD_PLATFORMS.find(p => p.id === platformId)?.name} integration coming soon!`, {
      description: 'This platform will be available after API approval.'
    });
  };

  // Get platform display name
  const getPlatformName = (platformId) => {
    return AD_PLATFORMS.find(p => p.id === platformId)?.name || platformId;
  };

  // Get active platforms count
  const getActivePlatformsCount = () => {
    return Object.values(platformSettings).filter(p => p.enabled).length;
  };

  return (
    <div className="h-screen w-full flex bg-slate-900 overflow-hidden relative">
      {/* Globe - Full Screen Background */}
      <div className="absolute inset-0">
        <iframe
          ref={iframeRef}
          src="/meta-ads-globe.html"
          className="w-full h-full border-0"
          title="AdGlobe 3D"
        />
      </div>

      {/* Toggle Button when sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute top-4 right-4 z-30 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 flex items-center gap-2 group"
        >
          <span className="text-sm font-medium">Open Panel</span>
          <PanelRight className="h-5 w-5" />
        </button>
      )}

      {/* Floating Platform Selector */}
      {sidebarOpen && showPlatformBar && (
        <div className="absolute right-0 top-[70px] w-1/2 z-30 px-4">
          <div className="bg-slate-800/95 backdrop-blur-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {/* Collapse Handle */}
            <button 
              onClick={() => setShowPlatformBar(false)}
              className="w-full flex justify-center py-2 hover:bg-white/5 transition-colors"
            >
              <ChevronUp className="h-5 w-5 text-white/40" />
            </button>
            
            {/* Header */}
            <div className="text-center pb-3 px-4">
              <h2 className="text-white font-bold text-base">PUBLISH ACROSS PLATFORMS</h2>
              <p className="text-white/50 text-xs mt-1">Deploy your campaign to multiple platforms</p>
            </div>
            
            {/* Platform Icons */}
            <div className="flex justify-center gap-4 px-6 pb-5">
              {AD_PLATFORMS.map((platform) => {
                const isActive = activePlatform === platform.id;
                const isEnabled = platformSettings[platform.id]?.enabled;
                const isConnected = platform.id === 'meta' ? isMetaConnected : platformSettings[platform.id]?.connected;
                
                return (
                  <button
                    key={platform.id}
                    onClick={() => {
                      if (isEnabled) {
                        setActivePlatform(platform.id);
                      } else {
                        toast.info(`Enable ${platform.name} in Settings to use it`);
                      }
                    }}
                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all ${
                      isActive 
                        ? 'bg-white/10 ring-2 ring-white/30 scale-105'
                        : isEnabled
                          ? 'hover:bg-white/5'
                          : 'opacity-30'
                    }`}
                  >
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden ${
                        isActive ? 'ring-2 ring-white/40' : ''
                      }`} style={{ backgroundColor: platform.id === 'meta' ? '#0668E1' : platform.id === 'tiktok' ? '#000' : platform.id === 'snapchat' ? '#FFFC00' : platform.id === 'youtube' ? '#FF0000' : '#fff' }}>
                        <img 
                          src={platform.icon} 
                          alt={platform.name}
                          className="w-10 h-10"
                        />
                      </div>
                      {isConnected && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800 flex items-center justify-center">
                          <CheckCircle className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                    </div>
                    <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-white/60'}`}>
                      {platform.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - Right Side (Fixed 50% width) */}
      {sidebarOpen && (
        <div 
          ref={sidebarRef}
          className="absolute right-0 top-0 h-full w-1/2 flex flex-col z-20 shadow-2xl shadow-black/50"
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 opacity-98" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10" />
          
          {/* Content */}
          <div className="relative flex flex-col h-full">
            {/* Header */}
            <div className="px-5 py-3 border-b border-white/10 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Back arrow hidden for Meta App Review */}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center`} style={{ backgroundColor: '#0668E1' }}>
                      <img 
                        src="/platforms/meta.svg"
                        alt="Meta Ads"
                        className="w-6 h-6"
                      />
                    </div>
                    <div>
                      <h1 className="text-base font-bold text-white">
                        Meta Ads Campaign
                      </h1>
                      <p className="text-xs text-white/50">
                        Facebook & Instagram
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Connected Account Indicator */}
                  {activePlatform === 'meta' && isMetaConnected && connectedAccount && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/10">
                      <img 
                        src={connectedAccount.profilePicture} 
                        alt={connectedAccount.name}
                        className="w-5 h-5 rounded-full"
                      />
                      <span className="text-xs text-white/80 font-medium max-w-[100px] truncate">{connectedAccount.name}</span>
                      <button
                        onClick={handleDisconnectMeta}
                        className="p-0.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white"
                        title="Disconnect"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(false)}
                    className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
                  >
                    <PanelRightClose className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Platform Bar Toggle - Hidden for Meta App Review */}
              {/* {!showPlatformBar && (
                <button 
                  onClick={() => setShowPlatformBar(true)}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                >
                  <span className="text-xs font-medium">Show Platforms</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              )} */}
            </div>

            {/* Section Navigation */}
            <div className="flex gap-1 p-3 border-b border-white/10 bg-black/20">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeSection === section.id 
                      ? `bg-gradient-to-r ${section.color} text-white shadow-lg` 
                      : 'text-white/50 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  <section.icon className="h-3.5 w-3.5" />
                  {section.label}
                </button>
              ))}
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
              
              {/* API Error Display */}
              {metaApiError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">API Error</span>
                  </div>
                  <p className="text-xs text-red-300/70 mt-1">{metaApiError}</p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2 text-xs border-red-500/30 text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      const token = connectedAccount?.accessToken || localStorage.getItem('meta_access_token');
                      if (token) fetchAllMetaData(token);
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              )}
              
              {/* Setup Required Warning - Show if user has no Pages or Ad Accounts */}
              {isMetaConnected && !isLoadingPages && !isLoadingAdAccounts && (facebookPages.length === 0 || adAccounts.length === 0) && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="h-4 w-4 text-yellow-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-yellow-300 text-sm">Setup Required</h3>
                      <p className="text-xs text-yellow-200/70 mt-1 mb-3">
                        To create ad campaigns, you need both a Facebook Page and an Ad Account.
                      </p>
                      <div className="space-y-2">
                        {facebookPages.length === 0 && (
                          <div className="flex items-center gap-2">
                            <X className="h-3 w-3 text-red-400" />
                            <span className="text-xs text-white/70">No Facebook Page found</span>
                            <a 
                              href="https://www.facebook.com/pages/create" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              Create Page <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                        {facebookPages.length > 0 && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-400" />
                            <span className="text-xs text-white/70">Facebook Page connected</span>
                          </div>
                        )}
                        {adAccounts.length === 0 && (
                          <div className="flex items-center gap-2">
                            <X className="h-3 w-3 text-red-400" />
                            <span className="text-xs text-white/70">No Ad Account found</span>
                            <a 
                              href="https://business.facebook.com/settings/ad-accounts" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                            >
                              Create Account <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                        {adAccounts.length > 0 && (
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-400" />
                            <span className="text-xs text-white/70">Ad Account connected</span>
                          </div>
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-3 text-xs border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/10"
                        onClick={() => {
                          const token = connectedAccount?.accessToken || localStorage.getItem('meta_access_token');
                          if (token) fetchAllMetaData(token);
                        }}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" /> Refresh Data
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Campaigns List Section - for ads_read permission */}
              {activeSection === 'campaigns' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h2 className="font-semibold text-white">My Campaigns</h2>
                        <p className="text-xs text-white/50">View and manage your ad campaigns</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const token = connectedAccount?.accessToken || localStorage.getItem('meta_access_token');
                          const adAccountId = formData.selectedAdAccountId || adAccounts[0]?.id;
                          if (token && adAccountId) {
                            await fetchCampaigns(token, adAccountId);
                            toast.success('Campaigns refreshed');
                          }
                        }}
                        className="border-white/20 text-white/70 hover:text-white hover:bg-white/10 text-xs"
                        disabled={isLoadingCampaigns}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isLoadingCampaigns ? 'animate-spin' : ''}`} /> Refresh
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setActiveSection('campaign')}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs"
                      >
                        + New Campaign
                      </Button>
                    </div>
                  </div>

                  {/* Campaign Stats Summary */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
                      <div className="text-2xl font-bold text-green-400">{campaigns.filter(c => c.status === 'ACTIVE').length}</div>
                      <div className="text-xs text-green-300/70">Active Campaigns</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
                      <div className="text-2xl font-bold text-blue-400">
                        {campaigns.length > 0 
                          ? `NGN ${(campaigns.reduce((sum, c) => sum + (c.spent || 0), 0) / 1000).toFixed(0)}K`
                          : 'NGN 0'
                        }
                      </div>
                      <div className="text-xs text-blue-300/70">Total Spent</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                      <div className="text-2xl font-bold text-purple-400">
                        {campaigns.length > 0
                          ? `${(campaigns.reduce((sum, c) => sum + (c.reach || 0), 0) / 1000000).toFixed(2)}M`
                          : '0'
                        }
                      </div>
                      <div className="text-xs text-purple-300/70">Total Reach</div>
                    </div>
                  </div>

                  {/* Campaign List */}
                  <div className="space-y-3">
                    {isLoadingCampaigns ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                        <span className="ml-3 text-white/60">Loading campaigns...</span>
                      </div>
                    ) : campaigns.length === 0 ? (
                      <div className="p-8 text-center rounded-xl bg-white/5 border border-white/10">
                        <BarChart3 className="h-12 w-12 mx-auto text-white/30 mb-3" />
                        <p className="text-white/60 font-medium">No campaigns found</p>
                        <p className="text-white/40 text-sm mt-1">Create your first campaign to get started</p>
                        <Button
                          size="sm"
                          onClick={() => setActiveSection('campaign')}
                          className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600"
                        >
                          + Create Campaign
                        </Button>
                      </div>
                    ) : campaigns.map((campaign) => (
                      <div 
                        key={campaign.id}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-white">{campaign.name}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                campaign.status === 'ACTIVE' 
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                  : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                              }`}>
                                <span className="flex items-center gap-1">
                                  {campaign.status === 'ACTIVE' ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                                  {campaign.status}
                                </span>
                              </span>
                            </div>
                            <div className="text-xs text-white/50 mt-1">
                              {campaign.objective.replace('OUTCOME_', '')} • Created {campaign.created_at}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white">₦{(campaign.daily_budget / 1000).toFixed(0)}K/day</div>
                            <div className="text-xs text-white/50">Spent: ₦{(campaign.spent / 1000).toFixed(0)}K</div>
                          </div>
                        </div>
                        
                        {/* Campaign Metrics */}
                        <div className="grid grid-cols-4 gap-2">
                          <div className="p-2 rounded-lg bg-white/5">
                            <div className="flex items-center gap-1 text-xs text-white/50 mb-1">
                              <Eye className="h-3 w-3" /> Impressions
                            </div>
                            <div className="font-semibold text-white text-sm">{(campaign.impressions / 1000).toFixed(0)}K</div>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5">
                            <div className="flex items-center gap-1 text-xs text-white/50 mb-1">
                              <Users className="h-3 w-3" /> Reach
                            </div>
                            <div className="font-semibold text-white text-sm">{(campaign.reach / 1000).toFixed(0)}K</div>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5">
                            <div className="flex items-center gap-1 text-xs text-white/50 mb-1">
                              <MousePointerClick className="h-3 w-3" /> Clicks
                            </div>
                            <div className="font-semibold text-white text-sm">{(campaign.clicks / 1000).toFixed(1)}K</div>
                          </div>
                          <div className="p-2 rounded-lg bg-white/5">
                            <div className="flex items-center gap-1 text-xs text-white/50 mb-1">
                              <TrendingUp className="h-3 w-3" /> CTR
                            </div>
                            <div className="font-semibold text-cyan-400 text-sm">{campaign.ctr}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Info Note */}
                  <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-cyan-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-cyan-300">Campaign Performance</p>
                        <p className="text-xs text-cyan-200/60 mt-1">
                          Data synced from Meta Ads Manager. Click on a campaign to view detailed analytics and make edits.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Campaign Section */}
              {activeSection === 'campaign' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <Target className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="font-semibold text-white">Campaign Settings</h2>
                  </div>

                  {/* Facebook Page Selection - for pages_show_list permission */}
                  <div className="space-y-3 p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center">
                        <Facebook className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <Label className="text-white/90 text-sm font-semibold">Facebook Page *</Label>
                        <p className="text-xs text-blue-200/60">Select the Page to run ads from</p>
                      </div>
                    </div>
                    <Select value={formData.selectedPageId} onValueChange={(v) => updateField('selectedPageId', v)}>
                      <SelectTrigger className="bg-white/5 border-blue-500/20 text-white">
                        <SelectValue placeholder={isLoadingPages ? "Loading pages..." : "Select a Facebook Page"} />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        {isLoadingPages ? (
                          <div className="p-4 text-center text-white/60">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                            Loading your Pages...
                          </div>
                        ) : facebookPages.length === 0 ? (
                          <div className="p-4 text-white/70">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-400" />
                              <span className="font-medium text-yellow-300">No Facebook Pages Found</span>
                            </div>
                            <p className="text-xs text-white/50 mb-3">
                              To run ads, you need admin access to at least one Facebook Page.
                            </p>
                            <a 
                              href="https://www.facebook.com/pages/create" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                              <span>Create a Facebook Page</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        ) : facebookPages.map((page) => (
                          <SelectItem key={page.id} value={page.id} className="text-white hover:bg-white/10">
                            <div className="flex items-center gap-3">
                              <img src={page.picture} alt={page.name} className="w-8 h-8 rounded-full" />
                              <div>
                                <div className="font-medium">{page.name}</div>
                                <div className="text-xs text-white/50">{page.category} • {(page.followers / 1000).toFixed(1)}K followers</div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.selectedPageId && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-xs text-green-300">
                          Page selected: {facebookPages.find(p => p.id === formData.selectedPageId)?.name}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Ad Account Selection - for business_management permission */}
                  <div className="space-y-3 p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center">
                        <Building2 className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <Label className="text-white/90 text-sm font-semibold">Ad Account *</Label>
                        <p className="text-xs text-indigo-200/60">Select the business ad account</p>
                      </div>
                    </div>
                    <Select 
                      value={formData.selectedAdAccountId} 
                      onValueChange={async (v) => {
                        updateField('selectedAdAccountId', v);
                        // Fetch campaigns for this ad account
                        const token = connectedAccount?.accessToken || localStorage.getItem('meta_access_token');
                        if (token && v) {
                          await fetchCampaigns(token, v);
                        }
                      }}
                    >
                      <SelectTrigger className="bg-white/5 border-indigo-500/20 text-white">
                        <SelectValue placeholder={isLoadingAdAccounts ? "Loading accounts..." : "Select an Ad Account"} />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        {isLoadingAdAccounts ? (
                          <div className="p-4 text-center text-white/60">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                            Loading your Ad Accounts...
                          </div>
                        ) : adAccounts.length === 0 ? (
                          <div className="p-4 text-white/70">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="h-4 w-4 text-yellow-400" />
                              <span className="font-medium text-yellow-300">No Ad Accounts Found</span>
                            </div>
                            <p className="text-xs text-white/50 mb-3">
                              To create campaigns, you need access to a Meta Business Ad Account.
                            </p>
                            <div className="space-y-2">
                              <a 
                                href="https://business.facebook.com/settings/ad-accounts" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                              >
                                <span>Create Ad Account in Business Settings</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              <p className="text-xs text-white/40">
                                Or ask your Business Manager admin to grant you access.
                              </p>
                            </div>
                          </div>
                        ) : adAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id} className="text-white hover:bg-white/10">
                            <div>
                              <div className="font-medium">{account.name}</div>
                              <div className="text-xs text-white/50">
                                {account.id} • {account.currency} • {account.status}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.selectedAdAccountId && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-xs text-green-300">
                          Account: {adAccounts.find(a => a.id === formData.selectedAdAccountId)?.name}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Campaign Name *</Label>
                    <Input
                      placeholder="Enter campaign name"
                      value={formData.campaignName}
                      onChange={(e) => updateField('campaignName', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-blue-500 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Campaign Objective *</Label>
                    <Select value={formData.objective} onValueChange={(v) => updateField('objective', v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Select objective" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        {CAMPAIGN_OBJECTIVES.map((obj) => (
                          <SelectItem key={obj.value} value={obj.value} className="text-white hover:bg-white/10">
                            <div>
                              <div className="font-medium">{obj.label}</div>
                              <div className="text-xs text-white/50">{obj.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Order Type - Auction or Reserved */}
                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Buying Type *</Label>
                    <Select value={formData.orderType} onValueChange={(v) => updateField('orderType', v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Select buying type" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        <SelectItem value="AUCTION" className="text-white hover:bg-white/10">
                          <div>
                            <div className="font-medium">Auction</div>
                            <div className="text-xs text-white/50">Compete for ad placements in real-time</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="RESERVED" className="text-white hover:bg-white/10">
                          <div>
                            <div className="font-medium">Reserved</div>
                            <div className="text-xs text-white/50">Guaranteed delivery at fixed price</div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-white/40">Auction is recommended for most campaigns</p>
                  </div>

                  {/* Post Up Feature - Conditionally hidden for Meta App Review */}
                  {SHOW_POST_UP_FEATURE && (
                  <div className="space-y-3 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Share2 className="h-3.5 w-3.5 text-white" />
                      </div>
                      <div>
                        <Label className="text-white/90 text-sm font-semibold">Post Up By</Label>
                        <p className="text-xs text-purple-200/60">Send content to influencers to repost</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-white/70 text-xs">Select Influencers</Label>
                      {loadingInfluencers ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 text-white/50 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading influencers...
                        </div>
                      ) : influencers.length === 0 ? (
                        <div className="p-3 rounded-lg bg-white/5 text-white/50 text-sm">
                          No influencers available
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="max-h-40 overflow-y-auto rounded-lg bg-white/5 border border-white/10 p-2 space-y-1">
                            {influencers.map((influencer) => {
                              const id = influencer._id || influencer.id;
                              const isSelected = formData.postUpInfluencers.includes(id);
                              return (
                                <div
                                  key={id}
                                  onClick={() => toggleInfluencer(id)}
                                  className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                                    isSelected 
                                      ? 'bg-purple-500/20 border border-purple-500/40' 
                                      : 'hover:bg-white/5 border border-transparent'
                                  }`}
                                >
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                    isSelected 
                                      ? 'bg-purple-500 border-purple-500' 
                                      : 'border-white/30'
                                  }`}>
                                    {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                                  </div>
                                  <img 
                                    src={influencer.profile_picture || influencer.profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(influencer.name)}&background=6366f1&color=fff`}
                                    alt={influencer.name}
                                    className="w-8 h-8 rounded-full object-cover border border-white/20"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-white font-medium truncate">{influencer.name}</div>
                                    <div className="text-xs text-white/50 truncate">
                                      {influencer.platform} • @{influencer.handle || influencer.username}
                                    </div>
                                  </div>
                                  <div className="text-xs text-purple-300 font-medium">
                                    {influencer.followers ? `${(influencer.followers / 1000).toFixed(1)}K` : ''}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {formData.postUpInfluencers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {getSelectedInfluencerNames().map((name, idx) => (
                                <span key={idx} className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-200 text-xs font-medium">
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/70 text-xs">Content URL to Repost</Label>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-purple-300/50" />
                        <Input
                          type="url"
                          placeholder="https://instagram.com/p/..."
                          value={formData.postUpContentUrl}
                          onChange={(e) => updateField('postUpContentUrl', e.target.value)}
                          className="pl-9 bg-white/5 border-purple-500/20 text-white placeholder:text-white/30 focus:border-purple-500 focus:ring-purple-500/20"
                        />
                      </div>
                      <p className="text-xs text-purple-200/50">
                        Paste the Instagram/Facebook post URL for influencers to share
                      </p>
                    </div>

                    {formData.postUpInfluencers.length > 0 && formData.postUpContentUrl && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/30">
                        <CheckCircle className="h-4 w-4 text-green-400" />
                        <span className="text-xs text-green-300">
                          {formData.postUpInfluencers.length} influencer{formData.postUpInfluencers.length > 1 ? 's' : ''} will receive this content
                        </span>
                      </div>
                    )}
                  </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Special Ad Category</Label>
                    <Select value={formData.specialAdCategory} onValueChange={handleSpecialAdCategoryChange}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        {SPECIAL_AD_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value} className="text-white hover:bg-white/10">
                            <div>
                              <div className="font-medium">{cat.label}</div>
                              {cat.description && (
                                <div className="text-xs text-white/50">{cat.description}</div>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-white/40">Required for housing, employment, or political ads</p>
                    
                    {/* Verification Status for Special Ad Categories */}
                    {formData.specialAdCategory && formData.specialAdCategory !== 'NONE' && (
                      <div className="mt-3 space-y-2">
                        {isCheckingVerification ? (
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                            <span className="text-xs text-white/60">Checking verification status...</span>
                          </div>
                        ) : (
                          <>
                            {/* Identity Verification Status */}
                            {identityVerificationStatus === 'verified' ? (
                              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                                <CheckCircle className="h-4 w-4 text-green-400" />
                                <div>
                                  <span className="text-xs text-green-300 font-medium">Identity Verified</span>
                                  <p className="text-xs text-green-200/60">Your ad account is authorized for Special Ad Categories</p>
                                </div>
                              </div>
                            ) : identityVerificationStatus === 'not_verified' ? (
                              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertTriangle className="h-4 w-4 text-red-400" />
                                  <span className="text-xs text-red-300 font-medium">Identity Verification Required</span>
                                </div>
                                <p className="text-xs text-red-200/60 mb-2">
                                  To run {SPECIAL_AD_CATEGORIES.find(c => c.value === formData.specialAdCategory)?.label} ads, you must verify your identity.
                                </p>
                                <a 
                                  href="https://www.facebook.com/id" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                >
                                  <span>Verify Your Identity</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                                <AlertTriangle className="h-4 w-4 text-yellow-400" />
                                <div>
                                  <span className="text-xs text-yellow-300 font-medium">Verification Check Required</span>
                                  <p className="text-xs text-yellow-200/60">Select an Ad Account to check verification status</p>
                                </div>
                              </div>
                            )}
                            
                            {/* Disclaimer Status for Political Ads */}
                            {formData.specialAdCategory === 'ISSUES_ELECTIONS_POLITICS' && (
                              <div className="mt-2">
                                {isLoadingDisclaimers ? (
                                  <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                                    <span className="text-xs text-white/60">Loading your disclaimers...</span>
                                  </div>
                                ) : disclaimers.length > 0 ? (
                                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                      <CheckCircle className="h-4 w-4 text-green-400" />
                                      <span className="text-xs text-green-300 font-medium">Disclaimers Available</span>
                                    </div>
                                    <p className="text-xs text-green-200/60 mb-3">
                                      You have {disclaimers.length} disclaimer{disclaimers.length > 1 ? 's' : ''} available. Select one to link to this campaign.
                                    </p>
                                    
                                    {/* Disclaimer Selection Dropdown */}
                                    <div className="space-y-2">
                                      <Label className="text-white/70 text-xs">Link Disclaimer</Label>
                                      <Select value={selectedDisclaimer?.id || ''} onValueChange={(v) => {
                                        const disc = disclaimers.find(d => d.id === v);
                                        setSelectedDisclaimer(disc);
                                      }}>
                                        <SelectTrigger className="bg-white/5 border-green-500/30 text-white text-xs">
                                          <SelectValue placeholder="Select a disclaimer" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-800 border-white/10">
                                          {disclaimers.map((disc) => (
                                            <SelectItem key={disc.id} value={disc.id} className="text-white hover:bg-white/10">
                                              <div className="flex items-center gap-2">
                                                <CheckCircle className="h-3 w-3 text-green-400" />
                                                <span className="text-xs">{disc.name}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      
                                      {selectedDisclaimer && (
                                        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/20 border border-green-500/40">
                                          <CheckCircle className="h-3 w-3 text-green-400" />
                                          <span className="text-xs text-green-300">Linked: {selectedDisclaimer.name}</span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Option to create new disclaimer */}
                                    <div className="mt-3 pt-3 border-t border-green-500/20">
                                      <a 
                                        href="https://www.facebook.com/ads/manage/disclaimer" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                                      >
                                        <span>+ Create New Disclaimer</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                      <AlertTriangle className="h-4 w-4 text-orange-400" />
                                      <span className="text-xs text-orange-300 font-medium">Disclaimer Required</span>
                                    </div>
                                    <p className="text-xs text-orange-200/60 mb-2">
                                      Political ads require a "Paid for by" disclaimer. Create one to continue.
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <a 
                                        href="https://www.facebook.com/ads/manage/disclaimer" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg"
                                      >
                                        <span>Create Disclaimer</span>
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                      <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="text-xs border-orange-500/30 text-orange-300 hover:bg-orange-500/10 h-7"
                                        onClick={() => {
                                          const token = connectedAccount?.accessToken || localStorage.getItem('meta_access_token');
                                          const pageId = formData.selectedPageId || facebookPages[0]?.id;
                                          if (token && pageId) fetchDisclaimers(token, pageId);
                                        }}
                                      >
                                        <RefreshCw className="h-3 w-3 mr-1" /> Refresh
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {formData.objective && (
                    <div className="space-y-2">
                      <Label className="text-white/80 text-sm">Optimization Goal</Label>
                      <Select value={formData.optimizationGoal} onValueChange={(v) => updateField('optimizationGoal', v)}>
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue placeholder="Select goal" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-white/10">
                          {OPTIMIZATION_GOALS[formData.objective]?.map((goal) => (
                            <SelectItem key={goal.value} value={goal.value} className="text-white hover:bg-white/10">
                              {goal.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}

              {/* Targeting Section */}
              {activeSection === 'targeting' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="font-semibold text-white">Target Audience</h2>
                  </div>

                  {/* Age Selection */}
                  <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                    <Label className="text-white/90 text-sm font-medium">Age Range</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-white/60 text-xs">Minimum age</Label>
                        <Select value={formData.minAge} onValueChange={(v) => updateField('minAge', v)}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white">
                            <SelectValue placeholder="Min" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-white/10">
                            {AGE_OPTIONS.map((age) => (
                              <SelectItem key={age.value} value={age.value} className="text-white hover:bg-white/10">
                                {age.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-white/60 text-xs">Maximum age</Label>
                        <Select value={formData.maxAge} onValueChange={(v) => updateField('maxAge', v)}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white">
                            <SelectValue placeholder="Max" />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-800 border-white/10">
                            {AGE_OPTIONS.map((age) => (
                              <SelectItem key={age.value} value={age.value} className="text-white hover:bg-white/10">
                                {age.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Gender Selection */}
                  <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                    <Label className="text-white/90 text-sm font-medium">Gender</Label>
                    <Select value={formData.gender} onValueChange={(v) => updateField('gender', v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        {GENDER_OPTIONS.map((g) => (
                          <SelectItem key={g.value} value={g.value} className="text-white hover:bg-white/10">
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Languages Selection */}
                  <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label className="text-white/90 text-sm font-medium">Languages</Label>
                        <Info className="h-3.5 w-3.5 text-white/40" />
                      </div>
                      <span className="text-xs text-blue-400">
                        {formData.languages.includes('all') ? 'All languages' : `${formData.languages.length} selected`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {LANGUAGE_OPTIONS.map((lang) => {
                        const isSelected = formData.languages.includes(lang.value);
                        const isAll = lang.value === 'all';
                        return (
                          <button
                            key={lang.value}
                            type="button"
                            onClick={() => {
                              if (isAll) {
                                updateField('languages', ['all']);
                              } else {
                                const newLangs = formData.languages.filter(l => l !== 'all');
                                if (isSelected) {
                                  const filtered = newLangs.filter(l => l !== lang.value);
                                  updateField('languages', filtered.length === 0 ? ['all'] : filtered);
                                } else {
                                  updateField('languages', [...newLangs, lang.value]);
                                }
                              }
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                              isSelected
                                ? 'bg-green-500/30 text-green-300 border border-green-500/50'
                                : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {lang.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Location Targeting Header */}
                  <div className="flex items-center gap-2 mt-6 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <MapPin className="h-3 w-3 text-white" />
                    </div>
                    <h3 className="font-medium text-white/90 text-sm">Location Targeting</h3>
                  </div>

                  <div className="p-3 rounded-xl bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-500/30">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-300">Use the Globe</p>
                        <p className="text-xs text-blue-200/60 mt-1">
                          Search locations on the globe, then use +/- to adjust targeting radius.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-white/60 text-xs">Latitude</Label>
                      <Input
                        value={formData.latitude ? formData.latitude.toFixed(6) : ''}
                        readOnly
                        placeholder="From globe"
                        className="bg-white/5 border-white/10 text-white/80 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/60 text-xs">Longitude</Label>
                      <Input
                        value={formData.longitude ? formData.longitude.toFixed(6) : ''}
                        readOnly
                        placeholder="From globe"
                        className="bg-white/5 border-white/10 text-white/80 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-white/60 text-xs">Radius (km)</Label>
                      <Input
                        value={formData.radius ? formData.radius.toFixed(1) : ''}
                        readOnly
                        placeholder="Adjust on globe"
                        className="bg-white/5 border-white/10 text-white/80 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/60 text-xs">Location Name</Label>
                      <Input
                        value={formData.locationName}
                        onChange={(e) => updateField('locationName', e.target.value)}
                        placeholder="e.g., Lagos Central"
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                    </div>
                  </div>

                  {formData.latitude && formData.longitude && (
                    <div className="p-3 rounded-xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30">
                      <div className="flex items-center gap-2 text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium text-sm">Location captured!</span>
                      </div>
                      <p className="text-xs text-green-200/60 mt-1">
                        {formData.radius.toFixed(1)} km radius around {formData.locationName || 'selected point'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Budget Section */}
              {activeSection === 'budget' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="font-semibold text-white">Budget & Schedule</h2>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Ad Set Name</Label>
                    <Input
                      placeholder="Auto-generated if empty"
                      value={formData.adSetName}
                      onChange={(e) => updateField('adSetName', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Budget Type</Label>
                    <div className="flex gap-3">
                      {['daily', 'lifetime'].map((type) => (
                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="budgetType"
                            value={type}
                            checked={formData.budgetType === type}
                            onChange={(e) => updateField('budgetType', e.target.value)}
                            className="text-blue-500 focus:ring-blue-500"
                          />
                          <span className="text-sm text-white/70 capitalize">{type} Budget</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Budget Amount (NGN) *</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 font-medium text-sm">₦</span>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        placeholder="50000"
                        value={formData.budgetAmount}
                        onChange={(e) => updateField('budgetAmount', e.target.value)}
                        className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-white/60 text-xs">Start Date *</Label>
                      <Input
                        type="datetime-local"
                        value={formData.startDate}
                        onChange={(e) => updateField('startDate', e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-white/60 text-xs">End Date</Label>
                      <Input
                        type="datetime-local"
                        value={formData.endDate}
                        onChange={(e) => updateField('endDate', e.target.value)}
                        className="bg-white/5 border-white/10 text-white text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Bid Strategy</Label>
                    <Select value={formData.bidStrategy} onValueChange={(v) => updateField('bidStrategy', v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        <SelectItem value="LOWEST_COST_WITHOUT_CAP" className="text-white hover:bg-white/10">Lowest Cost</SelectItem>
                        <SelectItem value="LOWEST_COST_WITH_BID_CAP" className="text-white hover:bg-white/10">Lowest Cost with Cap</SelectItem>
                        <SelectItem value="COST_CAP" className="text-white hover:bg-white/10">Cost Cap</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Creative Section */}
              {activeSection === 'creative' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="font-semibold text-white">Ad Creative</h2>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Ad Image *</Label>
                    {!formData.imagePreview ? (
                      <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-purple-500/50 hover:bg-purple-500/5 transition-all">
                        <Upload className="h-8 w-8 text-white/40 mb-2" />
                        <span className="text-sm font-medium text-white/60">Click to upload</span>
                        <span className="text-xs text-white/40 mt-1">PNG, JPG up to 30MB</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/png,image/jpeg,image/jpg"
                          onChange={handleImageUpload}
                        />
                      </label>
                    ) : (
                      <div className="relative">
                        <img src={formData.imagePreview} alt="Ad preview" className="w-full h-36 object-cover rounded-xl border border-white/10" />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7"
                          onClick={removeImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Primary Text *</Label>
                    <Textarea
                      placeholder="Main message of your ad..."
                      value={formData.primaryText}
                      onChange={(e) => updateField('primaryText', e.target.value)}
                      rows={2}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                    />
                    <p className="text-xs text-white/40">{formData.primaryText.length}/125 recommended</p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Headline *</Label>
                    <Input
                      placeholder="Attention-grabbing headline"
                      value={formData.headline}
                      onChange={(e) => updateField('headline', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Description</Label>
                    <Input
                      placeholder="Additional details"
                      value={formData.description}
                      onChange={(e) => updateField('description', e.target.value)}
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Destination URL *</Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type="url"
                        placeholder="https://yourwebsite.com"
                        value={formData.destinationUrl}
                        onChange={(e) => updateField('destinationUrl', e.target.value)}
                        className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/30"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Call to Action</Label>
                    <Select value={formData.ctaType} onValueChange={(v) => updateField('ctaType', v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        {CTA_TYPES.map((cta) => (
                          <SelectItem key={cta.value} value={cta.value} className="text-white hover:bg-white/10">
                            {cta.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* Settings Section */}
              {activeSection === 'settings' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                      <Settings className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="font-semibold text-white">Platform Settings</h2>
                  </div>

                  {/* Platform Toggles */}
                  <div className="space-y-3">
                    <Label className="text-white/80 text-sm font-medium">Enable Platforms</Label>
                    <p className="text-xs text-white/50 -mt-1">Choose which platforms to publish your campaigns to</p>
                    
                    <div className="space-y-2">
                      {AD_PLATFORMS.map((platform) => {
                        const isEnabled = platformSettings[platform.id]?.enabled;
                        const isConnected = platform.id === 'meta' ? isMetaConnected : platformSettings[platform.id]?.connected;
                        
                        return (
                          <div 
                            key={platform.id}
                            className={`p-3 rounded-xl border transition-all ${
                              isEnabled 
                                ? `bg-gradient-to-r ${platform.bgColor} ${platform.borderColor}` 
                                : 'bg-white/5 border-white/10'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <img 
                                  src={platform.icon} 
                                  alt={platform.name}
                                  className="w-10 h-10 rounded-lg"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">{platform.name}</span>
                                    {isConnected && (
                                      <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 text-xs">
                                        Connected
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-white/50">{platform.description}</span>
                                </div>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() => togglePlatformEnabled(platform.id)}
                                className="data-[state=checked]:bg-blue-600"
                              />
                            </div>
                            
                            {/* Account Connection */}
                            {isEnabled && (
                              <div className="mt-3 pt-3 border-t border-white/10">
                                {isConnected ? (
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      {platform.id === 'meta' && connectedAccount ? (
                                        <>
                                          <img 
                                            src={connectedAccount.profilePicture}
                                            alt="Profile"
                                            className="w-6 h-6 rounded-full"
                                          />
                                          <span className="text-sm text-white/70">{connectedAccount.name}</span>
                                        </>
                                      ) : (
                                        <span className="text-sm text-white/70">Account linked</span>
                                      )}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => platform.id === 'meta' ? handleDisconnectMeta() : null}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-xs"
                                    >
                                      <Unlink className="h-3 w-3 mr-1" />
                                      Disconnect
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => connectPlatformAccount(platform.id)}
                                    className="w-full border-white/20 text-white/70 hover:bg-white/10 hover:text-white text-xs"
                                  >
                                    <LinkIcon className="h-3 w-3 mr-2" />
                                    Connect {platform.name} Account
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Sync Settings */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mt-6">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-blue-400 mt-0.5" />
                      <div>
                        <h3 className="text-sm font-semibold text-blue-300">Cross-Platform Sync</h3>
                        <p className="text-xs text-blue-200/60 mt-1">
                          Campaign data you enter will automatically sync across all enabled platforms. 
                          Each platform may have slight variations in how the ad appears based on their specifications.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* API Status */}
                  <div className="space-y-2 mt-4">
                    <Label className="text-white/80 text-sm font-medium">API Integration Status</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {AD_PLATFORMS.map((platform) => (
                        <div 
                          key={platform.id}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 flex items-center gap-2"
                        >
                          <div className={`w-2 h-2 rounded-full ${
                            platform.id === 'meta' ? 'bg-green-400' : 'bg-yellow-400'
                          }`} />
                          <span className="text-xs text-white/60">{platform.name}</span>
                          <span className={`text-xs ml-auto ${
                            platform.id === 'meta' ? 'text-green-400' : 'text-yellow-400'
                          }`}>
                            {platform.id === 'meta' ? 'Live' : 'Coming Soon'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-white/10 p-4 bg-black/30">
              <div className="flex items-center justify-between gap-3">
                <Button variant="outline" onClick={() => navigate('/admin')} className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white">
                  Cancel
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={resetForm} className="border-white/20 text-white/70 hover:bg-white/10 hover:text-white">
                    Reset
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30 min-w-[120px]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Meta Login Modal */}
      {showMetaLoginModal && !isMetaConnected && activePlatform === 'meta' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-white/10 relative">
            {/* Close Button */}
            <button
              onClick={() => setShowMetaLoginModal(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>
            
            {/* Header */}
            <div className="relative p-6 pb-4">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-purple-600/20" />
              <div className="relative flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/30">
                  <Globe className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Connect to Meta</h2>
                <p className="text-white/60 text-sm mt-2">
                  Sign in to access your ad accounts, pages, and campaign data
                </p>
              </div>
            </div>

            {/* Login Options */}
            <div className="p-6 pt-2 space-y-3">
              {/* Facebook Login Button */}
              <button
                onClick={() => handleMetaLogin('facebook')}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-[#1877F2] hover:bg-[#166FE5] text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
              >
                {isConnecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                )}
                {isConnecting ? 'Connecting...' : 'Continue with Facebook'}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-white/40 text-xs uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Meta Business Suite Button */}
              <button
                onClick={() => handleMetaLogin('business_suite')}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
              >
                {isConnecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Building2 className="h-5 w-5" />
                )}
                {isConnecting ? 'Connecting...' : 'Meta Business Suite'}
              </button>

              {/* Ads Manager Button */}
              <button
                onClick={() => handleMetaLogin('ads_manager')}
                disabled={isConnecting}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <BarChart3 className="h-5 w-5" />
                )}
                {isConnecting ? 'Connecting...' : 'Meta Ads Manager'}
              </button>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-white/60 leading-relaxed">
                      By connecting, you authorize AdGlobe to access your Meta ad accounts, pages, and campaign data. 
                      You can disconnect anytime from settings.
                    </p>
                  </div>
                </div>
              </div>

              {/* Permissions Badge */}
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-300 text-xs border border-blue-500/20">
                  Pages Access
                </span>
                <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-300 text-xs border border-green-500/20">
                  Ads Management
                </span>
                <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-300 text-xs border border-purple-500/20">
                  Business Data
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-white/10">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Campaign Created Successfully!</h2>
                  <p className="text-green-100 text-sm">Ready for Meta Ads submission</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-white/60 uppercase tracking-wide mb-2">Campaign Summary</h3>
                  <Card className="bg-white/5 border-white/10">
                    <CardContent className="pt-4 space-y-2 text-white">
                      <div className="flex justify-between">
                        <span className="text-white/60">Campaign Name:</span>
                        <span className="font-medium">{submittedData?.campaign?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Objective:</span>
                        <span className="font-medium">{submittedData?.campaign?.objective?.replace('OUTCOME_', '')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Budget:</span>
                        <span className="font-medium">
                          ₦{(formData.budgetType === 'daily' ? submittedData?.adSet?.daily_budget : submittedData?.adSet?.lifetime_budget) / 100}
                          {formData.budgetType === 'daily' ? '/day' : ' total'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Location:</span>
                        <span className="font-medium">{formData.locationName || 'Custom Location'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Radius:</span>
                        <span className="font-medium">{formData.radius?.toFixed(1)} km</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Post Up Summary - Conditionally hidden for Meta App Review */}
                {SHOW_POST_UP_FEATURE && submittedData?.postUp?.enabled && (
                  <div>
                    <h3 className="font-semibold text-sm text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                      <Share2 className="h-4 w-4" />
                      Post Up - Influencer Amplification
                    </h3>
                    <Card className="bg-purple-500/10 border-purple-500/30">
                      <CardContent className="pt-4 space-y-3 text-white">
                        <div>
                          <span className="text-white/60 text-sm">Selected Influencers:</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {submittedData.postUp.influencers.map((inf, idx) => (
                              <span key={idx} className="px-3 py-1.5 rounded-full bg-purple-500/20 text-purple-200 text-sm font-medium flex items-center gap-2">
                                <Users className="h-3 w-3" />
                                {inf.name}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="pt-2 border-t border-purple-500/20">
                          <span className="text-white/60 text-sm">Content URL:</span>
                          <a 
                            href={submittedData.postUp.contentUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block mt-1 text-purple-300 hover:text-purple-200 text-sm truncate"
                          >
                            {submittedData.postUp.contentUrl}
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold text-sm text-white/60 uppercase tracking-wide mb-2">API Payload</h3>
                  <pre className="bg-black/30 rounded-lg p-4 text-xs overflow-x-auto font-mono text-green-400 border border-white/10">
                    {JSON.stringify(submittedData, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 p-4 flex justify-end gap-3 bg-black/20">
              <Button variant="outline" onClick={resetForm} className="border-white/20 text-white hover:bg-white/10">
                Create Another
              </Button>
              <Button onClick={() => { setShowSuccessModal(false); navigate('/admin'); }} className="bg-gradient-to-r from-blue-600 to-indigo-600">
                Back to Admin
              </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 5px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
          background-clip: padding-box;
        }
      `}</style>
    </div>
  );
}
