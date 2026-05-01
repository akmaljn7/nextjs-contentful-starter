import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
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
  PanelLeftClose,
  PanelLeft,
  GripVertical
} from 'lucide-react';

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
  { value: 'NONE', label: 'None' },
  { value: 'HOUSING', label: 'Housing', description: 'Real estate, rentals, mortgages' },
  { value: 'EMPLOYMENT', label: 'Employment', description: 'Job opportunities, career services' },
  { value: 'CREDIT', label: 'Credit', description: 'Credit cards, loans, financial services' },
  { value: 'ISSUES_ELECTIONS_POLITICS', label: 'Social Issues/Politics', description: 'Political ads, social issues' },
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

export default function MetaAdsGlobePage() {
  const navigate = useNavigate();
  const iframeRef = useRef(null);
  const sidebarRef = useRef(null);
  
  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(480);
  const [isDragging, setIsDragging] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    campaignName: '',
    objective: '',
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
  const [activeSection, setActiveSection] = useState('campaign');

  // Handle sidebar dragging
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const newWidth = Math.min(Math.max(380, e.clientX), 700);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Listen for messages from the globe iframe
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
    
    const payload = {
      campaign: {
        name: formData.campaignName,
        objective: formData.objective,
        special_ad_categories: formData.specialAdCategory === 'NONE' ? [] : [formData.specialAdCategory],
        status: 'PAUSED',
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
    { id: 'campaign', label: 'Campaign', icon: Target, color: 'from-blue-500 to-blue-600' },
    { id: 'targeting', label: 'Targeting', icon: MapPin, color: 'from-green-500 to-green-600' },
    { id: 'budget', label: 'Budget', icon: DollarSign, color: 'from-amber-500 to-amber-600' },
    { id: 'creative', label: 'Creative', icon: ImageIcon, color: 'from-purple-500 to-purple-600' },
  ];

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
          className="absolute top-4 left-4 z-30 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white p-3 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 flex items-center gap-2 group"
        >
          <PanelLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Open Panel</span>
        </button>
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <div 
          ref={sidebarRef}
          className="relative h-full flex flex-col z-20 shadow-2xl shadow-black/50"
          style={{ width: sidebarWidth }}
        >
          {/* Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 opacity-98" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10" />
          
          {/* Content */}
          <div className="relative flex flex-col h-full">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/10 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => navigate('/admin')}
                    className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h1 className="text-lg font-bold text-white flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Globe className="h-4 w-4 text-white" />
                      </div>
                      Meta Ads Campaign
                    </h1>
                    <p className="text-xs text-blue-200/60">Create targeted digital advertising</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  className="h-8 w-8 text-white/50 hover:text-white hover:bg-white/10"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </Button>
              </div>
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
              
              {/* Campaign Section */}
              {activeSection === 'campaign' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <Target className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="font-semibold text-white">Campaign Settings</h2>
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

                  <div className="space-y-2">
                    <Label className="text-white/80 text-sm">Special Ad Category</Label>
                    <Select value={formData.specialAdCategory} onValueChange={(v) => updateField('specialAdCategory', v)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-white/10">
                        {SPECIAL_AD_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value} className="text-white hover:bg-white/10">
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-white/40">Required for housing, employment, credit, or politics</p>
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
                      <MapPin className="h-4 w-4 text-white" />
                    </div>
                    <h2 className="font-semibold text-white">Location Targeting</h2>
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
                    <Label className="text-white/80 text-sm">Budget Amount (USD) *</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="50.00"
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

          {/* Resize Handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-ew-resize group"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute top-1/2 -translate-y-1/2 right-0 w-4 h-12 bg-white/10 rounded-l-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="h-4 w-4 text-white/50" />
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
                          ${(formData.budgetType === 'daily' ? submittedData?.adSet?.daily_budget : submittedData?.adSet?.lifetime_budget) / 100}
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
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
