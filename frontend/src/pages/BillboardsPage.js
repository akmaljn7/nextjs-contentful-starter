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
import { CheckCircle, Search, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export const BillboardsPage = () => {
  const { language } = useLanguageStore();
  const [billboards, setBillboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    city: '',
    billboard_type: '',
  });

  useEffect(() => {
    fetchBillboards();
  }, []);

  const fetchBillboards = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.city) params.append('city', filters.city);
      if (filters.billboard_type) params.append('billboard_type', filters.billboard_type);
      
      const response = await api.get(`/billboards?${params.toString()}`);
      setBillboards(response.data);
    } catch (error) {
      toast.error('Failed to load billboards');
    } finally {
      setLoading(false);
    }
  };

  const filteredBillboards = billboards.filter((bb) =>
    bb.location_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bb.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background" data-testid="billboards-page">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-foreground mb-3">{t('cat.billboards', language)}</h1>
          <p className="text-lg text-muted-foreground">{t('cat.billboards.desc', language)}</p>
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
            <Button onClick={fetchBillboards} data-testid="apply-filters-button">
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
        ) : filteredBillboards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No billboards found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBillboards.map((billboard) => (
              <Link to={`/billboards/${billboard.id}`} key={billboard.id}>
                <Card
                  className="group hover:shadow-lg hover:-translate-y-1 h-full border-2"
                  data-testid={`billboard-card-${billboard.id}`}
                >
                  <CardContent className="p-0">
                    <div className="relative h-48 overflow-hidden rounded-t-lg bg-gradient-to-br from-amber-100 to-orange-100">
                      {billboard.image_url && (
                        <img
                          src={billboard.image_url}
                          alt={billboard.location_name}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {billboard.verified && (
                        <Badge className="absolute top-3 right-3 bg-white/90 text-primary border-0">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {t('common.verified', language)}
                        </Badge>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{billboard.location_name}</h3>
                        <p className="text-sm text-muted-foreground flex items-center">
                          <MapPin className="h-4 w-4 mr-1" />
                          {billboard.city}, {billboard.state}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Type</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {billboard.billboard_type}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Daily Traffic</p>
                          <p className="text-sm font-semibold">{formatNumber(billboard.traffic_daily)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Size</p>
                          <p className="text-sm font-medium">{billboard.dimensions}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{t('common.permonth', language)}</p>
                          <p className="text-lg font-bold text-primary">{formatPrice(billboard.price_monthly)}</p>
                        </div>
                      </div>
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
