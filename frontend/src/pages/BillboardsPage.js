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

  useEffect(() => {
    fetchBillboards();
  }, []);

  const fetchBillboards = async () => {
    try {
      const response = await api.get('/billboards');
      setBillboards(response.data);
    } catch (error) {
      toast.error('Failed to load billboards');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" data-testid="billboards-page">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-foreground mb-3">{t('cat.billboards', language)}</h1>
          <p className="text-lg text-muted-foreground">{t('cat.billboards.desc', language)}</p>
        </div>
      </div>

      {/* Billboard Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Choose Your Billboard Type</h2>
          <p className="text-lg text-muted-foreground">Select from our three billboard categories</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t('common.loading', language)}</p>
          </div>
        ) : billboards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No billboard categories found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {billboards.map((billboard) => (
              <Link to={`/billboards/${billboard.id}`} key={billboard.id}>
                <Card
                  className="group hover:shadow-2xl hover:-translate-y-2 h-full border-2 transition-all duration-300"
                  data-testid={`billboard-card-${billboard.id}`}
                >
                  <CardContent className="p-0">
                    <div className="relative h-64 overflow-hidden rounded-t-lg">
                      {billboard.image_url && (
                        <img
                          src={billboard.image_url}
                          alt={billboard.location_name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      )}
                      {billboard.verified && (
                        <Badge className="absolute top-3 right-3 bg-white/90 text-primary border-0">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {t('common.verified', language)}
                        </Badge>
                      )}
                      <Badge className="absolute top-3 left-3 bg-accent text-white border-0 font-semibold">
                        {billboard.billboard_type}
                      </Badge>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="text-2xl font-bold text-foreground mb-2">{billboard.location_name}</h3>
                        <p className="text-sm text-muted-foreground">{billboard.description}</p>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm pt-3 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Avg. Daily Traffic</p>
                          <p className="text-lg font-semibold text-foreground">{formatNumber(billboard.traffic_daily)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{t('common.starting', language)}</p>
                          <p className="text-2xl font-bold text-primary">{formatPrice(billboard.price_monthly)}</p>
                          <p className="text-xs text-muted-foreground">{t('common.permonth', language)}</p>
                        </div>
                      </div>

                      <Button 
                        className="w-full bg-accent hover:bg-accent/90 text-white font-semibold mt-4"
                        data-testid={`view-packages-${billboard.id}`}
                      >
                        View Packages & Book
                      </Button>
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
