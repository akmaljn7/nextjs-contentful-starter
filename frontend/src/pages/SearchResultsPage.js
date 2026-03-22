import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useLanguageStore, useCartStore, useAuthStore } from '@/lib/store';
import api from '@/lib/api';
import { formatPrice, formatNumber } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlobalSearch } from '@/components/GlobalSearch';
import { 
  Search, 
  Filter, 
  Loader2, 
  Users, 
  Monitor, 
  Film, 
  Smartphone,
  MapPin,
  ChevronRight,
  X,
  SlidersHorizontal,
  Image,
  Lightbulb
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: '', label: 'All Categories', icon: Search },
  { value: 'influencer', label: 'Influencers', icon: Users },
  { value: 'billboard', label: 'Billboards', icon: Monitor },
  { value: 'led_billboard', label: 'LED Billboards', icon: Monitor },
  { value: 'static_billboard', label: 'Static/Lightbox', icon: Image },
  { value: 'digital_ad', label: 'Digital Ads', icon: Smartphone },
  { value: 'kannywood', label: 'Kannywood', icon: Film },
];

const getCategoryIcon = (type) => {
  switch (type) {
    case 'influencer': return <Users className="h-4 w-4" />;
    case 'billboard': return <Monitor className="h-4 w-4" />;
    case 'led_billboard': return <Monitor className="h-4 w-4" />;
    case 'static_banner': return <Image className="h-4 w-4" />;
    case 'lightbox': return <Lightbulb className="h-4 w-4" />;
    case 'digital_ad': return <Smartphone className="h-4 w-4" />;
    case 'kannywood': return <Film className="h-4 w-4" />;
    default: return <Search className="h-4 w-4" />;
  }
};

const getCategoryColor = (type) => {
  switch (type) {
    case 'influencer': return 'bg-pink-100 text-pink-700';
    case 'billboard': return 'bg-blue-100 text-blue-700';
    case 'led_billboard': return 'bg-purple-100 text-purple-700';
    case 'static_banner': return 'bg-green-100 text-green-700';
    case 'lightbox': return 'bg-yellow-100 text-yellow-700';
    case 'digital_ad': return 'bg-cyan-100 text-cyan-700';
    case 'kannywood': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-700';
  }
};

