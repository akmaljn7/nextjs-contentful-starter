import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore, useCartStore } from '@/lib/store';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, TrendingUp, Users, Target, BarChart3, ShoppingCart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Platform colors and stats (fallback)
const PLATFORM_METADATA = {
  facebook: { color: '#1877F2', monthly_users: '2.9 Billion', avg_cpc: '₦50-₦200', avg_cpm: '₦500-₦2,000', engagement_rate: '0.5-1.5%' },
  instagram: { color: '#E4405F', monthly_users: '2 Billion', avg_cpc: '₦60-₦250', avg_cpm: '₦800-₦2,500', engagement_rate: '1.5-3%' },
  tiktok: { color: '#000000', monthly_users: '1.5 Billion', avg_cpc: '₦40-₦150', avg_cpm: '₦600-₦1,500', engagement_rate: '5-15%' },
  snapchat: { color: '#FFFC00', monthly_users: '750 Million', avg_cpc: '₦45-₦180', avg_cpm: '₦700-₦1,800', engagement_rate: '2-5%' },
  google: { color: '#4285F4', monthly_users: '8.5B searches/day', avg_cpc: '₦100-₦500', avg_cpm: '₦300-₦1,000', engagement_rate: '2-5% CTR' },
  whatsapp: { color: '#25D366', monthly_users: '2 Billion', avg_cpc: '₦30-₦100', avg_cpm: '₦400-₦1,200', engagement_rate: '45-60% open rate' },
};

export const DigitalAdDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [platform, setPlatform] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addedPackages, setAddedPackages] = useState({});

  useEffect(() => {
    fetchPlatform();
  }, [id]);

  const fetchPlatform = async () => {
    try {
      const response = await api.get(`/digital-ads/${id}`);
      const data = response.data;
      
      // Get metadata for this platform
      const metadata = PLATFORM_METADATA[id] || PLATFORM_METADATA.facebook;
      
      // Normalize the platform data
      const platformData = {
        id: data.id || id,
        name: data.name || data.service_name || `${id.charAt(0).toUpperCase() + id.slice(1)} Ads`,
        platform: data.platform || id,
        description: data.description || '',
        image_url: data.image_url || '',
        color: metadata.color,
        stats: data.stats || {
          monthly_users: metadata.monthly_users,
          avg_cpc: metadata.avg_cpc,
          avg_cpm: metadata.avg_cpm,
          engagement_rate: metadata.engagement_rate,
        },
        packages: data.packages || [],
      };
      
      setPlatform(platformData);
    } catch (error) {
      console.error('Failed to load platform:', error);
      toast.error('Platform not found');
      navigate('/digital-ads');
    } finally {
      setLoading(false);
    }
  };

  const handleBookPackage = (pkg, event) => {
    if (!user) {
      toast.error('Please sign in to book a package');
      navigate('/login');
      return;
    }

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

    addItem({
      influencerId: `digital-${platform.id}`,
      listingId: platform.id,  // Required for backend - the digital ad platform ID
      influencerName: platform.name,
      influencerHandle: platform.platform,
      influencerImage: platform.image_url,
      packageId: pkg.id,
      packageTitle: pkg.title,
      price: pkg.price,
      deliverables: pkg.deliverables,
      turnaround: pkg.duration,
      listingType: 'digital_ad',  // Use underscore to match backend
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

  if (!platform) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Platform not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="digital-ad-detail-page">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/5 to-accent/5 py-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-accent/5 transform skew-x-12 origin-top-right"></div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            {/* Platform Image */}
            {platform.image_url && (
              <div className="w-full max-w-3xl mb-6 rounded-lg overflow-hidden shadow-2xl">
                <img
                  src={platform.image_url}
                  alt={platform.name}
                  className="w-full h-64 object-cover"
                />
              </div>
            )}

            <Badge 
              className="text-white mb-4 text-lg px-4 py-1"
              style={{ backgroundColor: platform.color }}
            >
              {platform.platform}
            </Badge>
            <h1 className="text-4xl font-bold text-foreground mb-2">{platform.name}</h1>
            <p className="text-muted-foreground max-w-2xl mb-6">{platform.description}</p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl">
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-bold text-foreground">{platform.stats.monthly_users}</p>
                  <p className="text-xs text-muted-foreground">Monthly Users</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <Target className="h-6 w-6 mx-auto mb-2 text-accent" />
                  <p className="text-sm font-bold text-foreground">{platform.stats.avg_cpc}</p>
                  <p className="text-xs text-muted-foreground">Avg. CPC</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-sm font-bold text-foreground">{platform.stats.avg_cpm}</p>
                  <p className="text-xs text-muted-foreground">Avg. CPM</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <p className="text-sm font-bold text-foreground">{platform.stats.engagement_rate}</p>
                  <p className="text-xs text-muted-foreground">Engagement</p>
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
              {platform.name} Packages
            </h2>
            <p className="text-lg text-muted-foreground">Choose the perfect package for your advertising goals</p>
          </div>

          {platform.packages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No packages available for this platform yet.</p>
              <p className="text-sm text-muted-foreground mt-2">Contact us for custom packages.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {platform.packages.map((pkg) => (
                <Card
                  key={pkg.id}
                  className="border-2 hover:shadow-xl hover:-translate-y-1 transition-all"
                  data-testid={`package-${pkg.id}`}
                >
                  <CardContent className="p-6">
                    <div className="mb-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold text-foreground">{pkg.title}</h3>
                        {pkg.ad_spend && (
                          <Badge variant="outline" className="text-xs">
                            {pkg.ad_spend}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{pkg.description}</p>
                    </div>

                    <div className="mb-4">
                      <p className="text-3xl font-bold text-primary">{formatPrice(pkg.price)}</p>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {pkg.duration}
                      </p>
                    </div>

                    <div className="mb-4 space-y-2">
                      <p className="text-sm font-semibold text-foreground">What's included:</p>
                      {(pkg.deliverables || []).map((item, idx) => (
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
                          Book This Package
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
