import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore, useCartStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, TrendingUp, Users, Target, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

// Platform data with real pricing packages
const PLATFORM_DATA = {
  facebook: {
    id: 'facebook',
    name: 'Facebook Ads',
    platform: 'Facebook',
    description: 'Reach over 2.9 billion monthly active users with targeted advertising. Perfect for brand awareness, lead generation, and driving sales.',
    image_url: 'https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800&h=400&fit=crop',
    color: '#1877F2',
    stats: {
      monthly_users: '2.9 Billion',
      avg_cpc: '₦50-₦200',
      avg_cpm: '₦500-₦2,000',
      engagement_rate: '0.5-1.5%',
    },
    packages: [
      {
        id: 'fb-starter',
        title: 'Starter Package',
        description: 'Perfect for small businesses starting with Facebook advertising',
        price: 50000,
        duration: '1 Month',
        ad_spend: '₦30,000 included',
        deliverables: [
          'Campaign setup & optimization',
          '2 ad creatives (image/carousel)',
          'Audience research & targeting',
          'Basic A/B testing',
          'Weekly performance report',
          'Up to 10,000 reach',
        ],
      },
      {
        id: 'fb-growth',
        title: 'Growth Package',
        description: 'Scale your reach with advanced targeting and multiple campaigns',
        price: 150000,
        duration: '1 Month',
        ad_spend: '₦100,000 included',
        deliverables: [
          'Multiple campaign management',
          '5 ad creatives (image/video/carousel)',
          'Advanced audience segmentation',
          'Retargeting campaign setup',
          'Conversion tracking setup',
          'Bi-weekly strategy calls',
          'Up to 50,000 reach',
        ],
      },
      {
        id: 'fb-premium',
        title: 'Premium Package',
        description: 'Full-service Facebook advertising for maximum ROI',
        price: 350000,
        duration: '1 Month',
        ad_spend: '₦250,000 included',
        deliverables: [
          'Dedicated account manager',
          '10+ ad creatives with professional design',
          'Custom audience & lookalike creation',
          'Full funnel campaign strategy',
          'Landing page optimization',
          'Weekly strategy calls',
          'Detailed ROI reporting',
          'Up to 150,000 reach',
        ],
      },
      {
        id: 'fb-enterprise',
        title: 'Enterprise Package',
        description: 'Enterprise-level advertising with unlimited support',
        price: 750000,
        duration: '1 Month',
        ad_spend: '₦500,000+ included',
        deliverables: [
          'Priority account management',
          'Unlimited ad creatives',
          'Multi-market campaigns',
          'Advanced analytics & attribution',
          'CRM integration',
          'Daily optimization',
          '24/7 monitoring',
          'Monthly strategy review',
          'Up to 500,000+ reach',
        ],
      },
    ],
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram Ads',
    platform: 'Instagram',
    description: 'Visual-first advertising on the most engaging social platform. Leverage Stories, Reels, and Shopping features to drive results.',
    image_url: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&h=400&fit=crop',
    color: '#E4405F',
    stats: {
      monthly_users: '2 Billion',
      avg_cpc: '₦60-₦250',
      avg_cpm: '₦800-₦2,500',
      engagement_rate: '1.5-3%',
    },
    packages: [
      {
        id: 'ig-starter',
        title: 'Feed & Stories Starter',
        description: 'Get started with Instagram advertising on Feed and Stories',
        price: 60000,
        duration: '1 Month',
        ad_spend: '₦35,000 included',
        deliverables: [
          'Feed + Stories ad setup',
          '3 creative designs',
          'Hashtag strategy',
          'Audience targeting',
          'Instagram Shopping setup (if applicable)',
          'Weekly analytics report',
          'Up to 15,000 reach',
        ],
      },
      {
        id: 'ig-reels',
        title: 'Reels Growth Package',
        description: 'Maximize reach with Instagram Reels advertising',
        price: 120000,
        duration: '1 Month',
        ad_spend: '₦70,000 included',
        deliverables: [
          'Reels ad campaign management',
          '5 Reels video creatives',
          'Trending audio integration',
          'Stories + Feed cross-promotion',
          'Influencer collaboration support',
          'Bi-weekly reports',
          'Up to 50,000 reach',
        ],
      },
      {
        id: 'ig-ecommerce',
        title: 'E-commerce Pro Package',
        description: 'Drive sales with Instagram Shopping and product tags',
        price: 250000,
        duration: '1 Month',
        ad_spend: '₦150,000 included',
        deliverables: [
          'Instagram Shop optimization',
          'Product catalog ads',
          'Collection ads setup',
          'Dynamic product ads',
          'Checkout integration',
          'Shopping tags management',
          'Conversion tracking',
          'Up to 100,000 reach',
        ],
      },
      {
        id: 'ig-brand',
        title: 'Brand Awareness Campaign',
        description: 'Build brand recognition with full Instagram presence',
        price: 400000,
        duration: '1 Month',
        ad_spend: '₦280,000 included',
        deliverables: [
          'Full platform coverage (Feed, Stories, Reels, Explore)',
          '15+ creative assets',
          'Branded content partnerships',
          'AR filter creation',
          'User-generated content strategy',
          'Dedicated creative team',
          'Up to 250,000 reach',
        ],
      },
    ],
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok Ads',
    platform: 'TikTok',
    description: 'Capture Gen Z and millennial audiences with viral short-form video content. Highest organic reach potential among social platforms.',
    image_url: 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=800&h=400&fit=crop',
    color: '#000000',
    stats: {
      monthly_users: '1.5 Billion',
      avg_cpc: '₦40-₦150',
      avg_cpm: '₦600-₦1,500',
      engagement_rate: '5-15%',
    },
    packages: [
      {
        id: 'tt-starter',
        title: 'In-Feed Starter',
        description: 'Get started with TikTok In-Feed ads',
        price: 75000,
        duration: '1 Month',
        ad_spend: '₦50,000 included',
        deliverables: [
          'In-Feed ad campaign setup',
          '3 video creatives (15-60 sec)',
          'Trending sound integration',
          'Basic audience targeting',
          'Performance tracking',
          'Weekly reports',
          'Up to 25,000 views',
        ],
      },
      {
        id: 'tt-spark',
        title: 'Spark Ads Package',
        description: 'Boost organic content with Spark Ads for authentic reach',
        price: 150000,
        duration: '1 Month',
        ad_spend: '₦100,000 included',
        deliverables: [
          'Spark Ads setup & management',
          '5 boosted videos',
          'Creator content amplification',
          'Native look & feel optimization',
          'Interest-based targeting',
          'Comment management',
          'Bi-weekly optimization',
          'Up to 75,000 views',
        ],
      },
      {
        id: 'tt-viral',
        title: 'Viral Campaign Package',
        description: 'Designed for maximum viral potential and engagement',
        price: 300000,
        duration: '1 Month',
        ad_spend: '₦200,000 included',
        deliverables: [
          'Multi-format campaign (In-Feed + TopView)',
          '10 video creatives',
          'Trend jacking strategy',
          'Hashtag challenge participation',
          'Creator partnership coordination',
          'Daily optimization',
          'Real-time trend monitoring',
          'Up to 200,000 views',
        ],
      },
      {
        id: 'tt-branded',
        title: 'Branded Hashtag Challenge',
        description: 'Create your own viral challenge with branded hashtag',
        price: 500000,
        duration: '6 Days Campaign',
        ad_spend: '₦350,000 included',
        deliverables: [
          'Custom branded hashtag',
          'Challenge concept & strategy',
          'Official challenge page',
          'Creator seeding (5+ creators)',
          'In-Feed promotion',
          'Music/sound creation',
          'UGC management',
          'Up to 500,000+ views',
        ],
      },
    ],
  },
  snapchat: {
    id: 'snapchat',
    name: 'Snapchat Ads',
    platform: 'Snapchat',
    description: 'Connect with young audiences (13-34 age group) through immersive AR experiences, vertical video, and story ads.',
    image_url: 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/cdbi8ulp_snapchat.png',
    color: '#FFFC00',
    stats: {
      monthly_users: '750 Million',
      avg_cpc: '₦45-₦180',
      avg_cpm: '₦700-₦1,800',
      engagement_rate: '2-5%',
    },
    packages: [
      {
        id: 'snap-starter',
        title: 'Snap Ads Starter',
        description: 'Entry-level Snapchat advertising with Snap Ads',
        price: 55000,
        duration: '1 Month',
        ad_spend: '₦30,000 included',
        deliverables: [
          'Single Image/Video Snap Ads',
          '3 creative variations',
          'Swipe-up action setup',
          'Demographic targeting',
          'Basic pixel tracking',
          'Weekly performance report',
          'Up to 20,000 impressions',
        ],
      },
      {
        id: 'snap-story',
        title: 'Story Ads Package',
        description: 'Full-screen Story Ads for deeper engagement',
        price: 120000,
        duration: '1 Month',
        ad_spend: '₦75,000 included',
        deliverables: [
          'Story Ads (3-20 images/videos)',
          'Branded tile design',
          'Attachment page setup',
          'Interest-based targeting',
          'Swipe-up conversions',
          'Bi-weekly optimization',
          'Up to 60,000 impressions',
        ],
      },
      {
        id: 'snap-collection',
        title: 'Collection Ads Package',
        description: 'Showcase products with shoppable Collection Ads',
        price: 200000,
        duration: '1 Month',
        ad_spend: '₦130,000 included',
        deliverables: [
          'Collection Ads setup',
          'Product catalog integration',
          '4 featured products per ad',
          'Dynamic retargeting',
          'Tappable product tiles',
          'Conversion optimization',
          'Up to 100,000 impressions',
        ],
      },
      {
        id: 'snap-ar',
        title: 'AR Lens Campaign',
        description: 'Create immersive AR experiences with branded lenses',
        price: 450000,
        duration: '1 Month',
        ad_spend: '₦300,000 included',
        deliverables: [
          'Custom AR Lens creation',
          'Face lens OR World lens',
          'Branded elements integration',
          'Lens promotion campaign',
          'Engagement analytics',
          'Lens sharing features',
          'Premium placement',
          'Up to 300,000 lens plays',
        ],
      },
    ],
  },
  google: {
    id: 'google',
    name: 'Google Ads',
    platform: 'Google',
    description: 'Dominate search results, display network, and YouTube. Best for intent-based marketing when users are actively searching.',
    image_url: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=800&h=400&fit=crop',
    color: '#4285F4',
    stats: {
      monthly_users: '8.5B searches/day',
      avg_cpc: '₦100-₦500',
      avg_cpm: '₦300-₦1,000',
      engagement_rate: '2-5% CTR',
    },
    packages: [
      {
        id: 'google-search',
        title: 'Search Ads Starter',
        description: 'Get found when customers search for your products/services',
        price: 100000,
        duration: '1 Month',
        ad_spend: '₦60,000 included',
        deliverables: [
          'Search campaign setup',
          'Keyword research (50+ keywords)',
          '5 ad groups',
          '10 responsive search ads',
          'Negative keyword management',
          'Conversion tracking',
          'Weekly optimization',
          'Monthly report',
        ],
      },
      {
        id: 'google-display',
        title: 'Display Network Package',
        description: 'Reach customers across millions of websites',
        price: 180000,
        duration: '1 Month',
        ad_spend: '₦120,000 included',
        deliverables: [
          'Display campaign setup',
          '10 banner designs (multiple sizes)',
          'Responsive display ads',
          'Audience targeting',
          'Placement optimization',
          'Remarketing setup',
          'View-through tracking',
          'Bi-weekly reports',
        ],
      },
      {
        id: 'google-youtube',
        title: 'YouTube Ads Package',
        description: 'Video advertising on the world\'s largest video platform',
        price: 250000,
        duration: '1 Month',
        ad_spend: '₦170,000 included',
        deliverables: [
          'YouTube campaign setup',
          'Video ad optimization',
          'TrueView In-Stream ads',
          'Bumper ads (6 sec)',
          'Discovery ads',
          'Channel targeting',
          'Audience lists creation',
          'View & engagement reports',
        ],
      },
      {
        id: 'google-full',
        title: 'Full Google Suite',
        description: 'Comprehensive Google Ads management across all networks',
        price: 500000,
        duration: '1 Month',
        ad_spend: '₦350,000 included',
        deliverables: [
          'Search + Display + YouTube',
          'Performance Max campaigns',
          '100+ keywords managed',
          '20+ ad creatives',
          'Shopping ads (if applicable)',
          'App campaigns (if applicable)',
          'Advanced audience strategies',
          'Dedicated account manager',
          'Weekly strategy calls',
        ],
      },
    ],
  },
  whatsapp: {
    id: 'whatsapp',
    name: 'WhatsApp Business Ads',
    platform: 'WhatsApp',
    description: 'Direct customer communication through Click-to-WhatsApp ads. Perfect for customer service, lead generation, and direct sales.',
    image_url: 'https://images.unsplash.com/photo-1633354931133-27ac1ee5d853?w=800&h=400&fit=crop',
    color: '#25D366',
    stats: {
      monthly_users: '2 Billion',
      avg_cpc: '₦30-₦100',
      avg_cpm: '₦400-₦1,200',
      engagement_rate: '45-60% open rate',
    },
    packages: [
      {
        id: 'wa-starter',
        title: 'Click-to-Chat Starter',
        description: 'Start conversations with Click-to-WhatsApp ads',
        price: 45000,
        duration: '1 Month',
        ad_spend: '₦25,000 included',
        deliverables: [
          'Click-to-WhatsApp ad setup',
          'WhatsApp Business optimization',
          '3 ad creatives',
          'Quick reply templates',
          'Welcome message setup',
          'Basic automation',
          'Weekly conversation report',
          'Up to 500 conversations',
        ],
      },
      {
        id: 'wa-business',
        title: 'Business Messaging Package',
        description: 'Full WhatsApp Business integration with catalog',
        price: 100000,
        duration: '1 Month',
        ad_spend: '₦60,000 included',
        deliverables: [
          'Full catalog setup',
          'Click-to-WhatsApp campaigns',
          '5 ad creatives',
          'Product messaging templates',
          'Order notification setup',
          'Chat flow automation',
          'CRM integration support',
          'Up to 1,500 conversations',
        ],
      },
      {
        id: 'wa-broadcast',
        title: 'Broadcast Campaign Package',
        description: 'Reach existing customers with broadcast messages',
        price: 180000,
        duration: '1 Month',
        ad_spend: '₦100,000 included',
        deliverables: [
          'Broadcast list management',
          'Message template approval',
          'Marketing message campaigns',
          'Utility message setup',
          'Opt-in management',
          'Delivery analytics',
          'Up to 5,000 messages',
          'A/B testing',
        ],
      },
      {
        id: 'wa-enterprise',
        title: 'WhatsApp API Enterprise',
        description: 'Full WhatsApp Business API integration',
        price: 350000,
        duration: '1 Month',
        ad_spend: '₦200,000 included',
        deliverables: [
          'WhatsApp Business API setup',
          'Custom chatbot development',
          'Multi-agent support',
          'Advanced automation flows',
          'Payment integration',
          'Order tracking messages',
          'Priority support',
          'Unlimited conversations',
          'Custom reporting dashboard',
        ],
      },
    ],
  },
};

