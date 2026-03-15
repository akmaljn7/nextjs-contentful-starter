import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import api from '@/lib/api';
import { formatPrice, formatNumber } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Search, Star, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export const InfluencersPage = () => {
  const { language } = useLanguageStore();
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    city: '',
    niche: '',
  });

  useEffect(() => {
    fetchInfluencers();
  }, []);

  const fetchInfluencers = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.city) params.append('city', filters.city);
      if (filters.niche) params.append('niche', filters.niche);
      
      const response = await api.get(`/influencers?${params.toString()}`);
      setInfluencers(response.data);
    } catch (error) {
      toast.error('Failed to load influencers');
    } finally {
      setLoading(false);
    }
  };

  const filteredInfluencers = influencers.filter((inf) =>
    inf.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inf.niche.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background" data-testid="influencers-page">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-foreground mb-3">{t('cat.influencers', language)}</h1>
          <p className="text-lg text-muted-foreground">{t('cat.influencers.desc', language)}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${t('common.search', language)}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="search-input"
              />
            </div>
            <Input
              placeholder={t('common.location', language)}
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              className="md:w-48"
              data-testid="city-filter"
            />
            <Input
              placeholder="Niche"
              value={filters.niche}
              onChange={(e) => setFilters({ ...filters, niche: e.target.value })}
              className="md:w-48"
              data-testid="niche-filter"
            />
            <Button onClick={fetchInfluencers} data-testid="apply-filters-button">
              {t('common.filter', language)}
            </Button>
          </div>
        </div>
      </div>

      {/* Listings */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('common.loading', language)}</p>
          </div>
        ) : filteredInfluencers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No influencers found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInfluencers.map((influencer) => (
              <Link to={`/influencers/${influencer.id}`} key={influencer.id}>
                <Card
                  className="group hover:shadow-lg hover:-translate-y-1 h-full border-2"
                  data-testid={`influencer-card-${influencer.id}`}
                >
                  <CardContent className="p-0">
                    <div className="relative h-48 overflow-hidden rounded-t-lg bg-gradient-to-br from-blue-100 to-purple-100">
                      {influencer.image_url && (
                        <img
                          src={influencer.image_url}
                          alt={influencer.name}
                          className="w-full h-full object-cover object-top"
                        />
                      )}
                      {influencer.verified && (
                        <Badge className="absolute top-3 right-3 bg-white/90 text-primary border-0">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {t('common.verified', language)}
                        </Badge>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{influencer.name}</h3>
                        <p className="text-sm text-muted-foreground">@{influencer.handle}</p>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{influencer.location}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {influencer.platform}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Followers</p>
                          <p className="text-sm font-semibold">{formatNumber(influencer.followers)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{t('common.starting', language)}</p>
                          <p className="text-lg font-bold text-primary">{formatPrice(influencer.price_per_post)}</p>
                        </div>
                      </div>
                      {influencer.rating > 0 && (
                        <div className="flex items-center space-x-1 pt-2 border-t">
                          <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                          <span className="text-sm font-medium">{influencer.rating}</span>
                          <span className="text-xs text-muted-foreground">
                            ({influencer.total_reviews} {t('common.reviews', language)})
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
