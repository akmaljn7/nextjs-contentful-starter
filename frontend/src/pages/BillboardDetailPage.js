import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore, useCartStore } from '@/lib/store';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, MapPin, Clock, Calendar, TrendingUp, ShoppingCart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Default LED Billboard locations with pricing (fallback)
const DEFAULT_LED_LOCATIONS = {
  'Jos': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 24000, per_impression: 93, region: 'Plateau State' },
  'Kastina': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Katsina State' },
  'Minna': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Niger State' },
  'Ilorin': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Kwara State' },
  'Yola': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Adamawa State' },
  'Kano (Sabowar Kofa)': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Kano State - Sabowar Kofa' },
  'Kano (Airport)': { monthly: 2283333, weekly: 577917, daily: 89565, hourly: 9200, belt_buying: 33761, per_impression: 116, region: 'Kano State - Airport Road' },
  'Maiduguri': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Borno State' },
  'Kaduna': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Kaduna State' },
  'Sokoto': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Sokoto State' },
  'Makurdi': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Benue State' },
  'Owerri': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Imo State' },
  'Calabar': { monthly: 1866666, weekly: 489333, daily: 69476, hourly: 8000, belt_buying: 27000, per_impression: 93, region: 'Cross River State' },
};

export const BillboardDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [billboard, setBillboard] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [addedPackages, setAddedPackages] = useState({});
  const [locationPricing, setLocationPricing] = useState({});

  useEffect(() => {
    fetchBillboard();
  }, [id]);

  const fetchBillboard = async () => {
    try {
      const response = await api.get(`/billboards/${id}`);
      const data = response.data;
      setBillboard(data);
      
      // Use pricing_by_state from API if available, otherwise use defaults for LED billboards
      const isLED = (data.billboard_type || data.type || '').toLowerCase().includes('led');
      const pricing = data.pricing_by_state && Object.keys(data.pricing_by_state).length > 0
        ? data.pricing_by_state
        : (isLED ? DEFAULT_LED_LOCATIONS : {});
      
      setLocationPricing(pricing);
      
      // Set default location to first one
      const firstLocation = Object.keys(pricing)[0];
      if (firstLocation) {
        setSelectedLocation(firstLocation);
      }
    } catch (error) {
      toast.error('Failed to load billboard details');
      navigate('/billboards');
    } finally {
      setLoading(false);
    }
  };

  const getLocationData = () => {
    return locationPricing[selectedLocation] || Object.values(locationPricing)[0] || {};
  };

  const getPackages = () => {
    const locationData = getLocationData();
    
    if (!locationData.monthly) {
      // If no pricing data, show basic package from billboard price
      return [{
        id: 'basic',
        title: 'Billboard Advertising',
        description: 'Book this billboard for your campaign',
        price: billboard?.price_monthly || billboard?.price || 0,
        duration: 'Contact for details',
        deliverables: [
          'Billboard placement at selected location',
          'Professional installation',
          'Campaign duration as agreed',
          'Performance tracking',
        ],
      }];
    }
    
    return [
      {
        id: 'monthly',
        title: 'Monthly Package',
        description: 'Full month of LED billboard advertising with maximum exposure',
        price: locationData.monthly,
        duration: '30 Days',
        deliverables: [
          'Digital LED display for entire month',
          'Up to 200 plays per day',
          'Video content up to 15 seconds',
          'Prime time slots included',
          'Weekly performance report'
        ],
      },
      {
        id: 'weekly',
        title: 'Weekly Package',
        description: 'One week of high-impact LED billboard advertising',
        price: locationData.weekly,
        duration: '7 Days',
        deliverables: [
          'Digital LED display for 7 days',
          'Up to 200 plays per day',
          'Video content up to 15 seconds',
          'Peak hour slots',
          'Daily performance tracking'
        ],
      },
      {
        id: 'daily',
        title: 'Daily Package',
        description: 'Single day LED billboard campaign for events or flash promotions',
        price: locationData.daily,
        duration: '1 Day (24 Hours)',
        deliverables: [
          '24-hour digital display',
          'Up to 200 plays',
          'Video content up to 15 seconds',
          'Hourly rotation',
          'Same-day setup available'
        ],
      },
      {
        id: 'hourly',
        title: 'Hourly Package',
        description: 'Flexible hourly advertising for short-term campaigns',
        price: locationData.hourly,
        duration: 'Per Hour',
        deliverables: [
          '1 hour of display time',
          'Up to 10 plays per hour',
          'Video or static content',
          'Instant activation',
          'Perfect for event promotion'
        ],
      },
      {
        id: 'belt-buying',
        title: '5 Hours Belt Buying',
        description: 'Premium time slots: Morning, Afternoon, or Evening (5 hours each)',
        price: locationData.belt_buying,
        duration: '5 Hours (Select Time Belt)',
        deliverables: [
          'Morning (6 AM - 11 AM) OR',
          'Afternoon (12 PM - 5 PM) OR',
          'Evening (6 PM - 11 PM)',
          'Up to 60 plays per belt',
          'High-traffic time guaranteed',
          'Video content up to 15 seconds'
        ],
      },
      {
        id: 'per-impression',
        title: 'Per Impression (CPM)',
        description: 'Pay per thousand impressions - minimum 200 impressions',
        price: locationData.per_impression,
        duration: 'Per 1,000 Impressions',
        deliverables: [
          'Cost per 1,000 views',
          'Minimum order: 200 impressions',
          'Real-time tracking',
          'Performance analytics',
          'Flexible scheduling',
          'Starting at ' + formatPrice((locationData.per_impression || 93) * 200)
        ],
      },
    ];
  };

  const handleBookPackage = (pkg, event) => {
    if (!user) {
      toast.error('Please sign in to book a package');
      navigate('/login');
      return;
    }

    if (!selectedLocation && Object.keys(locationPricing).length > 0) {
      toast.error('Please select a location');
      return;
    }

    const locationData = getLocationData();

    // Get button position for animation
    const button = event.currentTarget;
    const buttonRect = button.getBoundingClientRect();
    
    // Get cart button position
    const cartButton = document.querySelector('[data-testid="cart-button"]');
    const cartRect = cartButton?.getBoundingClientRect();
    
    // Create flying element
    const flyingEl = document.createElement('div');
    flyingEl.className = 'fly-to-cart';
    flyingEl.innerHTML = `
      <div class="bg-accent text-white rounded-lg p-3 shadow-2xl flex items-center space-x-2">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path>
        </svg>
        <span class="font-semibold text-sm">${formatPrice(pkg.price)}</span>
      </div>
    `;
    
    // Position at button
    flyingEl.style.left = `${buttonRect.left + buttonRect.width / 2 - 60}px`;
    flyingEl.style.top = `${buttonRect.top}px`;
    
    // Calculate destination
    if (cartRect) {
      const flyX = cartRect.left - buttonRect.left;
      const flyY = cartRect.top - buttonRect.top - 100;
      flyingEl.style.setProperty('--fly-x', `${flyX}px`);
      flyingEl.style.setProperty('--fly-y', `${flyY}px`);
    }
    
    document.body.appendChild(flyingEl);
    
    // Remove after animation
    setTimeout(() => {
      flyingEl.remove();
      // Pulse the cart button
      if (cartButton) {
        cartButton.classList.add('cart-pulse');
        setTimeout(() => cartButton.classList.remove('cart-pulse'), 500);
      }
    }, 800);

    const billboardName = selectedLocation 
      ? `${billboard.billboard_type || billboard.type || 'Billboard'} - ${selectedLocation}`
      : billboard.location_name || billboard.name;

    addItem({
      influencerId: billboard.id,
      influencerName: billboardName,
      influencerHandle: locationData.region || billboard.city || billboard.location || '',
      influencerImage: billboard.image_url,
      packageId: `${billboard.id}-${pkg.id}`,
      packageTitle: pkg.title,
      price: pkg.price,
      deliverables: pkg.deliverables,
      turnaround: pkg.duration,
      listingType: 'billboard',
    });

    // Mark package as added
    setAddedPackages(prev => ({ ...prev, [pkg.id]: true }));
    
    // Show success toast
    toast.success(
      <div className="flex items-center space-x-2">
        <CheckCircle className="h-5 w-5 text-green-500" />
        <span>Added to cart! Continue exploring or checkout.</span>
      </div>
    );
    
    // Reset the added state after 3 seconds
    setTimeout(() => {
      setAddedPackages(prev => ({ ...prev, [pkg.id]: false }));
    }, 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!billboard) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Billboard not found</p>
      </div>
    );
  }

  const packages = getPackages();
  const locationData = getLocationData();
  const hasMultipleLocations = Object.keys(locationPricing).length > 1;

  return (
    <div className="min-h-screen bg-background" data-testid="billboard-detail-page">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/5 to-accent/5 py-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-accent/5 transform skew-x-12 origin-top-right"></div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Billboard Image */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-full max-w-3xl mb-6 rounded-lg overflow-hidden shadow-2xl">
              {billboard.image_url && (
                <img
                  src={billboard.image_url}
                  alt={billboard.location_name || billboard.name}
                  className="w-full h-64 object-cover"
                />
              )}
            </div>

            <Badge className="bg-accent text-white mb-4">{billboard.billboard_type || billboard.type}</Badge>
            <h1 className="text-4xl font-bold text-foreground mb-2">{billboard.location_name || billboard.name}</h1>
            <p className="text-muted-foreground max-w-2xl mb-6">{billboard.description}</p>

            {/* Location Selector - only show if multiple locations */}
            {hasMultipleLocations && (
              <div className="w-full max-w-md mb-6">
                <label className="block text-sm font-semibold text-foreground mb-2">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Select Location/State
                </label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-full h-12 text-lg border-2" data-testid="location-selector">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(locationPricing).map(([state, data]) => (
                      <SelectItem key={state} value={state}>
                        {state} - {data.region || state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Location Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <MapPin className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-bold text-foreground">{selectedLocation || billboard.city || 'Multiple'}</p>
                  <p className="text-xs text-muted-foreground">Location</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-accent" />
                  <p className="text-sm font-bold text-foreground">{locationData.per_impression || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground">Per 1K Views</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-sm font-bold text-foreground">24/7</p>
                  <p className="text-xs text-muted-foreground">Availability</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-bold text-foreground">{billboard.verified ? 'Verified' : 'Available'}</p>
                  <p className="text-xs text-muted-foreground">Status</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Advertising Packages {selectedLocation ? `for ${selectedLocation}` : ''}
            </h2>
            <p className="text-lg text-muted-foreground">Choose the perfect duration for your campaign</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className="border-2 hover:shadow-xl hover:-translate-y-1 transition-all"
                data-testid={`package-${pkg.id}`}
              >
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-foreground mb-2">{pkg.title}</h3>
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-3xl font-bold text-primary">{formatPrice(pkg.price)}</p>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {pkg.duration}
                    </p>
                  </div>

                  <div className="mb-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Deliverables:</p>
                    {pkg.deliverables.map((item, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={(e) => handleBookPackage(pkg, e)}
                    className={`w-full font-semibold transition-all ${
                      addedPackages[pkg.id] 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-accent hover:bg-accent/90 text-white'
                    }`}
                    data-testid={`book-button-${pkg.id}`}
                  >
                    {addedPackages[pkg.id] ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Added to Cart
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Add to Cart
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
