import { Link } from 'react-router-dom';
import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, MapPin, Monitor, Film, CheckCircle, Shield, Scale, Star } from 'lucide-react';

export const HomePage = () => {
  const { language } = useLanguageStore();

  const categories = [
    {
      icon: Users,
      title: t('cat.influencers', language),
      desc: t('cat.influencers.desc', language),
      link: '/influencers',
      color: 'bg-blue-50 text-blue-700',
    },
    {
      icon: MapPin,
      title: t('cat.billboards', language),
      desc: t('cat.billboards.desc', language),
      link: '/billboards',
      color: 'bg-amber-50 text-amber-700',
    },
    {
      icon: Monitor,
      title: t('cat.digitalads', language),
      desc: t('cat.digitalads.desc', language),
      link: '/digital-ads',
      color: 'bg-green-50 text-green-700',
    },
    {
      icon: Film,
      title: t('cat.kannywood', language),
      desc: t('cat.kannywood.desc', language),
      link: '/kannywood',
      color: 'bg-purple-50 text-purple-700',
    },
  ];

  const trustFeatures = [
    {
      icon: CheckCircle,
      title: t('trust.verified', language),
      desc: t('trust.verified.desc', language),
    },
    {
      icon: Shield,
      title: t('trust.escrow', language),
      desc: t('trust.escrow.desc', language),
    },
    {
      icon: Scale,
      title: t('trust.dispute', language),
      desc: t('trust.dispute.desc', language),
    },
  ];

  const testimonials = [
    {
      name: 'NaijaComply',
      role: 'Licensing & Compliance Services',
      rating: 5,
      text: 'Adlinka helped us reach more businesses needing licensing support. The influencer network is impressive and professional.',
      avatar: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&h=100&fit=crop',
    },
    {
      name: 'Pejull Digital',
      role: 'Web Development Company',
      rating: 5,
      text: 'We used Adlinka billboards to promote our services across Kano. The results exceeded our expectations - great ROI!',
      avatar: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=100&h=100&fit=crop',
    },
    {
      name: 'Relo',
      role: 'Digital Payment Solutions',
      rating: 5,
      text: 'The digital ads placement through Adlinka gave us massive visibility. Transparent pricing and excellent support team.',
      avatar: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=100&h=100&fit=crop',
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="home-page">
      {/* Hero Section */}
      <section
        className="relative bg-gradient-to-br from-background via-background to-accent/5 py-20 md:py-32 overflow-hidden"
        data-testid="hero-section"
      >
        {/* Diagonal accent stripe - letterhead inspired */}
        <div className="absolute top-0 right-0 w-96 h-full bg-accent/10 transform skew-x-12 origin-top-right"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-4xl mx-auto space-y-6">
            <Badge className="bg-accent/10 text-accent border-accent/20" data-testid="hero-badge">
              Trusted by 500+ Northern Nigerian businesses
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight">
              {t('hero.title', language)}
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('hero.subtitle', language)}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link to="/influencers">
                <Button
                  size="lg"
                  className="bg-primary hover:bg-primary/90 text-white font-medium h-12 px-8"
                  data-testid="hero-cta-influencers"
                >
                  {t('hero.cta1', language)}
                </Button>
              </Link>
              <Link to="/billboards">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/5 h-12 px-8"
                  data-testid="hero-cta-billboards"
                >
                  {t('hero.cta2', language)}
                </Button>
              </Link>
              <Link to="/consultation">
                <Button
                  size="lg"
                  className="bg-accent hover:bg-accent/90 text-foreground font-medium h-12 px-8"
                  data-testid="hero-cta-consultation"
                >
                  {t('hero.cta3', language)}
                </Button>
              </Link>
            </div>
            
            {/* App Store Download Buttons */}
            <div className="flex flex-col items-center gap-3 pt-6">
              <p className="text-sm text-muted-foreground">Download our mobile app</p>
              <div className="flex flex-row items-center justify-center gap-4">
                <a 
                  href="https://apps.apple.com/us/app/adlinka/id6761537846" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  data-testid="app-store-link"
                  className="transition-transform hover:scale-105"
                >
                  <img 
                    src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" 
                    alt="Download on the App Store" 
                    className="h-10"
                  />
                </a>
                <a 
                  href="https://play.google.com/store/apps/details?id=com.adlinka.app" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  data-testid="play-store-link"
                  className="transition-transform hover:scale-105"
                >
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg" 
                    alt="Get it on Google Play" 
                    className="h-10"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-card" data-testid="categories-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Explore Advertising Inventory
            </h2>
            <p className="text-lg text-muted-foreground">Find the perfect match for your campaign</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <Link to={cat.link} key={idx}>
                  <Card
                    className="group hover:shadow-lg hover:-translate-y-1 cursor-pointer border-2 h-full"
                    data-testid={`category-card-${idx}`}
                  >
                    <CardContent className="p-6 space-y-3">
                      <div className={`w-12 h-12 rounded-lg ${cat.color} flex items-center justify-center`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-bold text-foreground">{cat.title}</h3>
                      <p className="text-sm text-muted-foreground">{cat.desc}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-muted/30" data-testid="trust-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
              {t('trust.title', language)}
            </h2>
            <p className="text-lg text-muted-foreground">Built for transparency and security</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {trustFeatures.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="text-center space-y-3" data-testid={`trust-feature-${idx}`}>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-card" data-testid="testimonials-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Trusted by Advertisers</h2>
            <p className="text-lg text-muted-foreground">See what our clients say</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {testimonials.map((testimonial, idx) => (
              <Card key={idx} className="border-2" data-testid={`testimonial-${idx}`}>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center space-x-1">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-amber-500 text-amber-500" />
                    ))}
                  </div>
                  <p className="text-muted-foreground">"{testimonial.text}"</p>
                  <div className="flex items-center space-x-3">
                    <img
                      src={testimonial.avatar}
                      alt={testimonial.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-white" data-testid="cta-section">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold">Ready to Launch Your Campaign?</h2>
          <p className="text-lg opacity-90">
            Join hundreds of businesses reaching Northern Nigerian audiences through verified, trusted channels.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-foreground font-medium h-12 px-8"
                data-testid="cta-signup"
              >
                Create Free Account
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                size="lg"
                variant="outline"
                className="border-white text-white hover:bg-white/10 h-12 px-8"
                data-testid="cta-contact"
              >
                {t('common.contactUs', language)}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Company Ownership & Legal Section */}
      <section className="py-12 bg-slate-900 text-white" data-testid="company-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Company Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Adlinka</h3>
                  <p className="text-sm text-slate-400">Nigeria's Premier Advertising Marketplace</p>
                </div>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700">
                <p className="text-slate-300 leading-relaxed">
                  <strong className="text-white">Adlinka</strong> is a product and registered trademark of{' '}
                  <strong className="text-orange-400">Lightban Technology Ltd</strong>, a Nigerian technology company 
                  specializing in digital advertising solutions and marketplace platforms. Lightban Technology Ltd 
                  is the parent company and sole owner of the Adlinka brand, platform, and all associated services.
                </p>
              </div>
            </div>

            {/* Legal & Registration Info */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Company Registration
              </h4>
              <div className="grid gap-3">
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Parent Company</p>
                  <p className="text-white font-semibold">Lightban Technology Ltd</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Product / Brand</p>
                  <p className="text-white font-semibold">Adlinka - Advertising Marketplace</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Headquarters</p>
                  <p className="text-white font-semibold">Kano, Nigeria</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer copyright */}
          <div className="mt-8 pt-6 border-t border-slate-700 text-center">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} <strong className="text-white">Adlinka</strong> — 
              A product of <strong className="text-orange-400">Lightban Technology Ltd</strong>. All rights reserved.
            </p>
            <p className="text-slate-500 text-xs mt-2">
              Lightban Technology Ltd is the registered owner and operator of Adlinka (www.adlinka.com)
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
