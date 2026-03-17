import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguageStore, useAuthStore, useCartStore } from '@/lib/store';
import { t } from '@/lib/translations';
import api from '@/lib/api';
import { formatPrice, formatNumber } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Star, MapPin, Users, TrendingUp, Clock, MessageCircle, Instagram, Twitter, Youtube, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

export const InfluencerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguageStore();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [influencer, setInfluencer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [addedPackages, setAddedPackages] = useState({});
  const [flyingItem, setFlyingItem] = useState(null);

  useEffect(() => {
    fetchInfluencer();
  }, [id]);

  const fetchInfluencer = async () => {
    try {
      const response = await api.get(`/influencers/${id}`);
      const influencerData = response.data;
      setInfluencer(influencerData);
      
      // Set packages based on influencer
      setPackages(getPackagesForInfluencer(influencerData));
    } catch (error) {
      toast.error('Failed to load influencer details');
      navigate('/influencers');
    } finally {
      setLoading(false);
    }
  };

  const getPackagesForInfluencer = (influencer) => {
    // G_fresh - Comedy & Entertainment (TikTok)
    if (influencer.name === 'G_fresh') {
      return [
        {
          id: 'pkg-1',
          title: 'Comedy Skit with Brand',
          description: 'Hilarious 2-minute TikTok skit featuring your brand naturally integrated into the storyline',
          price: 80000,
          deliverables: ['1 TikTok comedy skit (2-3 mins)', 'Brand integration', 'Posted to 450K followers', 'Story repost'],
          turnaround: '3-5 days',
        },
        {
          id: 'pkg-2',
          title: 'Product Unboxing/Review',
          description: 'Fun and engaging product unboxing with comedic commentary',
          price: 60000,
          deliverables: ['1 TikTok unboxing video', 'Honest funny review', 'Product showcase', '24-hour story feature'],
          turnaround: '3-5 days',
        },
        {
          id: 'pkg-3',
          title: 'Brand Shoutout',
          description: 'Quick shoutout for your brand at the end of a viral skit',
          price: 30000,
          deliverables: ['5-10 second brand mention', 'Logo display', 'Posted to 450K followers', 'Natural integration'],
          turnaround: '1-2 days',
        },
        {
          id: 'pkg-4',
          title: 'Duet Challenge',
          description: 'Create a branded duet challenge that can go viral',
          price: 100000,
          deliverables: ['Original challenge video', 'Branded hashtag', 'Challenge promotion', 'Cross-platform share'],
          turnaround: '5-7 days',
        },
        {
          id: 'pkg-5',
          title: 'Full Campaign Package',
          description: 'Complete entertainment campaign with multiple skits and touchpoints',
          price: 200000,
          deliverables: ['3 TikTok skits', '5 stories', '1 Instagram reel', 'Branded hashtag campaign', 'Analytics report'],
          turnaround: '10-14 days',
        },
      ];
    }

    // Abis Fulani - Lifestyle & Travel (Instagram)
    if (influencer.name === 'Abis Fulani') {
      return [
        {
          id: 'pkg-1',
          title: '2 Minute TikTok Video',
          description: 'Engaging 2-minute video showcasing your brand with authentic storytelling',
          price: 50000,
          deliverables: ['1 TikTok video (up to 2 minutes)', 'Caption & hashtags', 'Posted to 320K followers', '24-hour story repost'],
          turnaround: '3-5 days',
        },
        {
          id: 'pkg-2',
          title: 'Instagram Reel Video',
          description: 'High-quality Instagram reel with product integration and lifestyle context',
          price: 60000,
          deliverables: ['1 Instagram reel (60-90 seconds)', 'Professional editing', 'Story mention', 'Permanent grid post'],
          turnaround: '3-5 days',
        },
        {
          id: 'pkg-3',
          title: 'Brand Poster Placement',
          description: 'Your brand poster/logo featured prominently in my next video',
          price: 20000,
          deliverables: ['Poster in video background', '3-5 second focused shot', 'Natural integration', 'Posted within 7 days'],
          turnaround: '5-7 days',
        },
        {
          id: 'pkg-4',
          title: 'Instagram Story Series (5 Stories)',
          description: '5-story series featuring your product/service with swipe-up link',
          price: 35000,
          deliverables: ['5 Instagram stories', 'Swipe-up/link sticker', '24-hour highlight', 'Analytics report'],
          turnaround: '1-2 days',
        },
        {
          id: 'pkg-5',
          title: 'Travel Campaign Package',
          description: 'Full travel campaign with multiple touchpoints (ideal for hotels, airlines, tourism)',
          price: 150000,
          deliverables: ['1 TikTok video', '1 Instagram reel', '3 grid posts', '10 stories', 'Blog feature (if applicable)'],
          turnaround: '7-10 days',
        },
      ];
    }

    // Baddoo - Lifestyle & Fashion (TikTok)
    if (influencer.name === 'Baddoo') {
      return [
        {
          id: 'pkg-1',
          title: 'Fashion Showcase Video',
          description: 'Stylish TikTok video featuring your fashion brand or clothing line',
          price: 70000,
          deliverables: ['1 TikTok fashion video (2-3 mins)', 'Multiple outfit shots', 'Product tags', 'Posted to 380K followers'],
          turnaround: '3-5 days',
        },
        {
          id: 'pkg-2',
          title: 'GRWM (Get Ready With Me)',
          description: 'Get Ready With Me video featuring your beauty/fashion products',
          price: 65000,
          deliverables: ['1 GRWM TikTok video', 'Product showcase', 'Step-by-step styling', 'Story highlights'],
          turnaround: '3-5 days',
        },
        {
          id: 'pkg-3',
          title: 'Brand Collaboration Post',
          description: 'Single branded TikTok post with outfit/product feature',
          price: 40000,
          deliverables: ['1 TikTok post', 'Product mention', 'Shopping tags', '24-hour story'],
          turnaround: '2-3 days',
        },
        {
          id: 'pkg-4',
          title: 'Lifestyle Day-in-the-Life',
          description: 'Day-in-the-life content featuring your brand naturally',
          price: 90000,
          deliverables: ['1 day-in-the-life TikTok', 'Multiple brand touchpoints', 'Authentic integration', 'Instagram cross-post'],
          turnaround: '5-7 days',
        },
        {
          id: 'pkg-5',
          title: 'Fashion Campaign Bundle',
          description: 'Complete fashion campaign across platforms',
          price: 180000,
          deliverables: ['3 TikTok videos', '2 Instagram reels', '10 stories', 'Lookbook feature', 'Analytics report'],
          turnaround: '10-14 days',
        },
      ];
    }

    // Maryamaaah_ - Food & Cooking (Instagram)
    if (influencer.name === 'Maryamaaah_') {
      return [
        {
          id: 'pkg-1',
          title: 'Recipe Video with Your Product',
          description: 'Full recipe video featuring your food product as the star ingredient',
          price: 70000,
          deliverables: ['1 Instagram reel recipe (2-3 mins)', 'Recipe integration', 'Product showcase', 'Posted to 320K followers'],
          turnaround: '5-7 days',
        },
        {
          id: 'pkg-2',
          title: 'Kitchen Equipment Review',
          description: 'Detailed review of your kitchen appliance or cooking equipment',
          price: 60000,
          deliverables: ['2-minute Instagram review', 'Demonstration of features', 'Honest assessment', 'Story highlights'],
          turnaround: '3-5 days',
        },
        {
          id: 'pkg-3',
          title: 'Brand Placement in Cooking Video',
          description: 'Your product/brand visible in kitchen setup during recipe video',
          price: 30000,
          deliverables: ['Product visible in frame', 'Natural integration', '2-3 second focus shot', 'Posted within 7 days'],
          turnaround: '5-7 days',
        },
        {
          id: 'pkg-4',
          title: 'Recipe Series (3 Videos)',
          description: 'Three recipe videos featuring your product in different dishes',
          price: 180000,
          deliverables: ['3 Instagram reels', 'Different recipes each', 'Full product integration', 'Story cross-post'],
          turnaround: '10-14 days',
        },
        {
          id: 'pkg-5',
          title: 'Instagram Reel + Story Bundle',
          description: 'Short-form reel with extended behind-the-scenes stories',
          price: 50000,
          deliverables: ['1 Instagram reel (60 seconds)', '5 behind-the-scenes stories', 'Recipe card', 'Swipe-up link'],
          turnaround: '3-5 days',
        },
      ];
    }

    // Meenal Ahmad - Fashion & Culture (TikTok)
    if (influencer.name === 'Meenal Ahmad') {
      return [
        {
          id: 'pkg-1',
          title: 'Traditional Fashion Showcase',
          description: 'Beautiful TikTok video showcasing traditional Nigerian fashion with your brand',
          price: 60000,
          deliverables: ['1 TikTok fashion video', 'Traditional styling', 'Product feature', 'Posted to 290K followers'],
          turnaround: '3-5 days',
        },
        {
          id: 'pkg-2',
          title: 'Cultural Style Video',
          description: 'Cultural celebration video featuring your fashion/beauty products',
          price: 55000,
          deliverables: ['1 TikTok cultural video', 'Outfit showcase', 'Brand mention', 'Story highlights'],
          turnaround: '3-5 days',
        },
        {
          id: 'pkg-3',
          title: 'Brand Styling Post',
          description: 'Single styled post featuring your fashion brand',
          price: 35000,
          deliverables: ['1 TikTok post', 'Professional styling', 'Product tags', '24-hour story'],
          turnaround: '2-3 days',
        },
        {
          id: 'pkg-4',
          title: 'Event/Occasion Styling',
          description: 'Special occasion styling video perfect for event wear brands',
          price: 75000,
          deliverables: ['1 occasion styling TikTok', 'Full look breakdown', 'Shopping details', 'Instagram cross-post'],
          turnaround: '5-7 days',
        },
        {
          id: 'pkg-5',
          title: 'Fashion Culture Campaign',
          description: 'Complete cultural fashion campaign with multiple looks',
          price: 150000,
          deliverables: ['3 TikTok videos', '2 Instagram posts', '8 stories', 'Brand ambassador feature', 'Analytics report'],
          turnaround: '10-14 days',
        },
      ];
    }
    
    // Ibrahim Sani - Technology (Twitter/X)
    if (influencer.name === 'Ibrahim Sani') {
      return [
        {
          id: 'pkg-1',
          title: 'Twitter/X Thread Review',
          description: 'Comprehensive thread reviewing your tech product or service',
          price: 45000,
          deliverables: ['10-15 tweet thread', 'Product photos/screenshots', 'Pinned for 48 hours', 'Reach 180K followers'],
          turnaround: '3-5 days',
        },
        {
          id: 'pkg-2',
          title: 'Video Demo Tweet',
          description: '2-minute video demonstration with detailed commentary',
          price: 55000,
          deliverables: ['Video tweet (up to 2 minutes)', 'Written review', 'Follow-up engagement', 'Retweet campaign'],
          turnaround: '5-7 days',
        },
        {
          id: 'pkg-3',
          title: 'Sponsored Tweet',
          description: 'Single sponsored tweet with your brand message',
          price: 25000,
          deliverables: ['1 branded tweet', 'Up to 280 characters + media', 'Posted to 180K followers', 'Active for 24 hours'],
          turnaround: '1-2 days',
        },
        {
          id: 'pkg-4',
          title: 'Tech Launch Campaign',
          description: 'Multi-platform campaign for product/app launch',
          price: 120000,
          deliverables: ['Launch thread (15 tweets)', 'Video review', '3 follow-up posts', 'Twitter Space discussion (optional)'],
          turnaround: '7-10 days',
        },
      ];
    }

    return [];
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
    
    // Add to cart
    addItem({
      influencerId: influencer.id,
      influencerName: influencer.name,
      influencerHandle: influencer.handle,
      influencerImage: influencer.image_url,
      packageId: pkg.id,
      packageTitle: pkg.title,
      price: pkg.price,
      deliverables: pkg.deliverables,
      turnaround: pkg.turnaround,
      listingType: 'influencer',
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

  if (!influencer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Influencer not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="influencer-detail-page">
      {/* Hero Section with Profile */}
      <section className="bg-gradient-to-br from-primary/5 to-accent/5 py-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-accent/5 transform skew-x-12 origin-top-right"></div>
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Profile Picture - Centered */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-6">
              <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white shadow-2xl">
                {influencer.image_url ? (
                  <img
                    src={influencer.image_url}
                    alt={influencer.name}
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Users className="h-16 w-16 text-white" />
                  </div>
                )}
              </div>
              {influencer.verified && (
                <div className="absolute bottom-2 right-2 bg-white rounded-full p-2 shadow-lg">
                  <CheckCircle className="h-6 w-6 text-primary" />
                </div>
              )}
            </div>

            <h1 className="text-4xl font-bold text-foreground mb-2">{influencer.name}</h1>
            <p className="text-xl text-accent mb-2">@{influencer.handle}</p>
            <Badge className="bg-primary text-white mb-4">{influencer.platform}</Badge>
            <p className="text-muted-foreground max-w-2xl">{influencer.bio}</p>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <Card className="border-2">
              <CardContent className="p-4 text-center">
                <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold text-foreground">{formatNumber(influencer.followers)}</p>
                <p className="text-sm text-muted-foreground">Followers</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-6 w-6 mx-auto mb-2 text-accent" />
                <p className="text-2xl font-bold text-foreground">{influencer.engagement_rate}%</p>
                <p className="text-sm text-muted-foreground">Engagement</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="p-4 text-center">
                <Star className="h-6 w-6 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-foreground">{influencer.rating}</p>
                <p className="text-sm text-muted-foreground">{influencer.total_reviews} reviews</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardContent className="p-4 text-center">
                <Clock className="h-6 w-6 mx-auto mb-2 text-green-600" />
                <p className="text-sm font-bold text-foreground">{influencer.response_time}</p>
                <p className="text-sm text-muted-foreground">Response Time</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">Advertising Packages</h2>
            <p className="text-lg text-muted-foreground">Choose the perfect package for your campaign</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <p className="text-sm text-muted-foreground">One-time payment</p>
                  </div>

                  <div className="mb-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Deliverables:</p>
                    {pkg.deliverables.map((item, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mb-4 pb-4 border-b">
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Turnaround: {pkg.turnaround}</span>
                    </div>
                  </div>

                  <Button
                    onClick={(e) => handleBookPackage(pkg, e)}
                    className={`w-full font-semibold transition-all ${
                      addedPackages[pkg.id] 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-accent hover:bg-accent/90 text-white'
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

          {/* Contact Section */}
          <div className="mt-12 text-center">
            <Card className="border-2 bg-gradient-to-br from-primary/5 to-accent/5">
              <CardContent className="p-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
                <h3 className="text-2xl font-bold text-foreground mb-2">Need a Custom Package?</h3>
                <p className="text-muted-foreground mb-6">
                  Have specific requirements? Contact us to create a customized advertising package.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/contact">
                    <Button variant="outline" className="border-primary text-primary hover:bg-primary/5">
                      Contact Us
                    </Button>
                  </Link>
                  <a href="https://wa.me/2348080000805" target="_blank" rel="noopener noreferrer">
                    <Button className="bg-green-600 hover:bg-green-700 text-white">
                      <MessageCircle className="h-4 w-4 mr-2" />
                      WhatsApp Us
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
};
