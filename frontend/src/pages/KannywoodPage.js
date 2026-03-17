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
import { CheckCircle, Search, Film, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export const KannywoodPage = () => {
  const { language } = useLanguageStore();
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchKannywood();
  }, []);

  const fetchKannywood = async () => {
    try {
      const response = await api.get('/kannywood');
      // Add custom posters to the response data
      const placementsWithPosters = response.data.map((placement) => {
        // Map specific productions to your posters
        if (placement.production_name.includes('Ya Daga Allah')) {
          return {
            ...placement,
            image_url: 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/xuqki5h5_ya%20daga%20Allah.png'
          };
        } else if (placement.production_name.includes('Labarin')) {
          return {
            ...placement,
            image_url: 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/rgzfcnfi_labarina.png'
          };
        } else if (placement.production_name.includes('Gidan')) {
          return {
            ...placement,
            image_url: 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/uepkoeu8_gidan%20badamasi.png'
          };
        }
        return placement;
      });
      setPlacements(placementsWithPosters);
    } catch (error) {
      toast.error('Failed to load Kannywood placements');
    } finally {
      setLoading(false);
    }
  };

  const filteredPlacements = placements.filter((placement) =>
    placement.production_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    placement.placement_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background" data-testid="kannywood-page">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-foreground mb-3">{t('cat.kannywood', language)}</h1>
          <p className="text-lg text-muted-foreground">{t('cat.kannywood.desc', language)}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`${t('common.search', language)} productions...`}
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
        ) : filteredPlacements.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No Kannywood placements found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlacements.map((placement) => (
              <Link to={`/kannywood/${placement.id}`} key={placement.id}>
                <Card
                  className="group hover:shadow-lg hover:-translate-y-1 h-full border-2 cursor-pointer transition-all"
                  data-testid={`kannywood-card-${placement.id}`}
                >
                  <CardContent className="p-0">
                    <div className="relative h-64 overflow-hidden rounded-t-lg bg-gradient-to-br from-purple-100 to-pink-100">
                      {placement.image_url ? (
                        <img
                          src={placement.image_url}
                          alt={placement.production_name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="h-16 w-16 text-muted-foreground" />
                        </div>
                      )}
                      {placement.verified && (
                        <Badge className="absolute top-3 right-3 bg-white/90 text-primary border-0">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {t('common.verified', language)}
                        </Badge>
                      )}
                      <Badge className="absolute top-3 left-3 bg-purple-600 text-white border-0">
                        <Film className="h-3 w-3 mr-1" />
                        Kannywood
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="text-lg font-bold text-foreground">{placement.production_name}</h3>
                        <Badge variant="outline" className="text-xs mt-1">
                          {placement.placement_type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{placement.description}</p>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Estimated Reach</p>
                          <p className="text-sm font-semibold">{formatNumber(placement.estimated_reach)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Starting from</p>
                          <p className="text-lg font-bold text-primary">{formatPrice(placement.price)}</p>
                        </div>
                      </div>
                      {placement.release_date && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">Release Date</p>
                          <p className="text-sm font-medium">{placement.release_date}</p>
                        </div>
                      )}
                      <Button 
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold mt-2"
                        data-testid={`view-packages-${placement.id}`}
                      >
                        View Packages
                        <ArrowRight className="h-4 w-4 ml-2" />
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
