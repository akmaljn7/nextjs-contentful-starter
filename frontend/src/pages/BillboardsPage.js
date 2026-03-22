import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguageStore, useCartStore, useAuthStore } from '@/lib/store';
import { t } from '@/lib/translations';
import api from '@/lib/api';
import { formatPrice, formatNumber } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { CheckCircle, MapPin, Loader2, ShoppingCart, Monitor } from 'lucide-react';
import { toast } from 'sonner';

export const BillboardsPage = () => {
  const { language } = useLanguageStore();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [billboards, setBillboards] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // LED Billboard Modal State
  const [showLEDModal, setShowLEDModal] = useState(false);
  const [selectedBillboard, setSelectedBillboard] = useState(null);
  const [states, setStates] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [selectedRoad, setSelectedRoad] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [availableRoads, setAvailableRoads] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const [addedPackages, setAddedPackages] = useState({});

  useEffect(() => {
    fetchBillboards();
    fetchLEDConfig();
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

  const fetchLEDConfig = async () => {
    try {
      const [statesRes, sizesRes] = await Promise.all([
        api.get('/led-billboard/states'),
        api.get('/led-billboard/sizes')
      ]);
      setStates(statesRes.data);
      setSizes(sizesRes.data);
    } catch (error) {
      console.error('Failed to load LED config:', error);
    }
  };

  const handleViewPackagesClick = (billboard, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isLED = (billboard.billboard_type || billboard.type || '').toLowerCase().includes('led');
    
    if (isLED) {
      setSelectedBillboard(billboard);
      setShowLEDModal(true);
      setShowPackages(false);
      setSelectedState('');
      setSelectedRoad('');
      setSelectedSize('');
      setAvailableRoads([]);
      setPackages([]);
    } else {
      // For non-LED billboards, navigate to detail page
      navigate(`/billboards/${billboard.id}`);
    }
  };

  const handleStateChange = (stateId) => {
    setSelectedState(stateId);
    setSelectedRoad('');
    setShowPackages(false);
    setPackages([]);
    
    // Find state and get its roads
    const state = states.find(s => s.id === stateId);
    if (state) {
      setAvailableRoads(state.roads || []);
    } else {
      setAvailableRoads([]);
    }
  };

  const handleRoadChange = (roadName) => {
    setSelectedRoad(roadName);
    setShowPackages(false);
    setPackages([]);
  };

  const handleSizeChange = (sizeId) => {
    setSelectedSize(sizeId);
    setShowPackages(false);
    setPackages([]);
  };

  const handleViewPackages = async () => {
    if (!selectedState || !selectedRoad || !selectedSize) {
      toast.error('Please select state, road, and size');
      return;
    }

    setLoadingPackages(true);
    try {
      const response = await api.get('/led-billboard/packages', {
        params: {
          state_id: selectedState,
          road_name: selectedRoad,
          size_id: selectedSize
        }
      });
      setPackages(response.data);
      setShowPackages(true);
      
      if (response.data.length === 0) {
        toast.info('No packages available for this selection');
      }
    } catch (error) {
      toast.error('Failed to load packages');
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleAddToCart = (pkg) => {
    if (!user) {
      toast.error('Please login to add items to cart');
      navigate('/login');
      return;
    }

    const state = states.find(s => s.id === selectedState);
    const size = sizes.find(s => s.id === selectedSize);

    const cartItem = {
      id: pkg.id,
      type: 'billboard',
      listingId: selectedBillboard?.id || 'led-billboard',
      listingName: `LED Billboard - ${state?.name || ''}, ${selectedRoad}`,
      packageId: pkg.id,
      packageTitle: pkg.title,
      price: pkg.price,
      duration: pkg.duration,
      deliverables: pkg.deliverables,
      image_url: pkg.image_url || selectedBillboard?.image_url,
      location: `${state?.name}, ${selectedRoad}`,
      size: size?.name,
    };

    addItem(cartItem);
    setAddedPackages(prev => ({ ...prev, [pkg.id]: true }));
    toast.success('Added to cart!');
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
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground mt-2">{t('common.loading', language)}</p>
          </div>
        ) : billboards.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No billboard categories found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {billboards.map((billboard) => {
              const isLED = (billboard.billboard_type || billboard.type || '').toLowerCase().includes('led');
              
              return (
                <div key={billboard.id}>
                  <Card
                    className="group hover:shadow-2xl hover:-translate-y-2 h-full border-2 transition-all duration-300 cursor-pointer"
                    data-testid={`billboard-card-${billboard.id}`}
                    onClick={() => !isLED && navigate(`/billboards/${billboard.id}`)}
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
                          onClick={(e) => handleViewPackagesClick(billboard, e)}
                        >
                          {isLED && <Monitor className="h-4 w-4 mr-2" />}
                          View Packages & Book
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* LED Billboard Selection Modal */}
      <Dialog open={showLEDModal} onOpenChange={setShowLEDModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Monitor className="h-6 w-6 text-accent" />
              LED Billboard Selection
            </DialogTitle>
            <DialogDescription>
              Select your preferred state, road, and billboard size to view available packages
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* State Selection */}
            <div className="space-y-2">
              <Label htmlFor="state-select" className="text-base font-semibold">
                1. Select State <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedState} onValueChange={handleStateChange}>
                <SelectTrigger id="state-select" data-testid="led-state-select">
                  <SelectValue placeholder="Choose a state..." />
                </SelectTrigger>
                <SelectContent>
                  {states.map((state) => (
                    <SelectItem key={state.id} value={state.id}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {states.length === 0 && (
                <p className="text-sm text-muted-foreground">No states available. Please contact admin.</p>
              )}
            </div>

            {/* Road Selection */}
            <div className="space-y-2">
              <Label htmlFor="road-select" className="text-base font-semibold">
                2. Select Major Road <span className="text-red-500">*</span>
              </Label>
              <Select 
                value={selectedRoad} 
                onValueChange={handleRoadChange}
                disabled={!selectedState || availableRoads.length === 0}
              >
                <SelectTrigger id="road-select" data-testid="led-road-select">
                  <SelectValue placeholder={selectedState ? "Choose a road..." : "Select a state first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoads.map((road, idx) => (
                    <SelectItem key={idx} value={road.name}>
                      <div className="flex flex-col">
                        <span>{road.name}</span>
                        {road.description && (
                          <span className="text-xs text-muted-foreground">{road.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedState && availableRoads.length === 0 && (
                <p className="text-sm text-muted-foreground">No roads configured for this state.</p>
              )}
            </div>

            {/* Size Selection */}
            <div className="space-y-2">
              <Label htmlFor="size-select" className="text-base font-semibold">
                3. Select LED Size <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedSize} onValueChange={handleSizeChange}>
                <SelectTrigger id="size-select" data-testid="led-size-select">
                  <SelectValue placeholder="Choose a size..." />
                </SelectTrigger>
                <SelectContent>
                  {sizes.map((size) => (
                    <SelectItem key={size.id} value={size.id}>
                      <div className="flex flex-col">
                        <span>{size.name}</span>
                        {size.description && (
                          <span className="text-xs text-muted-foreground">{size.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sizes.length === 0 && (
                <p className="text-sm text-muted-foreground">No sizes available. Please contact admin.</p>
              )}
            </div>

            {/* View Packages Button */}
            <Button 
              className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-6 text-lg"
              onClick={handleViewPackages}
              disabled={!selectedState || !selectedRoad || !selectedSize || loadingPackages}
              data-testid="view-led-packages-btn"
            >
              {loadingPackages ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Loading Packages...
                </>
              ) : (
                'View Packages'
              )}
            </Button>

            {/* Packages Display */}
            {showPackages && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">Available Packages</h3>
                
                {packages.length === 0 ? (
                  <div className="text-center py-8 bg-muted/30 rounded-lg">
                    <Monitor className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No packages found for this combination.</p>
                    <p className="text-sm text-muted-foreground">Try a different state, road, or size.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {packages.map((pkg) => (
                      <Card key={pkg.id} className="border-2 hover:border-accent/50 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row gap-4">
                            {pkg.image_url && (
                              <img 
                                src={pkg.image_url} 
                                alt={pkg.title}
                                className="w-full sm:w-32 h-24 object-cover rounded-lg"
                              />
                            )}
                            <div className="flex-1 space-y-2">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-semibold text-lg">{pkg.title}</h4>
                                  <p className="text-sm text-muted-foreground">{pkg.description}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-2xl font-bold text-primary">{formatPrice(pkg.price)}</p>
                                  <p className="text-xs text-muted-foreground">{pkg.duration}</p>
                                </div>
                              </div>
                              
                              {pkg.deliverables && pkg.deliverables.length > 0 && (
                                <div className="pt-2">
                                  <p className="text-xs text-muted-foreground mb-1">Includes:</p>
                                  <div className="flex flex-wrap gap-1">
                                    {pkg.deliverables.slice(0, 3).map((d, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        {d}
                                      </Badge>
                                    ))}
                                    {pkg.deliverables.length > 3 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{pkg.deliverables.length - 3} more
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              <Button 
                                className={`w-full mt-2 ${addedPackages[pkg.id] ? 'bg-green-600 hover:bg-green-700' : 'bg-accent hover:bg-accent/90'}`}
                                onClick={() => handleAddToCart(pkg)}
                                disabled={addedPackages[pkg.id]}
                                data-testid={`add-to-cart-${pkg.id}`}
                              >
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                {addedPackages[pkg.id] ? 'Added to Cart' : 'Add to Cart'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
