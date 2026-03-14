import { useState, useEffect } from 'react';
import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import api from '@/lib/api';
import { formatPrice } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Search, Star, Monitor } from 'lucide-react';
import { toast } from 'sonner';

export const DigitalAdsPage = () => {
  const { language } = useLanguageStore();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Platform poster mapping
  const platformPosters = {
    'Snapchat': 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/cdbi8ulp_snapchat.png',
    'Facebook/Instagram': 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=600&h=400&fit=crop',
    'Google': 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=600&h=400&fit=crop',
    'Instagram': 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&h=400&fit=crop',
    'Facebook': 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=600&h=400&fit=crop'
  };

  useEffect(() => {
    fetchDigitalAds();
  }, []);

  const fetchDigitalAds = async () => {
    try {
      const response = await api.get('/digital-ads');
      // Add posters based on platform
      const servicesWithPosters = response.data.map((service) => {
        let poster = null;
        Object.keys(platformPosters).forEach((platform) => {
          if (service.platform.includes(platform)) {
            poster = platformPosters[platform];
          }
        });
        return {
          ...service,
          image_url: poster || platformPosters['Google']
        };
      });
      setServices(servicesWithPosters);
    } catch (error) {
      toast.error('Failed to load digital ad services');
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter((service) =>
    service.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.platform.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background" data-testid="digital-ads-page">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-foreground mb-3">{t('cat.digitalads', language)}</h1>
          <p className="text-lg text-muted-foreground">{t('cat.digitalads.desc', language)}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${t('common.search', language)} ad services...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('common.loading', language)}</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No digital ad services found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredServices.map((service) => (
              <Card
                key={service.id}
                className="group hover:shadow-lg hover:-translate-y-1 h-full border-2"
                data-testid={`digital-ad-card-${service.id}`}
              >
                <CardContent className="p-0">
                  <div className="relative h-48 overflow-hidden rounded-t-lg bg-gradient-to-br from-green-100 to-blue-100">
                    {service.image_url ? (
                      <img
                        src={service.image_url}
                        alt={service.platform}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Monitor className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                    {service.verified && (
                      <Badge className="absolute top-3 right-3 bg-white/90 text-primary border-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('common.verified', language)}
                      </Badge>
                    )}
                    <Badge className="absolute top-3 left-3 bg-primary text-white border-0">
                      {service.platform}
                    </Badge>
                  </div>
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{service.service_name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                    
                    {/* Includes */}
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-foreground">Includes:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {service.includes.slice(0, 3).map((item, idx) => (
                          <li key={idx} className="flex items-center">
                            <CheckCircle className="h-3 w-3 mr-1 text-primary" />
                            {item}
                          </li>
                        ))}
                        {service.includes.length > 3 && (
                          <li className="text-xs text-muted-foreground">+ {service.includes.length - 3} more</li>
                        )}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="text-left">
                        <p className="text-xs text-muted-foreground">{t('common.starting', language)}</p>
                        <p className="text-lg font-bold text-primary">{formatPrice(service.price_starting)}</p>
                      </div>
                      {service.rating > 0 && (
                        <div className="flex items-center space-x-1">
                          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                          <span className="text-sm font-medium">{service.rating}</span>
                          <span className="text-xs text-muted-foreground">
                            ({service.total_reviews})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
