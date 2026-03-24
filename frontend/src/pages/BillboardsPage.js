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
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Label } from '@/components/ui/label';
import { CheckCircle, MapPin, Loader2, ShoppingCart, Monitor, Image, Lightbulb } from 'lucide-react';
import { toast } from 'sonner';

export const BillboardsPage = () => {
  const { language } = useLanguageStore();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [billboards, setBillboards] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Generic Billboard Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState(''); // 'led', 'static_banner', 'lightbox'
  const [selectedBillboard, setSelectedBillboard] = useState(null);
  
  // Shared states (used for all billboard types)
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  const [selectedRoad, setSelectedRoad] = useState('');
  const [availableRoads, setAvailableRoads] = useState([]);
  
  // LED-specific: Sizes
  const [sizes, setSizes] = useState([]);
  const [selectedSize, setSelectedSize] = useState('');
  
  // Static/Lightbox-specific: Types
  const [billboardTypes, setBillboardTypes] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  
  // Packages
  const [packages, setPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const [addedPackages, setAddedPackages] = useState({});
  
  // Independent billboard types
  const [independentTypes, setIndependentTypes] = useState([]);
  const [selectedIndependentType, setSelectedIndependentType] = useState(null);

  useEffect(() => {
    fetchBillboards();
    fetchConfig();
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

  const fetchConfig = async () => {
    try {
      const [statesRes, sizesRes, typesRes, independentTypesRes] = await Promise.all([
        api.get('/led-billboard/states'),
        api.get('/led-billboard/sizes'),
        api.get('/billboard-types'),
        api.get('/billboard-types?independent_only=true')
      ]);
      setStates(statesRes.data);
      setSizes(sizesRes.data);
      // Filter out independent types from the regular types
      setBillboardTypes((typesRes.data || []).filter(t => !t.is_independent));
      setIndependentTypes(independentTypesRes.data || []);
    } catch (error) {
      console.error('Failed to load billboard config:', error);
    }
  };

  const getBillboardCategory = (billboard) => {
    const type = (billboard.billboard_type || billboard.type || '').toLowerCase();
    if (type.includes('led') || type.includes('digital')) return 'led';
    if (type.includes('lightbox') || type.includes('light box')) return 'lightbox';
    return 'static_banner';
  };

  const handleViewPackagesClick = (billboard, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const category = getBillboardCategory(billboard);
    
    setSelectedBillboard(billboard);
    setModalType(category);
    setSelectedIndependentType(null);
    setShowModal(true);
    setShowPackages(false);
    setSelectedState('');
    setSelectedRoad('');
    setSelectedSize('');
    setSelectedType('');
    setAvailableRoads([]);
    setPackages([]);
  };

  // Handler for independent type cards
  const handleIndependentTypeClick = (independentType, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSelectedBillboard(null);
    setSelectedIndependentType(independentType);
    setModalType('independent');
    setShowModal(true);
    setShowPackages(false);
    setSelectedState('');
    setSelectedRoad('');
    setSelectedSize('');
    setSelectedType('');
    setAvailableRoads([]);
    setPackages([]);
  };

  const handleStateChange = (stateId) => {
    setSelectedState(stateId);
    setSelectedRoad('');
    setSelectedSize('');
    setSelectedType('');
    setShowPackages(false);
    setPackages([]);
    
    const state = states.find(s => s.id === stateId);
    if (state) {
      setAvailableRoads(state.roads || []);
    } else {
      setAvailableRoads([]);
    }
  };

  const handleRoadChange = (roadName) => {
    setSelectedRoad(roadName);
    setSelectedSize('');
    setSelectedType('');
    setShowPackages(false);
    setPackages([]);
  };

  const handleSizeChange = (sizeId) => {
    setSelectedSize(sizeId);
    setShowPackages(false);
    setPackages([]);
  };

  const handleTypeChange = (typeId) => {
    setSelectedType(typeId);
    setShowPackages(false);
    setPackages([]);
  };

  const handleViewPackages = async () => {
    if (!selectedState || !selectedRoad) {
      toast.error('Please select state and road');
      return;
    }
    
    if (modalType === 'led' && !selectedSize) {
      toast.error('Please select LED size');
      return;
    }
    
    if ((modalType === 'static_banner' || modalType === 'lightbox') && !selectedType) {
      toast.error('Please select billboard type');
      return;
    }

    setLoadingPackages(true);
    try {
      let response;
      
      if (modalType === 'led') {
        response = await api.get('/led-billboard/packages', {
          params: {
            state_id: selectedState,
            road_name: selectedRoad,
            size_id: selectedSize
          }
        });
      } else if (modalType === 'independent' && selectedIndependentType) {
        // Query packages for independent billboard type
        response = await api.get('/static-billboard/packages', {
          params: {
            billboard_type_id: selectedIndependentType.id,
            state_id: selectedState,
            road_name: selectedRoad
          }
        });
      } else {
        response = await api.get('/static-billboard/packages', {
          params: {
            category: modalType,
            state_id: selectedState,
            road_name: selectedRoad,
            type_id: selectedType
          }
        });
      }
      
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
    const size = modalType === 'led' ? sizes.find(s => s.id === selectedSize) : null;
    const type = (modalType === 'static_banner' || modalType === 'lightbox') 
      ? billboardTypes.find(t => t.id === selectedType) 
      : null;

    const listingTypeMap = {
      'led': 'led_billboard',
      'static_banner': 'static_banner',
      'lightbox': 'lightbox',
      'independent': 'independent_billboard'
    };

    const cartItem = {
      id: pkg.id,
      type: modalType,
      listingType: listingTypeMap[modalType] || 'independent_billboard',
      listingId: pkg.id,
      influencerId: pkg.id,
      listingName: `${getModalTitle()} - ${state?.name || ''}, ${selectedRoad}`,
      packageId: pkg.id,
      packageTitle: pkg.title,
      price: pkg.price,
      duration: pkg.duration,
      deliverables: pkg.deliverables || [],
      turnaround: pkg.duration,
      image_url: pkg.image_url || selectedBillboard?.image_url || selectedIndependentType?.image_url,
      location: `${state?.name}, ${selectedRoad}`,
      size: size?.name,
      billboard_type: type?.name || selectedIndependentType?.name,
      state_name: state?.name,
      road_name: selectedRoad,
      size_name: size?.name,
      type_name: type?.name || selectedIndependentType?.name,
      billboard_type_id: selectedIndependentType?.id,
    };

    addItem(cartItem);
    setAddedPackages(prev => ({ ...prev, [pkg.id]: true }));
    toast.success('Added to cart!');
  };

  const getModalTitle = () => {
    switch (modalType) {
      case 'led': return 'LED Billboard';
      case 'static_banner': return 'Static Banner Billboard';
      case 'lightbox': return 'Lightbox Billboard';
      case 'independent': return selectedIndependentType?.name || 'Custom Billboard';
      default: return 'Billboard';
    }
  };

  const getModalIcon = () => {
    switch (modalType) {
      case 'led': return <Monitor className="h-6 w-6 text-accent" />;
      case 'static_banner': return <Image className="h-6 w-6 text-accent" />;
      case 'lightbox': return <Lightbulb className="h-6 w-6 text-accent" />;
      case 'independent': return <Monitor className="h-6 w-6 text-accent" />;
      default: return <Monitor className="h-6 w-6 text-accent" />;
    }
  };

  const getCardIcon = (billboard) => {
    const category = getBillboardCategory(billboard);
    switch (category) {
      case 'led': return <Monitor className="h-4 w-4 mr-2" />;
      case 'static_banner': return <Image className="h-4 w-4 mr-2" />;
      case 'lightbox': return <Lightbulb className="h-4 w-4 mr-2" />;
      default: return null;
    }
  };

  // Filter types based on current modal type
  const filteredTypes = billboardTypes.filter(t => t.billboard_category === modalType);

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
          <p className="text-lg text-muted-foreground">Select from our billboard categories</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground mt-2">{t('common.loading', language)}</p>
          </div>
        ) : billboards.length === 0 && independentTypes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No billboard categories found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Default Billboard Categories (LED, Static, Lightbox) */}
            {billboards.map((billboard) => (
              <div key={billboard.id}>
                <Card
                  className="group hover:shadow-2xl hover:-translate-y-2 h-full border-2 transition-all duration-300 cursor-pointer"
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
                        onClick={(e) => handleViewPackagesClick(billboard, e)}
                      >
                        {getCardIcon(billboard)}
                        View Packages & Book
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
            
            {/* Independent/Custom Billboard Types */}
            {independentTypes.map((indType) => (
              <div key={indType.id}>
                <Card
                  className="group hover:shadow-2xl hover:-translate-y-2 h-full border-2 transition-all duration-300 cursor-pointer"
                  data-testid={`independent-billboard-card-${indType.id}`}
                >
                  <CardContent className="p-0">
                    <div className="relative h-64 overflow-hidden rounded-t-lg bg-gradient-to-br from-primary/10 to-accent/10">
                      {indType.image_url ? (
                        <img
                          src={indType.image_url}
                          alt={indType.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Monitor className="h-20 w-20 text-accent/50" />
                        </div>
                      )}
                      <Badge className="absolute top-3 left-3 bg-green-600 text-white border-0 font-semibold">
                        {indType.name}
                      </Badge>
                    </div>
                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="text-2xl font-bold text-foreground mb-2">{indType.name}</h3>
                        <p className="text-sm text-muted-foreground">{indType.description || 'Custom billboard advertising solution'}</p>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm pt-3 border-t">
                        <div>
                          <p className="text-xs text-muted-foreground">Avg. Daily Traffic</p>
                          <p className="text-lg font-semibold text-foreground">{formatNumber(indType.traffic_daily || 0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{t('common.starting', language)}</p>
                          <p className="text-2xl font-bold text-primary">{formatPrice(indType.price_starting || 0)}</p>
                          <p className="text-xs text-muted-foreground">{t('common.permonth', language)}</p>
                        </div>
                      </div>

                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold mt-4"
                        data-testid={`view-packages-${indType.id}`}
                        onClick={(e) => handleIndependentTypeClick(indType, e)}
                      >
                        <Monitor className="h-4 w-4 mr-2" />
                        View Packages & Book
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Billboard Selection Modal - Unified for all types */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              {getModalIcon()}
              {getModalTitle()} Selection
            </DialogTitle>
            <DialogDescription>
              {modalType === 'independent' 
                ? 'Select your preferred state and road to view available packages'
                : modalType === 'led' 
                  ? 'Select your preferred state, road, and size to view available packages' 
                  : 'Select your preferred state, road, and type to view available packages'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* State Selection */}
            <div className="space-y-2">
              <Label htmlFor="state-select" className="text-base font-semibold">
                1. Select State <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                options={states.map(state => ({
                  value: state.id,
                  label: state.name,
                }))}
                value={selectedState}
                onValueChange={handleStateChange}
                placeholder="Choose a state..."
                searchPlaceholder="Search states..."
                emptyMessage="No states found."
                data-testid="billboard-state-select"
              />
              {states.length === 0 && (
                <p className="text-sm text-muted-foreground">No states available. Please contact admin.</p>
              )}
            </div>

            {/* Road Selection */}
            <div className="space-y-2">
              <Label htmlFor="road-select" className="text-base font-semibold">
                2. Select Major Road <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                options={availableRoads.map(road => ({
                  value: road.name,
                  label: road.name,
                  description: road.description,
                }))}
                value={selectedRoad}
                onValueChange={handleRoadChange}
                placeholder={selectedState ? "Choose a road..." : "Select a state first"}
                searchPlaceholder="Search roads..."
                emptyMessage="No roads found."
                disabled={!selectedState || availableRoads.length === 0}
                data-testid="billboard-road-select"
              />
              {selectedState && availableRoads.length === 0 && (
                <p className="text-sm text-muted-foreground">No roads configured for this state.</p>
              )}
            </div>

            {/* Size Selection (LED only) */}
            {modalType === 'led' && (
              <div className="space-y-2">
                <Label htmlFor="size-select" className="text-base font-semibold">
                  3. Select LED Size <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  options={sizes.map(size => ({
                    value: size.id,
                    label: size.name,
                    description: size.description,
                  }))}
                  value={selectedSize}
                  onValueChange={handleSizeChange}
                  placeholder="Choose a size..."
                  searchPlaceholder="Search sizes..."
                  emptyMessage="No sizes found."
                  data-testid="billboard-size-select"
                />
                {sizes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No sizes available. Please contact admin.</p>
                )}
              </div>
            )}

            {/* Type Selection (Static Banner & Lightbox) */}
            {(modalType === 'static_banner' || modalType === 'lightbox') && (
              <div className="space-y-2">
                <Label htmlFor="type-select" className="text-base font-semibold">
                  3. Select Billboard Type <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  options={filteredTypes.map(type => ({
                    value: type.id,
                    label: type.name,
                    description: type.description,
                  }))}
                  value={selectedType}
                  onValueChange={handleTypeChange}
                  placeholder="Choose a type..."
                  searchPlaceholder="Search types..."
                  emptyMessage="No types found."
                  data-testid="billboard-type-select"
                />
                {filteredTypes.length === 0 && (
                  <p className="text-sm text-muted-foreground">No types available for {modalType === 'static_banner' ? 'Static Banner' : 'Lightbox'}. Please contact admin.</p>
                )}
              </div>
            )}

            {/* View Packages Button */}
            <Button 
              className="w-full bg-accent hover:bg-accent/90 text-white font-semibold py-6 text-lg"
              onClick={handleViewPackages}
              disabled={
                !selectedState || 
                !selectedRoad || 
                (modalType === 'led' && !selectedSize) ||
                ((modalType === 'static_banner' || modalType === 'lightbox') && !selectedType) ||
                loadingPackages
              }
              data-testid="view-packages-btn"
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
                    {getModalIcon()}
                    <p className="text-muted-foreground mt-3">No packages found for this combination.</p>
                    <p className="text-sm text-muted-foreground">
                      {modalType === 'independent' 
                        ? 'Try a different state or road.'
                        : `Try a different state, road, or ${modalType === 'led' ? 'size' : 'type'}.`}
                    </p>
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
