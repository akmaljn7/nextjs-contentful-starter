import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguageStore, useAuthStore, useCartStore } from '@/lib/store';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, MapPin, Clock, Calendar, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

// LED Billboard locations with pricing
const LED_BILLBOARD_LOCATIONS = [
  {
    state: 'Jos',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 24000,
    perImpression: 93,
    city: 'Jos',
    region: 'Plateau State'
  },
  {
    state: 'Kastina',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Katsina',
    region: 'Katsina State'
  },
  {
    state: 'Minna',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Minna',
    region: 'Niger State'
  },
  {
    state: 'Ilorin',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Ilorin',
    region: 'Kwara State'
  },
  {
    state: 'Yola',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Yola',
    region: 'Adamawa State'
  },
  {
    state: 'Kano (Sabowar Kofa)',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Kano',
    region: 'Kano State - Sabowar Kofa'
  },
  {
    state: 'Kano (Airport)',
    monthly: 2283333,
    weekly: 577917,
    daily: 89565,
    hourly: 9200,
    beltBuying: 33761,
    perImpression: 116,
    city: 'Kano',
    region: 'Kano State - Airport Road'
  },
  {
    state: 'Maiduguri',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Maiduguri',
    region: 'Borno State'
  },
  {
    state: 'Kaduna',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Kaduna',
    region: 'Kaduna State'
  },
  {
    state: 'Sokoto',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Sokoto',
    region: 'Sokoto State'
  },
  {
    state: 'Makurdi',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Makurdi',
    region: 'Benue State'
  },
  {
    state: 'Owerri',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Owerri',
    region: 'Imo State'
  },
  {
    state: 'Calabar',
    monthly: 1866666,
    weekly: 489333,
    daily: 69476,
    hourly: 8000,
    beltBuying: 27000,
    perImpression: 93,
    city: 'Calabar',
    region: 'Cross River State'
  },
];

export const BillboardDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [billboard, setBillboard] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBillboard();
  }, [id]);

  const fetchBillboard = async () => {
    try {
      const response = await api.get(`/billboards/${id}`);
      setBillboard(response.data);
      // Set default location to first one
      setSelectedLocation(LED_BILLBOARD_LOCATIONS[0].state);
    } catch (error) {
      toast.error('Failed to load billboard details');
      navigate('/billboards');
    } finally {
      setLoading(false);
    }
  };

  const getLocationData = () => {
    return LED_BILLBOARD_LOCATIONS.find(loc => loc.state === selectedLocation) || LED_BILLBOARD_LOCATIONS[0];
  };

  const getPackages = () => {
    const locationData = getLocationData();
    
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
        price: locationData.beltBuying,
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
        price: locationData.perImpression,
        duration: 'Per 1,000 Impressions',
        deliverables: [
          'Cost per 1,000 views',
          'Minimum order: 200 impressions',
          'Real-time tracking',
          'Performance analytics',
          'Flexible scheduling',
          'Starting at ' + formatPrice(locationData.perImpression * 200)
        ],
      },
    ];
  };

  const handleBookPackage = (pkg) => {
    if (!user) {
      toast.error('Please sign in to book a package');
      navigate('/login');
      return;
    }

    if (!selectedLocation) {
      toast.error('Please select a location');
      return;
    }

    const locationData = getLocationData();

    addItem({
      influencerId: billboard.id,
      influencerName: `LED Billboard - ${selectedLocation}`,
      influencerHandle: locationData.region,
      influencerImage: billboard.image_url,
      packageId: `${billboard.id}-${pkg.id}`,
      packageTitle: pkg.title,
      price: pkg.price,
      deliverables: pkg.deliverables,
      turnaround: pkg.duration,
      listingType: 'billboard',
    });

    toast.success('Package added to cart!');
    navigate('/cart');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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

  return (
    <div className="min-h-screen bg-background" data-testid="billboard-detail-page">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/5 to-accent/5 py-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-accent/5 transform skew-x-12 origin-top-right"></div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Billboard Image */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-full max-w-4xl mb-6 rounded-lg overflow-hidden shadow-2xl">
              {billboard.image_url && (
                <img
                  src={billboard.image_url}
                  alt={billboard.location_name}
                  className="w-full h-auto"
                />
              )}
            </div>

            <Badge className="bg-accent text-white mb-4">{billboard.billboard_type}</Badge>
            <h1 className="text-4xl font-bold text-foreground mb-2">{billboard.location_name}</h1>
            <p className="text-muted-foreground max-w-2xl mb-6">{billboard.description}</p>

            {/* Location Selector */}
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
                  {LED_BILLBOARD_LOCATIONS.map((location) => (
                    <SelectItem key={location.state} value={location.state}>
                      {location.state} - {location.region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Location Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <MapPin className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-bold text-foreground">{locationData.city}</p>
                  <p className="text-xs text-muted-foreground">City</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-accent" />
                  <p className="text-sm font-bold text-foreground">{locationData.perImpression}</p>
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
                  <p className="text-sm font-bold text-foreground">Verified</p>
                  <p className="text-xs text-muted-foreground">Location</p>
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
              Advertising Packages for {selectedLocation}
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
                    onClick={() => handleBookPackage(pkg)}
                    className="w-full bg-accent hover:bg-accent/90 text-white font-semibold"
                    data-testid={`book-button-${pkg.id}`}
                  >
                    Add to Cart
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
