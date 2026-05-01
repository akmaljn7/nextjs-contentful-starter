import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  Globe, 
  Target, 
  DollarSign, 
  Image as ImageIcon, 
  Type, 
  Link as LinkIcon,
  Calendar,
  MapPin,
  Radius,
  Upload,
  CheckCircle,
  Loader2,
  X,
  Sparkles,
  Send,
  Eye,
  Info
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

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
  const globeRef = useRef(null);
  const iframeRef = useRef(null);
  
  // Form State
  const [formData, setFormData] = useState({
    // Campaign
    campaignName: '',
    objective: '',
    specialAdCategory: 'NONE',
    
    // Ad Set
    adSetName: '',
    budgetType: 'daily',
    budgetAmount: '',
    startDate: '',
    endDate: '',
    optimizationGoal: '',
    bidStrategy: 'LOWEST_COST_WITHOUT_CAP',
    
    // Targeting (from Globe)
    latitude: null,
    longitude: null,
    radius: 1, // km
    locationName: '',
    
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
  const [activeSection, setActiveSection] = useState('campaign');
  const [globeReady, setGlobeReady] = useState(false);

  // Listen for messages from the globe iframe
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'GLOBE_LOCATION_UPDATE') {
        const { latitude, longitude, radius, locationName } = event.data;
        setFormData(prev => ({
          ...prev,
          latitude,
          longitude,
          radius: radius / 1000, // Convert metres to km
          locationName: locationName || prev.locationName,
        }));
      }
      if (event.data && event.data.type === 'GLOBE_READY') {
        setGlobeReady(true);
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
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Build the simulated payload
    const payload = {
      campaign: {
        name: formData.campaignName,
        objective: formData.objective,
        special_ad_categories: formData.specialAdCategory === 'NONE' ? [] : [formData.specialAdCategory],
        status: 'PAUSED',
      },
      adSet: {
        name: formData.adSetName || `${formData.campaignName} - Ad Set`,
        [`${formData.budgetType}_budget`]: Math.round(parseFloat(formData.budgetAmount) * 100), // Convert to cents
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
    { id: 'campaign', label: 'Campaign', icon: Target },
    { id: 'targeting', label: 'Targeting', icon: MapPin },
    { id: 'budget', label: 'Budget', icon: DollarSign },
    { id: 'creative', label: 'Creative', icon: ImageIcon },
  ];

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden">
      {/* Left Sidebar - Form */}
      <div className="w-1/2 h-full flex flex-col border-r border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 backdrop-blur">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate('/admin')}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                Meta Ads Campaign
              </h1>
              <p className="text-xs text-muted-foreground">Create targeted digital advertising campaigns</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            Simulation Mode
          </Badge>
        </div>

        {/* Section Navigation */}
        <div className="flex border-b border-border px-4 py-2 gap-1 bg-muted/30">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeSection === section.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </button>
          ))}
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Campaign Section */}
          {activeSection === 'campaign' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Campaign Settings</h2>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="campaignName">Campaign Name *</Label>
                <Input
                  id="campaignName"
                  placeholder="Enter campaign name"
                  value={formData.campaignName}
                  onChange={(e) => updateField('campaignName', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Campaign Objective *</Label>
                <Select value={formData.objective} onValueChange={(v) => updateField('objective', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select objective" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_OBJECTIVES.map((obj) => (
                      <SelectItem key={obj.value} value={obj.value}>
                        <div>
                          <div className="font-medium">{obj.label}</div>
                          <div className="text-xs text-muted-foreground">{obj.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Special Ad Category</Label>
                <Select value={formData.specialAdCategory} onValueChange={(v) => updateField('specialAdCategory', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SPECIAL_AD_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div>
                          <div className="font-medium">{cat.label}</div>
                          {cat.description && <div className="text-xs text-muted-foreground">{cat.description}</div>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Required if your ad is about housing, employment, credit, or politics
                </p>
              </div>

              {formData.objective && (
                <div className="space-y-2">
                  <Label>Optimization Goal</Label>
                  <Select 
                    value={formData.optimizationGoal} 
                    onValueChange={(v) => updateField('optimizationGoal', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select optimization goal" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPTIMIZATION_GOALS[formData.objective]?.map((goal) => (
                        <SelectItem key={goal.value} value={goal.value}>
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
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Location Targeting</h2>
              </div>

              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Use the Globe</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Search for a location on the globe (right side), then use the +/- buttons to adjust the targeting radius. The coordinates will be automatically captured here.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input
                    value={formData.latitude ? formData.latitude.toFixed(6) : ''}
                    readOnly
                    placeholder="Select on globe"
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input
                    value={formData.longitude ? formData.longitude.toFixed(6) : ''}
                    readOnly
                    placeholder="Select on globe"
                    className="bg-muted/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Radius (km)</Label>
                  <Input
                    value={formData.radius ? formData.radius.toFixed(1) : ''}
                    readOnly
                    placeholder="Adjust on globe"
                    className="bg-muted/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Location Name</Label>
                  <Input
                    value={formData.locationName}
                    onChange={(e) => updateField('locationName', e.target.value)}
                    placeholder="e.g., Lagos Central"
                  />
                </div>
              </div>

              {formData.latitude && formData.longitude && (
                <Card className="border-green-500/20 bg-green-500/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Location captured!</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Targeting: {formData.radius.toFixed(1)} km radius around {formData.locationName || `${formData.latitude.toFixed(4)}, ${formData.longitude.toFixed(4)}`}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Budget Section */}
          {activeSection === 'budget' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Budget & Schedule</h2>
              </div>

              <div className="space-y-2">
                <Label>Ad Set Name</Label>
                <Input
                  placeholder="Leave empty to auto-generate"
                  value={formData.adSetName}
                  onChange={(e) => updateField('adSetName', e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label>Budget Type</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="budgetType"
                      value="daily"
                      checked={formData.budgetType === 'daily'}
                      onChange={(e) => updateField('budgetType', e.target.value)}
                      className="text-primary"
                    />
                    <span className="text-sm">Daily Budget</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="budgetType"
                      value="lifetime"
                      checked={formData.budgetType === 'lifetime'}
                      onChange={(e) => updateField('budgetType', e.target.value)}
                      className="text-primary"
                    />
                    <span className="text-sm">Lifetime Budget</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Budget Amount (USD) *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="50.00"
                    value={formData.budgetAmount}
                    onChange={(e) => updateField('budgetAmount', e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.budgetType === 'daily' ? 'Amount to spend per day' : 'Total amount to spend over campaign lifetime'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => updateField('startDate', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date {formData.budgetType === 'lifetime' ? '*' : '(Optional)'}</Label>
                  <Input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => updateField('endDate', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bid Strategy</Label>
                <Select value={formData.bidStrategy} onValueChange={(v) => updateField('bidStrategy', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOWEST_COST_WITHOUT_CAP">Lowest Cost (Recommended)</SelectItem>
                    <SelectItem value="LOWEST_COST_WITH_BID_CAP">Lowest Cost with Bid Cap</SelectItem>
                    <SelectItem value="COST_CAP">Cost Cap</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Creative Section */}
          {activeSection === 'creative' && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-lg">Ad Creative</h2>
              </div>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Ad Image *</Label>
                {!formData.imagePreview ? (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium">Click to upload image</span>
                    <span className="text-xs text-muted-foreground mt-1">PNG, JPG up to 30MB</span>
                    <span className="text-xs text-muted-foreground">Recommended: 1080×1080 or 1080×1350</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handleImageUpload}
                    />
                  </label>
                ) : (
                  <div className="relative">
                    <img 
                      src={formData.imagePreview} 
                      alt="Ad preview" 
                      className="w-full h-48 object-cover rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Primary Text *</Label>
                <Textarea
                  placeholder="The main message of your ad..."
                  value={formData.primaryText}
                  onChange={(e) => updateField('primaryText', e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">{formData.primaryText.length}/125 characters recommended</p>
              </div>

              <div className="space-y-2">
                <Label>Headline *</Label>
                <Input
                  placeholder="Attention-grabbing headline"
                  value={formData.headline}
                  onChange={(e) => updateField('headline', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">{formData.headline.length}/40 characters recommended</p>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Additional details about your ad"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Destination URL *</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={formData.destinationUrl}
                    onChange={(e) => updateField('destinationUrl', e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Call to Action</Label>
                <Select value={formData.ctaType} onValueChange={(v) => updateField('ctaType', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CTA_TYPES.map((cta) => (
                      <SelectItem key={cta.value} value={cta.value}>
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
        <div className="border-t border-border p-4 bg-card/50 backdrop-blur">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => navigate('/admin')}>
              Cancel
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetForm}>
                Reset Form
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="min-w-[140px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Campaign
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Globe */}
      <div className="w-1/2 h-full relative bg-slate-900">
        <iframe
          ref={iframeRef}
          src="/meta-ads-globe.html"
          className="w-full h-full border-0"
          title="AdGlobe 3D"
        />
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <CheckCircle className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Campaign Created Successfully!</h2>
                  <p className="text-green-100 text-sm">(Simulation Mode - No actual submission to Meta)</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Campaign Summary</h3>
                  <Card>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Campaign Name:</span>
                        <span className="font-medium">{submittedData?.campaign?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Objective:</span>
                        <span className="font-medium">{submittedData?.campaign?.objective?.replace('OUTCOME_', '')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Budget:</span>
                        <span className="font-medium">
                          ${(formData.budgetType === 'daily' ? submittedData?.adSet?.daily_budget : submittedData?.adSet?.lifetime_budget) / 100} 
                          {formData.budgetType === 'daily' ? '/day' : ' total'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Targeting</h3>
                  <Card>
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Location:</span>
                        <span className="font-medium">{formData.locationName || 'Custom Location'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Coordinates:</span>
                        <span className="font-medium font-mono text-sm">
                          {formData.latitude?.toFixed(4)}, {formData.longitude?.toFixed(4)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Radius:</span>
                        <span className="font-medium">{formData.radius?.toFixed(1)} km</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">API Payload Preview</h3>
                  <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto font-mono">
                    {JSON.stringify(submittedData, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="border-t p-4 flex justify-end gap-3">
              <Button variant="outline" onClick={resetForm}>
                Create Another
              </Button>
              <Button onClick={() => { setShowSuccessModal(false); navigate('/admin'); }}>
                Back to Admin
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
