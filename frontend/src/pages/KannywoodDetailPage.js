import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguageStore, useAuthStore, useCartStore } from '@/lib/store';
import api from '@/lib/api';
import { formatPrice, formatNumber } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Star, Film, Users, TrendingUp, Clock, Calendar, Eye, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

// Kannywood packages based on Nigerian film industry advertising research
const KANNYWOOD_PACKAGES = {
  'kw-1': {
    productionName: "'Ya Daga Allah",
    productionType: "Feature Film",
    director: "Aminu Saira",
    genre: "Drama",
    releaseDate: "March 2026",
    estimatedReach: 2800000,
    description: "Aminu Saira's powerful drama exploring faith, family dynamics, and societal expectations in Northern Nigeria. A deeply emotional story that resonates with Hausa-speaking audiences across Nigeria and beyond.",
    posterUrl: "https://customer-assets.emergentagent.com/job_ads-kano/artifacts/xuqki5h5_ya%20daga%20Allah.png",
    packages: [
      {
        id: 'pkg-1',
        title: 'Background Product Placement',
        description: 'Your product visible in background scenes - kitchen, office, or living room settings',
        price: 150000,
        deliverables: [
          'Product visible in 3-5 scenes',
          'Natural background placement',
          'No dialogue mention',
          'Certificate of placement',
          'Behind-the-scenes photo'
        ],
        turnaround: 'Film Release Date',
        reach: '500,000+ viewers',
      },
      {
        id: 'pkg-2',
        title: 'Active Product Integration',
        description: 'Character actively uses your product as part of the storyline',
        price: 350000,
        deliverables: [
          'Product used by main/supporting character',
          '2-3 active usage scenes',
          'Natural storyline integration',
          'Social media mention',
          'Press kit inclusion',
          'Premiere invitation (2 tickets)'
        ],
        turnaround: 'Film Release Date',
        reach: '1,000,000+ viewers',
      },
      {
        id: 'pkg-3',
        title: 'Verbal Mention Package',
        description: 'Character mentions your brand/product name in dialogue',
        price: 500000,
        deliverables: [
          'Verbal brand mention in dialogue',
          'Active product usage scene',
          'Background placements (5+ scenes)',
          'Trailer inclusion (if applicable)',
          'Social media campaign',
          'Red carpet presence'
        ],
        turnaround: 'Film Release Date',
        reach: '1,500,000+ viewers',
      },
      {
        id: 'pkg-4',
        title: 'Title Sponsorship',
        description: 'Premium sponsorship with brand name in opening credits',
        price: 950000,
        deliverables: [
          '"Sponsored by [Your Brand]" in opening credits',
          'Logo on all promotional materials',
          'Verbal mentions (2-3 scenes)',
          'Product integration throughout',
          'VIP premiere access (10 tickets)',
          'Press conference participation',
          'Exclusive promotional clip rights'
        ],
        turnaround: 'Film Release Date',
        reach: '2,800,000+ viewers',
      },
    ],
  },
  'kw-2': {
    productionName: "Labarina Season 14",
    productionType: "TV Series",
    director: "Saira Movies Production",
    genre: "Comedy-Drama",
    releaseDate: "April 2026",
    estimatedReach: 3200000,
    description: "The beloved Labarina series returns for its 14th season! A comedy-drama that has captured hearts across Northern Nigeria with its relatable characters and family-friendly humor. Perfect for brands targeting household audiences.",
    posterUrl: "https://customer-assets.emergentagent.com/job_ads-kano/artifacts/rgzfcnfi_labarina.png",
    packages: [
      {
        id: 'pkg-1',
        title: 'Single Episode Placement',
        description: 'Product placement in one episode of the season',
        price: 120000,
        deliverables: [
          'Product visible in 2-3 scenes',
          'One episode feature',
          'Social media story mention',
          'Certificate of placement'
        ],
        turnaround: 'Episode Air Date',
        reach: '250,000+ per episode',
      },
      {
        id: 'pkg-2',
        title: 'Multi-Episode Package (5 Episodes)',
        description: 'Consistent product presence across 5 episodes',
        price: 450000,
        deliverables: [
          'Product placement in 5 episodes',
          'Character interaction with product',
          'Instagram/Facebook posts (3)',
          'Behind-the-scenes content',
          'Analytics report'
        ],
        turnaround: '5-week campaign',
        reach: '1,200,000+ viewers',
      },
      {
        id: 'pkg-3',
        title: 'Full Season Integration',
        description: 'Your brand woven into the entire season storyline',
        price: 850000,
        deliverables: [
          'Presence in all season episodes',
          'Recurring product/brand mentions',
          'Character association with brand',
          'Social media campaign (season-long)',
          'Promotional video clip',
          'Meet & greet with cast'
        ],
        turnaround: 'Full Season',
        reach: '2,500,000+ viewers',
      },
      {
        id: 'pkg-4',
        title: 'Season Title Sponsor',
        description: '"Labarina Season 14 - Presented by [Your Brand]"',
        price: 1400000,
        deliverables: [
          'Title card: "Presented by [Brand]"',
          'Logo in all episode intros/outros',
          'Full season product integration',
          'Cast promotional appearances (2)',
          'Exclusive premiere event hosting',
          'Custom promotional skit',
          'YouTube/streaming ad rights'
        ],
        turnaround: 'Full Season',
        reach: '3,200,000+ viewers',
      },
    ],
  },
  'kw-3': {
    productionName: "Gidan Badamasi",
    productionType: "Sit-Com Series",
    director: "Kannywood Productions",
    genre: "Family Comedy",
    releaseDate: "May 2026",
    estimatedReach: 2200000,
    description: "Nigeria's favorite family sit-com featuring everyday life scenarios in a typical Northern Nigerian household. The Badamasi family's hilarious adventures provide perfect opportunities for household brands and consumer products.",
    posterUrl: "https://customer-assets.emergentagent.com/job_ads-kano/artifacts/uepkoeu8_gidan%20badamasi.png",
    packages: [
      {
        id: 'pkg-1',
        title: 'Kitchen/Home Product Placement',
        description: 'Ideal for food, beverages, and household products',
        price: 100000,
        deliverables: [
          'Product in kitchen/living room scenes',
          'Natural family usage context',
          '3-4 visibility moments',
          'Social media mention',
          'Placement certificate'
        ],
        turnaround: 'Episode Air Date',
        reach: '200,000+ per episode',
      },
      {
        id: 'pkg-2',
        title: 'Comedy Skit Integration',
        description: 'Your product featured in a comedic scene/skit',
        price: 280000,
        deliverables: [
          'Dedicated comedy skit featuring product',
          'Funny/memorable usage scenario',
          'Shareable clip for your marketing',
          'Cast social media posts',
          'Behind-the-scenes content'
        ],
        turnaround: '2-3 weeks',
        reach: '800,000+ viewers',
      },
      {
        id: 'pkg-3',
        title: 'Character Endorsement',
        description: 'Popular character becomes associated with your brand',
        price: 500000,
        deliverables: [
          'Character regularly uses/mentions product',
          'Running gag or catchphrase opportunity',
          '"Badamasi\'s favorite [product]" positioning',
          'Promotional video with character',
          'Social media campaign',
          'Event appearance (1)'
        ],
        turnaround: 'Multi-episode arc',
        reach: '1,500,000+ viewers',
      },
      {
        id: 'pkg-4',
        title: 'Show Sponsorship',
        description: 'Full show sponsorship with maximum brand exposure',
        price: 750000,
        deliverables: [
          'Opening sponsor mention',
          'Regular product integration',
          'Mid-show sponsor bumper',
          'Cast promotional content',
          'Exclusive advertising slot',
          'Premiere/finale event hosting',
          'Merchandise collaboration opportunity'
        ],
        turnaround: 'Season/Series',
        reach: '2,200,000+ viewers',
      },
    ],
  },
};