export const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states - synced with URL params
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    city: searchParams.get('city') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
  });

  // Sync filters with URL params when they change
  useEffect(() => {
    setFilters({
      q: searchParams.get('q') || '',
      category: searchParams.get('category') || '',
      city: searchParams.get('city') || '',
      min_price: searchParams.get('min_price') || '',
      max_price: searchParams.get('max_price') || '',
    });
  }, [searchParams]);

  // Fetch results based on URL params
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const params = {};
        const q = searchParams.get('q');
        const category = searchParams.get('category');
        const city = searchParams.get('city');
        const min_price = searchParams.get('min_price');
        const max_price = searchParams.get('max_price');
        
        if (q) params.q = q;
        if (category && category !== 'all') params.category = category;
        if (city) params.city = city;
        if (min_price) params.min_price = parseFloat(min_price);
        if (max_price) params.max_price = parseFloat(max_price);
        
        const response = await api.get('/search', { params });
        setResults(response.data.results || []);
        setTotal(response.data.total || 0);
      } catch (error) {
        console.error('Search failed:', error);
        toast.error('Failed to load search results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [searchParams]);

  // Update URL when filters change
  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.category) params.set('category', filters.category);
    if (filters.city) params.set('city', filters.city);
    if (filters.min_price) params.set('min_price', filters.min_price);
    if (filters.max_price) params.set('max_price', filters.max_price);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setFilters({
      q: filters.q,
      category: '',
      city: '',
      min_price: '',
      max_price: '',
    });
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    setSearchParams(params);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const activeFiltersCount = [filters.category, filters.city, filters.min_price, filters.max_price].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-background" data-testid="search-results-page">
      {/* Header */}
      <div className="bg-card border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 w-full">
              <GlobalSearch className="w-full" />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
              data-testid="toggle-filters-btn"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="bg-accent text-white ml-1">{activeFiltersCount}</Badge>
              )}
            </Button>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-muted/30 rounded-lg border" data-testid="filters-panel">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Category Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Category</Label>
                  <Select 
                    value={filters.category || "all"} 
                    onValueChange={(v) => handleFilterChange('category', v === 'all' ? '' : v)}
                  >
                    <SelectTrigger data-testid="category-filter">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value || "all"} value={cat.value || "all"}>
                          <div className="flex items-center gap-2">
                            <cat.icon className="h-4 w-4" />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* City Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">City / State</Label>
                  <Input
                    placeholder="e.g., Kano, Lagos"
                    value={filters.city}
                    onChange={(e) => handleFilterChange('city', e.target.value)}
                    data-testid="city-filter"
                  />
                </div>

                {/* Min Price Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min Price (₦)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.min_price}
                    onChange={(e) => handleFilterChange('min_price', e.target.value)}
                    data-testid="min-price-filter"
                  />
                </div>

                {/* Max Price Filter */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max Price (₦)</Label>
                  <Input
                    type="number"
                    placeholder="Any"
                    value={filters.max_price}
                    onChange={(e) => handleFilterChange('max_price', e.target.value)}
                    data-testid="max-price-filter"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={clearFilters}>
                  Clear Filters
                </Button>
                <Button className="bg-accent hover:bg-accent/90" onClick={applyFilters}>
                  Apply Filters
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {filters.q ? `Search results for "${filters.q}"` : 'Browse All Services'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {loading ? 'Searching...' : `${total} result${total !== 1 ? 's' : ''} found`}
            </p>
          </div>
        </div>

        {/* Active Filters Tags */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {filters.category && (
              <Badge variant="secondary" className="flex items-center gap-1 cursor-pointer hover:bg-muted">
                {CATEGORIES.find(c => c.value === filters.category)?.label || filters.category}
                <button onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.delete('category');
                  setSearchParams(params);
                }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {filters.city && (
              <Badge variant="secondary" className="flex items-center gap-1 cursor-pointer hover:bg-muted">
                <MapPin className="h-3 w-3" /> {filters.city}
                <button onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.delete('city');
                  setSearchParams(params);
                }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
            {(filters.min_price || filters.max_price) && (
              <Badge variant="secondary" className="flex items-center gap-1 cursor-pointer hover:bg-muted">
                ₦{filters.min_price || '0'} - ₦{filters.max_price || '∞'}
                <button onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.delete('min_price');
                  params.delete('max_price');
                  setSearchParams(params);
                }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        )}

        {/* Results Grid */}
        {loading ? (
          <div className="text-center py-16">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-accent" />
            <p className="text-muted-foreground mt-4">Searching across all categories...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <Search className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No results found</h2>
            <p className="text-muted-foreground mb-6">
              Try adjusting your search or filters to find what you're looking for.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
              <Button className="bg-accent hover:bg-accent/90" onClick={() => navigate('/influencers')}>
                Browse Influencers
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((result) => (
              <Link 
                key={`${result.type}-${result.id}`} 
                to={result.url}
                className="block"
              >
                <Card className="h-full hover:shadow-lg hover:-translate-y-1 transition-all duration-200 border-2 hover:border-accent/50 overflow-hidden">
                  <CardContent className="p-0">
                    {/* Image */}
                    <div className="relative h-48 bg-muted">
                      {result.image_url ? (
                        <img 
                          src={result.image_url} 
                          alt={result.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {getCategoryIcon(result.type)}
                        </div>
                      )}
                      <Badge className={`absolute top-3 left-3 ${getCategoryColor(result.type)} border-0`}>
                        {getCategoryIcon(result.type)}
                        <span className="ml-1">{result.category}</span>
                      </Badge>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-3">
                      <div>
                        <h3 className="font-semibold text-lg text-foreground line-clamp-1">
                          {result.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {result.subtitle}
                        </p>
                      </div>

                      {result.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {result.description}
                        </p>
                      )}

                      {result.location && result.location !== 'Online' && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {result.location}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div>
                          <p className="text-2xl font-bold text-primary">
                            {formatPrice(result.price)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {result.price_label}
                          </p>
                        </div>
                        <Button size="sm" variant="ghost" className="text-accent">
                          View <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
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

export default SearchResultsPage;
