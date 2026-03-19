import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, TrendingUp, Users, Globe, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Default platform colors by name (fallback)
const PLATFORM_COLORS = {
  'facebook': '#1877F2',
  'instagram': '#E4405F',
  'tiktok': '#000000',
  'snapchat': '#FFFC00',
  'google': '#4285F4',
  'whatsapp': '#25D366',
  'youtube': '#FF0000',
  'twitter': '#1DA1F2',
  'linkedin': '#0077B5',
  'pinterest': '#E60023',
};

export const DigitalAdsPage = () => {
  const { language } = useLanguageStore();
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDigitalAds = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_URL}/api/digital-ads`);
        if (!response.ok) {
          throw new Error('Failed to fetch digital ad platforms');
        }
        const data = await response.json();
        setPlatforms(data);
      } catch (err) {
        console.error('Error fetching digital ads:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDigitalAds();
  }, []);

  // Helper to get platform color
  const getPlatformColor = (platform) => {
    const id = platform.id?.toLowerCase() || platform.platform?.toLowerCase();
    return platform.color || PLATFORM_COLORS[id] || '#6366F1';
  };

  // Helper to get starting price from packages
  const getStartingPrice = (platform) => {
    if (platform.starting_price) return platform.starting_price;
    if (platform.packages && platform.packages.length > 0) {
      const prices = platform.packages.map(p => p.price).filter(p => p > 0);
      return prices.length > 0 ? Math.min(...prices) : 50000;
    }
    return 50000;
  };

  // Helper to get features from packages or default
  const getFeatures = (platform) => {
    if (platform.features && platform.features.length > 0) return platform.features.slice(0, 3);
    if (platform.packages && platform.packages.length > 0) {
      return platform.packages.slice(0, 3).map(p => p.name);
    }
    return ['Professional management', 'Detailed analytics', 'Campaign optimization'];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="digital-ads-loading">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading platforms...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="digital-ads-error">
        <div className="text-center text-red-500">
          <p className="text-lg font-semibold mb-2">Error loading platforms</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="digital-ads-page">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-foreground mb-3">{t('cat.digitalads', language)}</h1>
          <p className="text-lg text-muted-foreground">{t('cat.digitalads.desc', language)}</p>
        </div>
      </div>

      {/* Platform Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Choose Your Advertising Platform</h2>
          <p className="text-lg text-muted-foreground">Professional ad management services across all major platforms</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {platforms.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Globe className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">No advertising platforms available yet.</p>
              <p className="text-sm text-muted-foreground mt-2">Check back soon for new opportunities!</p>
            </div>
          ) : (
            platforms.map((platform) => (
              <Link to={`/digital-ads/${platform.id}`} key={platform.id}>
                <Card
                  className="group hover:shadow-2xl hover:-translate-y-2 h-full border-2 transition-all duration-300"
                  data-testid={`platform-card-${platform.id}`}
                >
                  <CardContent className="p-0">
                    <div className="relative h-48 overflow-hidden rounded-t-lg">
                      <img
                        src={platform.image_url || `https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=600&h=400&fit=crop`}
                        alt={platform.name || platform.platform}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          e.target.src = 'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=600&h=400&fit=crop';
                        }}
                      />
                      <Badge 
                        className="absolute top-3 left-3 text-white border-0 font-semibold"
                        style={{ backgroundColor: getPlatformColor(platform) }}
                      >
                        {platform.platform}
                      </Badge>
                      <Badge className="absolute top-3 right-3 bg-white/90 text-primary border-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verified
                      </Badge>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="text-xl font-bold text-foreground mb-2">{platform.name || `${platform.platform} Ads`}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {platform.description || `Professional ${platform.platform} advertising services for your business.`}
                        </p>
                      </div>

                      {/* Features */}
                      <div className="space-y-2">
                        {getFeatures(platform).map((feature, idx) => (
                          <div key={idx} className="flex items-center text-sm">
                            <CheckCircle className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
                            <span className="text-muted-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <Users className="h-4 w-4 mr-1 text-accent" />
                          </div>
                          <p className="text-xs text-muted-foreground">Monthly Users</p>
                          <p className="text-sm font-semibold text-foreground">{platform.monthly_users || 'Millions'}</p>
                        </div>
                        <div className="text-center">
                          <div className="flex items-center justify-center mb-1">
                            <TrendingUp className="h-4 w-4 mr-1 text-green-600" />
                          </div>
                          <p className="text-xs text-muted-foreground">Avg. CPC</p>
                          <p className="text-sm font-semibold text-foreground">{platform.avg_cpc || 'Varies'}</p>
                        </div>
                      </div>

                      {/* Price & CTA */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Starting from</p>
                          <p className="text-xl font-bold text-primary">{formatPrice(getStartingPrice(platform))}</p>
                          <p className="text-xs text-muted-foreground">/month</p>
                        </div>
                        <Button 
                          className="bg-accent hover:bg-accent/90 text-white font-semibold"
                          data-testid={`view-packages-${platform.id}`}
                        >
                          View Packages
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