export const KannywoodDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [production, setProduction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addedPackages, setAddedPackages] = useState({});

  useEffect(() => {
    fetchProduction();
  }, [id]);

  const fetchProduction = async () => {
    try {
      // Get production from API
      const response = await api.get(`/kannywood/${id}`);
      const apiData = response.data;
      
      // Merge with our package data
      const packageData = KANNYWOOD_PACKAGES[id];
      if (packageData) {
        setProduction({
          ...apiData,
          ...packageData,
          image_url: packageData.posterUrl,
        });
      } else {
        setProduction(apiData);
      }
    } catch (error) {
      toast.error('Production not found');
      navigate('/kannywood');
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
      influencerId: id,
      influencerName: production.productionName,
      influencerHandle: production.productionType,
      influencerImage: production.posterUrl || production.image_url,
      packageId: pkg.id,
      packageTitle: pkg.title,
      price: pkg.price,
      deliverables: pkg.deliverables,
      turnaround: pkg.turnaround,
      listingType: 'kannywood',
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
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!production) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Production not found</p>
      </div>
    );
  }

  const packages = production.packages || [];

  return (
    <div className="min-h-screen bg-background" data-testid="kannywood-detail-page">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 py-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-accent/5 transform skew-x-12 origin-top-right"></div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row gap-8 items-center">
            {/* Poster */}
            <div className="w-full lg:w-1/3">
              <div className="rounded-lg overflow-hidden shadow-2xl border-4 border-white/20">
                {production.posterUrl || production.image_url ? (
                  <img
                    src={production.posterUrl || production.image_url}
                    alt={production.productionName}
                    className="w-full h-auto object-cover"
                  />
                ) : (
                  <div className="w-full h-96 bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Film className="h-24 w-24 text-white/50" />
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="w-full lg:w-2/3 text-center lg:text-left">
              <Badge className="bg-purple-600 text-white mb-4">
                <Film className="h-3 w-3 mr-1" />
                {production.productionType}
              </Badge>
              <h1 className="text-4xl font-bold text-foreground mb-2">{production.productionName}</h1>
              <p className="text-lg text-accent font-medium mb-4">
                {production.director} • {production.genre}
              </p>
              <p className="text-muted-foreground mb-6 max-w-2xl">{production.description}</p>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-2">
                  <CardContent className="p-4 text-center">
                    <Users className="h-6 w-6 mx-auto mb-2 text-purple-600" />
                    <p className="text-lg font-bold text-foreground">{formatNumber(production.estimatedReach)}</p>
                    <p className="text-xs text-muted-foreground">Est. Reach</p>
                  </CardContent>
                </Card>
                <Card className="border-2">
                  <CardContent className="p-4 text-center">
                    <Calendar className="h-6 w-6 mx-auto mb-2 text-accent" />
                    <p className="text-lg font-bold text-foreground">{production.releaseDate}</p>
                    <p className="text-xs text-muted-foreground">Release Date</p>
                  </CardContent>
                </Card>
                <Card className="border-2">
                  <CardContent className="p-4 text-center">
                    <Eye className="h-6 w-6 mx-auto mb-2 text-green-600" />
                    <p className="text-lg font-bold text-foreground">Hausa</p>
                    <p className="text-xs text-muted-foreground">Language</p>
                  </CardContent>
                </Card>
                <Card className="border-2">
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                    <p className="text-lg font-bold text-foreground">Northern NG</p>
                    <p className="text-xs text-muted-foreground">Primary Market</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Advertising Packages
            </h2>
            <p className="text-lg text-muted-foreground">Choose the perfect sponsorship package for your brand</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {packages.map((pkg) => (
              <Card
                key={pkg.id}
                className="border-2 hover:shadow-xl hover:-translate-y-1 transition-all"
                data-testid={`package-${pkg.id}`}
              >
                <CardContent className="p-6">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-foreground mb-2">{pkg.title}</h3>
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-3xl font-bold text-primary">{formatPrice(pkg.price)}</p>
                    <div className="flex items-center space-x-4 mt-2">
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {pkg.turnaround}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Eye className="h-4 w-4 mr-1" />
                        {pkg.reach}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">What's included:</p>
                    {pkg.deliverables.map((item, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={(e) => handleBookPackage(pkg, e)}
                    className={`w-full font-semibold transition-all ${
                      addedPackages[pkg.id] 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
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
        </div>
      </section>

      {/* Why Advertise Section */}
      <section className="py-16 bg-gradient-to-br from-purple-900/10 to-pink-900/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Why Advertise with Kannywood?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-2 text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Massive Reach</h3>
                <p className="text-sm text-muted-foreground">
                  Access 90+ million Hausa speakers across Nigeria, Niger, Ghana, and the diaspora
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-8 w-8 text-pink-600" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Cultural Connection</h3>
                <p className="text-sm text-muted-foreground">
                  Authentic storytelling that resonates deeply with Northern Nigerian audiences
                </p>
              </CardContent>
            </Card>
            <Card className="border-2 text-center">
              <CardContent className="p-6">
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-accent" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">Growing Industry</h3>
                <p className="text-sm text-muted-foreground">
                  ₦70-100 billion annual industry with increasing digital distribution
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};
