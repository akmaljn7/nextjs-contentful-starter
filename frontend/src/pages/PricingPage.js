import { useLanguageStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export const PricingPage = () => {
  const { language } = useLanguageStore();

  return (
    <div className="min-h-screen bg-background" data-testid="pricing-page">
      <div className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Transparent Pricing</h1>
          <p className="text-lg text-muted-foreground">Simple, fair platform fees. No hidden charges.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="border-2">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-foreground mb-2">Platform Fee</h2>
              <div className="flex items-baseline justify-center space-x-2">
                <span className="text-5xl font-bold text-primary">10%</span>
                <span className="text-muted-foreground">per transaction</span>
              </div>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Escrow Payment Protection</p>
                  <p className="text-sm text-muted-foreground">
                    Funds held securely until delivery is confirmed
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Dispute Resolution</p>
                  <p className="text-sm text-muted-foreground">Fair mediation by our expert team</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Verified Suppliers</p>
                  <p className="text-sm text-muted-foreground">All suppliers undergo identity verification</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Campaign Support</p>
                  <p className="text-sm text-muted-foreground">Guided campaign builder for beginners</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Bilingual Platform</p>
                  <p className="text-sm text-muted-foreground">Full English and Hausa support</p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 bg-stone-50 rounded-lg">
              <h3 className="font-bold text-foreground mb-2">Example</h3>
              <p className="text-sm text-muted-foreground mb-3">
                If you book an influencer post for ₦50,000:
              </p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Influencer payout:</span>
                  <span className="font-medium">₦45,000</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Platform fee (10%):</span>
                  <span className="font-medium">₦5,000</span>
                </div>
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="font-bold text-foreground">You pay:</span>
                  <span className="font-bold text-primary">₦50,000</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">No listing fees. No subscription charges.</p>
          <Button className="bg-primary hover:bg-primary/90" data-testid="get-started-button">
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};