export const DigitalAdDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addItem } = useCartStore();
  const [platform, setPlatform] = useState(null);

  useEffect(() => {
    if (id && PLATFORM_DATA[id]) {
      setPlatform(PLATFORM_DATA[id]);
    } else {
      toast.error('Platform not found');
      navigate('/digital-ads');
    }
  }, [id, navigate]);

  const handleBookPackage = (pkg) => {
    if (!user) {
      toast.error('Please sign in to book a package');
      navigate('/login');
      return;
    }

    addItem({
      influencerId: `digital-${platform.id}`,
      influencerName: platform.name,
      influencerHandle: platform.platform,
      influencerImage: platform.image_url,
      packageId: pkg.id,
      packageTitle: pkg.title,
      price: pkg.price,
      deliverables: pkg.deliverables,
      turnaround: pkg.duration,
      listingType: 'digital-ad',
    });

    toast.success('Package added to cart!');
    navigate('/cart');
  };

  if (!platform) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="digital-ad-detail-page">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/5 to-accent/5 py-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-full bg-accent/5 transform skew-x-12 origin-top-right"></div>
        
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col items-center text-center mb-8">
            {/* Platform Image */}
            <div className="w-full max-w-3xl mb-6 rounded-lg overflow-hidden shadow-2xl">
              <img
                src={platform.image_url}
                alt={platform.name}
                className="w-full h-64 object-cover"
              />
            </div>

            <Badge 
              className="text-white mb-4 text-lg px-4 py-1"
              style={{ backgroundColor: platform.color }}
            >
              {platform.platform}
            </Badge>
            <h1 className="text-4xl font-bold text-foreground mb-2">{platform.name}</h1>
            <p className="text-muted-foreground max-w-2xl mb-6">{platform.description}</p>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl">
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-sm font-bold text-foreground">{platform.stats.monthly_users}</p>
                  <p className="text-xs text-muted-foreground">Monthly Users</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <Target className="h-6 w-6 mx-auto mb-2 text-accent" />
                  <p className="text-sm font-bold text-foreground">{platform.stats.avg_cpc}</p>
                  <p className="text-xs text-muted-foreground">Avg. CPC</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-sm font-bold text-foreground">{platform.stats.avg_cpm}</p>
                  <p className="text-xs text-muted-foreground">Avg. CPM</p>
                </CardContent>
              </Card>
              <Card className="border-2">
                <CardContent className="p-4 text-center">
                  <TrendingUp className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                  <p className="text-sm font-bold text-foreground">{platform.stats.engagement_rate}</p>
                  <p className="text-xs text-muted-foreground">Engagement</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              {platform.name} Packages
            </h2>
            <p className="text-lg text-muted-foreground">Choose the perfect package for your advertising goals</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {platform.packages.map((pkg) => (
              <Card
                key={pkg.id}
                className="border-2 hover:shadow-xl hover:-translate-y-1 transition-all"
                data-testid={`package-${pkg.id}`}
              >
                <CardContent className="p-6">
                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-xl font-bold text-foreground">{pkg.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {pkg.ad_spend}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{pkg.description}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-3xl font-bold text-primary">{formatPrice(pkg.price)}</p>
                    <p className="text-sm text-muted-foreground flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {pkg.duration}
                    </p>
                  </div>

                  <div className="mb-4 space-y-2">
                    <p className="text-sm font-semibold text-foreground">What's included:</p>
                    {pkg.deliverables.map((item, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>

                  <Button
                    onClick={() => handleBookPackage(pkg)}
                    className="w-full bg-accent hover:bg-accent/90 text-white font-semibold"
                    data-testid={`book-button-${pkg.id}`}
                  >
                    Book This Package
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
