import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, TrendingUp, Users, Globe } from 'lucide-react';

// Platform data with real images and info
const AD_PLATFORMS = [
  {
    id: 'facebook',
    name: 'Facebook Ads',
    platform: 'Facebook',
    description: 'Reach over 2.9 billion monthly active users. Perfect for brand awareness, lead generation, and sales conversions.',
    image_url: 'https://images.unsplash.com/photo-1662070479020-73f77887c87c?w=600&h=400&fit=crop',
    color: '#1877F2',
    starting_price: 50000,
    features: ['Targeted audience reach', 'Multiple ad formats', 'Detailed analytics'],
    monthly_users: '2.9B',
    avg_cpc: '₦50-₦200',
  },
  {
    id: 'instagram',
    name: 'Instagram Ads',
    platform: 'Instagram',
    description: 'Visual-first advertising on the most engaging social platform. Ideal for fashion, lifestyle, and e-commerce brands.',
    image_url: 'https://images.unsplash.com/photo-1689852501130-e89d9e54aa41?w=600&h=400&fit=crop',
    color: '#E4405F',
    starting_price: 60000,
    features: ['Stories & Reels ads', 'Shopping integration', 'Influencer partnerships'],
    monthly_users: '2B',
    avg_cpc: '₦60-₦250',
  },
  {
    id: 'tiktok',
    name: 'TikTok Ads',
    platform: 'TikTok',
    description: 'Capture Gen Z and millennial audiences with short-form video ads. Highest engagement rates in social media.',
    image_url: 'https://images.unsplash.com/photo-1620396748669-46bd3128ccce?w=600&h=400&fit=crop',
    color: '#000000',
    starting_price: 75000,
    features: ['In-feed video ads', 'Branded hashtag challenges', 'Spark Ads'],
    monthly_users: '1.5B',
    avg_cpc: '₦40-₦150',
  },
  {
    id: 'snapchat',
    name: 'Snapchat Ads',
    platform: 'Snapchat',
    description: 'Connect with young audiences through immersive AR experiences and vertical video ads.',
    image_url: 'https://customer-assets.emergentagent.com/job_ads-kano/artifacts/cdbi8ulp_snapchat.png',
    color: '#FFFC00',
    starting_price: 55000,
    features: ['AR lens ads', 'Story ads', 'Spotlight ads'],
    monthly_users: '750M',
    avg_cpc: '₦45-₦180',
  },
  {
    id: 'google',
    name: 'Google Ads',
    platform: 'Google',
    description: 'Dominate search results and display network. Best for intent-based marketing and immediate conversions.',
    image_url: 'https://images.unsplash.com/photo-1628320281190-89b24da58b0f?w=600&h=400&fit=crop',
    color: '#4285F4',
    starting_price: 100000,
    features: ['Search ads', 'Display network', 'YouTube ads'],
    monthly_users: '8.5B searches/day',
    avg_cpc: '₦100-₦500',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business Ads',
    platform: 'WhatsApp',
    description: 'Direct customer communication with Click-to-WhatsApp ads. Perfect for customer service and direct sales.',
    image_url: 'https://images.unsplash.com/photo-1642724978500-c13b821afe04?w=600&h=400&fit=crop',
    color: '#25D366',
    starting_price: 45000,
    features: ['Click-to-chat ads', 'Business messaging', 'Catalog sharing'],
    monthly_users: '2B',
    avg_cpc: '₦30-₦100',
  },
];

export const DigitalAdsPage = () => {
  const { language } = useLanguageStore();

  return (
    <div className="min-h-screen bg-background" data-testid="digital-ads-page">
      {/* Header */}
      <div className="bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-4xl font-bold text-foreground mb-3">{t('cat.digitalads', language)}</h1>
          <p className="text-lg text-muted-foreground">{t('cat.digitalads.desc', language)}</p>
        </div>
      </div>

      {/* Platform Categories */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">Choose Your Advertising Platform</h2>
          <p className="text-lg text-muted-foreground">Professional ad management services across all major platforms</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {AD_PLATFORMS.map((platform) => (
            <Link to={`/digital-ads/${platform.id}`} key={platform.id}>
              <Card
                className="group hover:shadow-2xl hover:-translate-y-2 h-full border-2 transition-all duration-300"
                data-testid={`platform-card-${platform.id}`}
              >
                <CardContent className="p-0">
                  <div className="relative h-48 overflow-hidden rounded-t-lg">
                    <img
                      src={platform.image_url}
                      alt={platform.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <Badge 
                      className="absolute top-3 left-3 text-white border-0 font-semibold"
                      style={{ backgroundColor: platform.color }}
                    >
                      {platform.platform}
                    </Badge>
                    <Badge className="absolute top-3 right-3 bg-white/90 text-primary border-0">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                  
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-2">{platform.name}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{platform.description}</p>
                    </div>

                    {/* Features */}
                    <div className="space-y-2">
                      {platform.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center text-sm">
                          <CheckCircle className="h-4 w-4 mr-2 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <Users className="h-4 w-4 mr-1 text-accent" />
                        </div>
                        <p className="text-xs text-muted-foreground">Monthly Users</p>
                        <p className="text-sm font-semibold text-foreground">{platform.monthly_users}</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-1">
                          <TrendingUp className="h-4 w-4 mr-1 text-green-600" />
                        </div>
                        <p className="text-xs text-muted-foreground">Avg. CPC</p>
                        <p className="text-sm font-semibold text-foreground">{platform.avg_cpc}</p>
                      </div>
                    </div>

                    {/* Price & CTA */}
                    <div className="flex items-center justify-between pt-4 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Starting from</p>
                        <p className="text-xl font-bold text-primary">{formatPrice(platform.starting_price)}</p>
                        <p className="text-xs text-muted-foreground">/month</p>
                      </div>
                      <Button 
                        className="bg-accent hover:bg-accent/90 text-white font-semibold"
                        data-testid={`view-packages-${platform.id}`}
                      >
                        View Packages
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
