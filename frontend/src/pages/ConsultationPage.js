import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { 
  CheckCircle, 
  Users, 
  Target, 
  TrendingUp, 
  MessageSquare, 
  Building2, 
  Video, 
  Clock,
  Lightbulb,
  BarChart3,
  Zap,
  ArrowRight,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Loader2,
  CreditCard,
  Banknote,
  PartyPopper,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

const CONSULTATION_PACKAGES = [
  {
    id: 'physical',
    title: 'In-Office Consultation',
    subtitle: 'Face-to-face meeting with our experts',
    icon: Building2,
    price: 25000,
    duration: '1-2 Hours',
    color: 'bg-primary',
    features: [
      'One-on-one session with senior strategist',
      'In-depth business analysis',
      'Customized advertising roadmap',
      'Budget allocation strategy',
      'Platform recommendations',
      'Printed strategy document',
      'Follow-up call within 7 days'
    ]
  },
  {
    id: 'online',
    title: 'Online Consultation',
    subtitle: 'Video call from anywhere',
    icon: Video,
    price: 15000,
    duration: '45-60 Minutes',
    color: 'bg-accent',
    features: [
      'Video call with ad strategist',
      'Business overview analysis',
      'Advertising recommendations',
      'Budget planning tips',
      'Platform suggestions',
      'Digital strategy document (PDF)',
      'Email support for 7 days'
    ]
  }
];

const INDUSTRIES = [
  'Retail & E-commerce',
  'Food & Restaurant',
  'Fashion & Beauty',
  'Real Estate',
  'Education & Training',
  'Healthcare & Pharmacy',
  'Technology & IT',
  'Agriculture',
  'Transportation & Logistics',
  'Entertainment & Events',
  'Financial Services',
  'Manufacturing',
  'Hospitality & Tourism',
  'Professional Services',
  'Other'
];

const BUDGET_RANGES = [
  { value: 'under-100k', label: 'Under ₦100,000' },
  { value: '100k-500k', label: '₦100,000 - ₦500,000' },
  { value: '500k-1m', label: '₦500,000 - ₦1,000,000' },
  { value: '1m-5m', label: '₦1,000,000 - ₦5,000,000' },
  { value: 'above-5m', label: 'Above ₦5,000,000' },
  { value: 'not-sure', label: 'Not sure yet' }
];

const BUSINESS_STAGES = [
  { value: 'idea', label: 'Just an idea' },
  { value: 'new', label: 'New business (0-1 year)' },
  { value: 'growing', label: 'Growing business (1-3 years)' },
  { value: 'established', label: 'Established business (3+ years)' },
  { value: 'expanding', label: 'Expanding to new markets' }
];

export const ConsultationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showCashConfirmModal, setShowCashConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isInitializingPayment, setIsInitializingPayment] = useState(false);
  const [consultationId, setConsultationId] = useState(null);
  const [formData, setFormData] = useState({
    businessName: '',
    industry: '',
    businessStage: '',
    description: '',
    goals: '',
    budget: '',
    preferredDate: '',
    preferredTime: '',
    contactName: user?.name || '',
    contactEmail: user?.email || '',
    contactPhone: '',
  });

  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    setShowForm(true);
    // Scroll to form
    setTimeout(() => {
      document.getElementById('consultation-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please sign in to book a consultation');
      navigate('/login');
      return;
    }

    // Validate required fields
    if (!formData.businessName || !formData.industry || !formData.description || !formData.contactPhone) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await api.post('/consultations', {
        user_id: user.id,
        consultation_type: selectedPackage.id,
        package_title: selectedPackage.title,
        price: selectedPackage.price,
        business_name: formData.businessName,
        industry: formData.industry,
        business_stage: formData.businessStage,
        description: formData.description,
        goals: formData.goals,
        budget_range: formData.budget,
        preferred_date: formData.preferredDate,
        preferred_time: formData.preferredTime,
        contact_name: formData.contactName,
        contact_email: formData.contactEmail,
        contact_phone: formData.contactPhone,
      });

      // Store consultation ID and show payment method modal
      setConsultationId(response.data.consultation.id);
      setShowPaymentMethodModal(true);
    } catch (error) {
      console.error('Consultation submission error:', error);
      toast.error('Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOnlinePayment = async () => {
    setShowPaymentMethodModal(false);
    setIsInitializingPayment(true);
    
    try {
      const callbackUrl = `${window.location.origin}/payment/callback?type=consultation&id=${consultationId}`;
      
      const response = await api.post('/payments/initialize', {
        order_id: consultationId,
        email: user.email,
        amount: selectedPackage.price,
        callback_url: callbackUrl,
        metadata: {
          type: 'consultation',
          consultation_id: consultationId,
          package_title: selectedPackage.title
        }
      });

      if (response.data.status === 'success') {
        // Redirect to Paystack payment page
        window.location.href = response.data.authorization_url;
      } else {
        toast.error('Failed to initialize payment. Please try again.');
        setIsInitializingPayment(false);
        setShowPaymentMethodModal(true);
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      toast.error('Failed to initialize payment. Please try again.');
      setIsInitializingPayment(false);
      setShowPaymentMethodModal(true);
    }
  };

  const handleSelectCashPayment = () => {
    setShowPaymentMethodModal(false);
    setShowCashConfirmModal(true);
  };

  const handleConfirmCashPayment = async () => {
    try {
      // Update consultation status to pending cash payment
      await api.patch(`/consultations/${consultationId}/payment`, {
        payment_status: 'pending_cash',
        payment_method: 'cash'
      });
      
      setShowCashConfirmModal(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Cash payment confirmation error:', error);
      // Still show success since consultation is created
      setShowCashConfirmModal(false);
      setShowSuccessModal(true);
    }
  };

  const handleCloseSuccess = () => {
    setShowSuccessModal(false);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background" data-testid="consultation-page">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-white py-12 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50"></div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="bg-accent text-white mb-4 sm:mb-6 text-xs sm:text-sm px-3 sm:px-4 py-1">
              <Lightbulb className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Expert Advertising Guidance
            </Badge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
              Not Sure Where to Start?
            </h1>
            <p className="text-base sm:text-lg lg:text-xl text-white/90 mb-6 sm:mb-8 leading-relaxed">
              Let our expert team help you create a winning advertising strategy. 
              Whether you're a new startup or an established business, we'll guide you 
              to the right platforms and packages for your budget.
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
              <div className="flex items-center space-x-2 bg-white/10 rounded-full px-3 sm:px-4 py-2">
                <Users className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                <span className="text-xs sm:text-sm">500+ Businesses Helped</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 rounded-full px-3 sm:px-4 py-2">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                <span className="text-xs sm:text-sm">Tailored Strategies</span>
              </div>
              <div className="flex items-center space-x-2 bg-white/10 rounded-full px-3 sm:px-4 py-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                <span className="text-xs sm:text-sm">Proven Results</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-3">How It Works</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Simple steps to get expert advertising guidance</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[
              { icon: MessageSquare, title: 'Tell Us About Your Business', desc: 'Share your business details, goals, and budget' },
              { icon: Calendar, title: 'Book a Session', desc: 'Choose in-office or online consultation' },
              { icon: Users, title: 'Meet Our Experts', desc: 'Get personalized advice from our strategists' },
              { icon: Zap, title: 'Get Your Strategy', desc: 'Receive a custom advertising plan' }
            ].map((step, idx) => (
              <div key={idx} className="relative">
                <Card className="border-2 h-full hover:shadow-lg transition-shadow">
                  <CardContent className="p-4 sm:p-6 text-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <step.icon className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
                    </div>
                    <div className="absolute -top-3 left-4 sm:left-6 bg-accent text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                      {idx + 1}
                    </div>
                    <h3 className="font-bold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">{step.title}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{step.desc}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Consultation Packages */}
      <section className="py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-3">Choose Your Consultation Type</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Select the option that works best for you</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {CONSULTATION_PACKAGES.map((pkg) => (
              <Card 
                key={pkg.id}
                className={`border-2 hover:shadow-xl transition-all cursor-pointer ${
                  selectedPackage?.id === pkg.id ? 'ring-2 ring-accent border-accent' : ''
                }`}
                onClick={() => handlePackageSelect(pkg)}
                data-testid={`consultation-${pkg.id}`}
              >
                <CardContent className="p-0">
                  <div className={`${pkg.color} text-white p-4 sm:p-6`}>
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <div className="bg-white/20 rounded-full p-2 sm:p-3">
                        <pkg.icon className="h-6 w-6 sm:h-8 sm:w-8" />
                      </div>
                      <Badge className="bg-white/20 text-white border-0 text-xs sm:text-sm">
                        <Clock className="h-3 w-3 mr-1" />
                        {pkg.duration}
                      </Badge>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold mb-1">{pkg.title}</h3>
                    <p className="text-white/80 text-xs sm:text-sm">{pkg.subtitle}</p>
                  </div>

                  <div className="p-4 sm:p-6">
                    <div className="mb-4 sm:mb-6">
                      <p className="text-2xl sm:text-3xl font-bold text-foreground">{formatPrice(pkg.price)}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">One-time consultation fee</p>
                    </div>

                    <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                      {pkg.features.map((feature, idx) => (
                        <div key={idx} className="flex items-start space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs sm:text-sm text-muted-foreground">{feature}</p>
                        </div>
                      ))}
                    </div>

                    <Button 
                      className={`w-full ${pkg.id === 'physical' ? 'bg-primary hover:bg-primary/90' : 'bg-accent hover:bg-accent/90'} text-white font-semibold h-10 sm:h-12 text-sm sm:text-base`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePackageSelect(pkg);
                      }}
                    >
                      {selectedPackage?.id === pkg.id ? 'Selected' : 'Select This Option'}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Consultation Form */}
      {showForm && selectedPackage && (
        <section id="consultation-form" className="py-12 sm:py-16 bg-muted/30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="border-2">
              <CardContent className="p-4 sm:p-8">
                <div className="text-center mb-6 sm:mb-8">
                  <Badge className={`${selectedPackage.id === 'physical' ? 'bg-primary' : 'bg-accent'} text-white mb-3 sm:mb-4`}>
                    {selectedPackage.title}
                  </Badge>
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">Tell Us About Your Business</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">Fill in the details below so we can prepare for your consultation</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                  {/* Business Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground flex items-center text-sm sm:text-base">
                      <Building2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent" />
                      Business Information
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="businessName" className="text-xs sm:text-sm">Business Name *</Label>
                        <Input
                          id="businessName"
                          placeholder="Your business name"
                          value={formData.businessName}
                          onChange={(e) => handleInputChange('businessName', e.target.value)}
                          required
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="industry" className="text-xs sm:text-sm">Industry *</Label>
                        <Select value={formData.industry} onValueChange={(v) => handleInputChange('industry', v)}>
                          <SelectTrigger className="mt-1 text-sm">
                            <SelectValue placeholder="Select industry" />
                          </SelectTrigger>
                          <SelectContent>
                            {INDUSTRIES.map((ind) => (
                              <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="businessStage" className="text-xs sm:text-sm">Business Stage</Label>
                      <Select value={formData.businessStage} onValueChange={(v) => handleInputChange('businessStage', v)}>
                        <SelectTrigger className="mt-1 text-sm">
                          <SelectValue placeholder="Select business stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUSINESS_STAGES.map((stage) => (
                            <SelectItem key={stage.value} value={stage.value}>{stage.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-xs sm:text-sm">What does your business do? *</Label>
                      <Textarea
                        id="description"
                        placeholder="Briefly describe your products or services..."
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        required
                        className="mt-1 min-h-[80px] sm:min-h-[100px] text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="goals" className="text-xs sm:text-sm">What are your advertising goals?</Label>
                      <Textarea
                        id="goals"
                        placeholder="E.g., increase brand awareness, drive sales, reach new customers..."
                        value={formData.goals}
                        onChange={(e) => handleInputChange('goals', e.target.value)}
                        className="mt-1 min-h-[60px] sm:min-h-[80px] text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="budget" className="text-xs sm:text-sm">Monthly Advertising Budget</Label>
                      <Select value={formData.budget} onValueChange={(v) => handleInputChange('budget', v)}>
                        <SelectTrigger className="mt-1 text-sm">
                          <SelectValue placeholder="Select budget range" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUDGET_RANGES.map((range) => (
                            <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Preferred Schedule */}
                  {selectedPackage.id === 'physical' && (
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="font-semibold text-foreground flex items-center text-sm sm:text-base">
                        <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent" />
                        Preferred Schedule
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="preferredDate" className="text-xs sm:text-sm">Preferred Date</Label>
                          <Input
                            id="preferredDate"
                            type="date"
                            value={formData.preferredDate}
                            onChange={(e) => handleInputChange('preferredDate', e.target.value)}
                            className="mt-1 text-sm"
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div>
                          <Label htmlFor="preferredTime" className="text-xs sm:text-sm">Preferred Time</Label>
                          <Select value={formData.preferredTime} onValueChange={(v) => handleInputChange('preferredTime', v)}>
                            <SelectTrigger className="mt-1 text-sm">
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                              <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                              <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                              <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                              <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                              <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                              <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                        <div className="flex items-start space-x-2">
                          <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-accent mt-0.5" />
                          <div>
                            <p className="font-medium text-foreground text-xs sm:text-sm">Office Location</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">No 671, Zoo Road, Inec Street, Kano</p>
                            <p className="text-xs text-muted-foreground mt-1">Monday - Saturday: 9:00 AM - 5:00 PM</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preferred Schedule for Online Consultation */}
                  {selectedPackage.id === 'online' && (
                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="font-semibold text-foreground flex items-center text-sm sm:text-base">
                        <Video className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent" />
                        Preferred Schedule for Video Call
                      </h3>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="preferredDateOnline" className="text-xs sm:text-sm">Preferred Date</Label>
                          <Input
                            id="preferredDateOnline"
                            type="date"
                            value={formData.preferredDate}
                            onChange={(e) => handleInputChange('preferredDate', e.target.value)}
                            className="mt-1 text-sm"
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div>
                          <Label htmlFor="preferredTimeOnline" className="text-xs sm:text-sm">Preferred Time</Label>
                          <Select value={formData.preferredTime} onValueChange={(v) => handleInputChange('preferredTime', v)}>
                            <SelectTrigger className="mt-1 text-sm">
                              <SelectValue placeholder="Select time" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="9:00 AM">9:00 AM</SelectItem>
                              <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                              <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                              <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                              <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                              <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                              <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                              <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                        <div className="flex items-start space-x-2">
                          <Video className="h-4 w-4 sm:h-5 sm:w-5 text-accent mt-0.5" />
                          <div>
                            <p className="font-medium text-foreground text-xs sm:text-sm">Video Call Details</p>
                            <p className="text-xs sm:text-sm text-muted-foreground">A meeting link will be sent to your email once your booking is confirmed.</p>
                            <p className="text-xs text-muted-foreground mt-1">Available Monday - Saturday: 9:00 AM - 5:00 PM</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Contact Information */}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-semibold text-foreground flex items-center text-sm sm:text-base">
                      <Phone className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-accent" />
                      Contact Information
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contactName" className="text-xs sm:text-sm">Your Name *</Label>
                        <Input
                          id="contactName"
                          placeholder="Full name"
                          value={formData.contactName}
                          onChange={(e) => handleInputChange('contactName', e.target.value)}
                          required
                          className="mt-1 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contactPhone" className="text-xs sm:text-sm">Phone Number *</Label>
                        <Input
                          id="contactPhone"
                          type="tel"
                          placeholder="+234 800 000 0000"
                          value={formData.contactPhone}
                          onChange={(e) => handleInputChange('contactPhone', e.target.value)}
                          required
                          className="mt-1 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="contactEmail" className="text-xs sm:text-sm">Email Address</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="you@example.com"
                        value={formData.contactEmail}
                        onChange={(e) => handleInputChange('contactEmail', e.target.value)}
                        className="mt-1 text-sm"
                      />
                    </div>
                  </div>

                  {/* Summary & Submit */}
                  <div className="pt-4 border-t">
                    <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg p-4 mb-4 sm:mb-6">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Consultation Fee</p>
                          <p className="text-xl sm:text-2xl font-bold text-foreground">{formatPrice(selectedPackage.price)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs sm:text-sm text-muted-foreground">Type</p>
                          <p className="font-semibold text-foreground text-sm sm:text-base">{selectedPackage.title}</p>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-accent hover:bg-accent/90 text-white font-semibold h-11 sm:h-12 text-sm sm:text-base"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Book Consultation
                          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
                        </>
                      )}
                    </Button>

                    <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-3 sm:mt-4">
                      Our team will contact you within 24 hours to confirm your consultation.
                      Payment will be collected at the time of consultation.
                    </p>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Why Choose Our Consultation */}
      <section className="py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 sm:mb-3">Why Get Expert Consultation?</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Save time and money with professional guidance</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: Target, title: 'Targeted Strategy', desc: 'Get recommendations tailored to your specific business and audience' },
              { icon: BarChart3, title: 'Budget Optimization', desc: 'Learn how to maximize ROI within your advertising budget' },
              { icon: Lightbulb, title: 'Expert Insights', desc: 'Benefit from years of advertising experience in Northern Nigeria' },
              { icon: TrendingUp, title: 'Measurable Goals', desc: 'Set realistic KPIs and learn how to track your success' },
              { icon: Zap, title: 'Quick Implementation', desc: 'Get actionable steps you can start implementing immediately' },
              { icon: Users, title: 'Ongoing Support', desc: 'Receive follow-up support to ensure your success' }
            ].map((item, idx) => (
              <Card key={idx} className="border-2 hover:shadow-lg transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-accent/10 rounded-full flex items-center justify-center mb-3 sm:mb-4">
                    <item.icon className="h-5 w-5 sm:h-6 sm:w-6 text-accent" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 bg-gradient-to-br from-accent/10 to-primary/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3 sm:mb-4">Ready to Grow Your Business?</h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
            Don't waste money on ineffective advertising. Let our experts create a strategy that works for you.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Button
              onClick={() => {
                handlePackageSelect(CONSULTATION_PACKAGES[0]);
              }}
              className="bg-primary hover:bg-primary/90 text-white font-semibold h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base"
            >
              <Building2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Book Office Visit
            </Button>
            <Button
              onClick={() => {
                handlePackageSelect(CONSULTATION_PACKAGES[1]);
              }}
              variant="outline"
              className="border-2 border-accent text-accent hover:bg-accent/5 font-semibold h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base"
            >
              <Video className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
              Book Online Session
            </Button>
          </div>
        </div>
      </section>

      {/* Payment Method Selection Modal */}
      <Dialog open={showPaymentMethodModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md max-w-[92vw] mx-auto p-4 sm:p-6" hideClose>
          <div className="text-center py-2 sm:py-4 space-y-4 sm:space-y-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
              <CreditCard className="h-6 w-6 sm:h-8 sm:w-8 text-accent" />
            </div>
            
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1 sm:mb-2">Choose Payment Method</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">How would you like to pay for your consultation?</p>
            </div>

            <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">{selectedPackage?.title}</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{selectedPackage && formatPrice(selectedPackage.price)}</p>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <Button
                onClick={handleSelectOnlinePayment}
                disabled={isInitializingPayment}
                className="w-full bg-accent hover:bg-accent/90 text-white font-semibold h-11 sm:h-12 text-sm sm:text-base"
                data-testid="pay-online-btn"
              >
                {isInitializingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 mr-2 animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Pay Online (Paystack)
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleSelectCashPayment}
                variant="outline"
                className="w-full border-2 font-semibold h-11 sm:h-12 text-sm sm:text-base"
                data-testid="pay-cash-btn"
              >
                <Banknote className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Pay Cash at Office
              </Button>
            </div>

            <Button
              onClick={() => setShowPaymentMethodModal(false)}
              variant="ghost"
              className="text-muted-foreground text-xs sm:text-sm"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Confirmation Modal */}
      <Dialog open={showCashConfirmModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md max-w-[92vw] mx-auto p-4 sm:p-6" hideClose>
          <div className="text-center py-2 sm:py-4 space-y-4 sm:space-y-6">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            </div>
            
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1 sm:mb-2">Pay at Our Office</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Please visit our office to complete your payment</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 sm:p-4 text-left">
              <div className="flex items-start space-x-3">
                <MapPin className="h-5 w-5 text-accent mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-foreground text-sm sm:text-base">Lightban Technology</p>
                  <p className="text-xs sm:text-sm text-muted-foreground">No 671, Zoo Road, Inec Street, Kano</p>
                  <p className="text-xs text-muted-foreground mt-1">Monday - Saturday: 9:00 AM - 5:00 PM</p>
                </div>
              </div>
            </div>

            <div className="bg-accent/10 rounded-lg p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground mb-1">Amount to Pay</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{selectedPackage && formatPrice(selectedPackage.price)}</p>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <Button
                onClick={handleConfirmCashPayment}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold h-11 sm:h-12 text-sm sm:text-base"
                data-testid="confirm-cash-btn"
              >
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                Confirm Booking
              </Button>
              
              <Button
                onClick={() => {
                  setShowCashConfirmModal(false);
                  setShowPaymentMethodModal(true);
                }}
                variant="ghost"
                className="text-muted-foreground text-xs sm:text-sm"
              >
                Back to Payment Options
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Confirmation Modal */}
      <Dialog open={showSuccessModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md max-w-[92vw] mx-auto p-4 sm:p-6" hideClose>
          <div className="text-center py-4 sm:py-6 space-y-4 sm:space-y-6">
            <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping"></div>
              <div className="relative bg-green-500 rounded-full w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                <PartyPopper className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
              </div>
            </div>
            
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Booking Confirmed!</h3>
              <p className="text-sm sm:text-base text-muted-foreground">Your consultation has been successfully booked</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-accent/5 rounded-lg p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Consultation Type</span>
                <span className="font-semibold text-foreground">{selectedPackage?.title}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Business</span>
                <span className="font-semibold text-foreground">{formData.businessName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-green-600">{selectedPackage && formatPrice(selectedPackage.price)}</span>
              </div>
            </div>

            <div className="bg-accent/10 rounded-lg p-3 sm:p-4">
              <div className="flex items-center space-x-2 text-accent">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
                <p className="text-xs sm:text-sm font-medium">Our team will contact you within 24 hours to confirm your consultation schedule.</p>
              </div>
            </div>

            <Button
              onClick={handleCloseSuccess}
              className="w-full bg-accent hover:bg-accent/90 text-white font-semibold h-11 sm:h-12 text-sm sm:text-base"
              data-testid="close-success-btn"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loading Overlay for Payment Initialization */}
      {isInitializingPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 sm:p-8 text-center space-y-4">
            <Loader2 className="h-10 w-10 sm:h-12 sm:w-12 text-accent animate-spin mx-auto" />
            <p className="text-sm sm:text-base font-medium text-foreground">Redirecting to payment...</p>
          </div>
        </div>
      )}
    </div>
  );
};
