import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { Card, CardContent } from '@/components/ui/card';

export const AboutPage = () => {
  const { language } = useLanguageStore();

  return (
    <div className="min-h-screen bg-background" data-testid="about-page">
      <div className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">{t('footer.about', language)}</h1>
          <p className="text-lg text-muted-foreground">
            Northern Nigeria's trusted marketplace connecting advertisers with premium inventory
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <Card>
          <CardContent className="p-8 prose max-w-none">
            <h2 className="text-2xl font-bold text-foreground mb-4">Our Mission</h2>
            <p className="text-muted-foreground">
              Adlinka Ads Network was founded to solve a critical challenge in Northern Nigerian advertising: the
              lack of a trusted, transparent platform connecting advertisers with verified suppliers. We bring
              together influencers, billboard owners, Kannywood producers, and digital advertising services under
              one roof.
            </p>

            <h2 className="text-2xl font-bold text-foreground mb-4 mt-8">Why Trust Matters</h2>
            <p className="text-muted-foreground">
              Every supplier on our platform undergoes identity and business verification. We hold payments in
              escrow until deliverables are approved, protecting both advertisers and suppliers. Our dispute
              resolution team ensures fair outcomes when issues arise.
            </p>

            <h2 className="text-2xl font-bold text-foreground mb-4 mt-8">Who We Serve</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Small and medium businesses looking for cost-effective advertising</li>
              <li>Political campaigns needing regional reach</li>
              <li>Brands entering Northern Nigerian markets</li>
              <li>Influencers, billboard owners, and media professionals seeking steady work</li>
            </ul>

            <h2 className="text-2xl font-bold text-foreground mb-4 mt-8">Our Values</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Transparency:</strong> Clear pricing, no hidden fees</li>
              <li><strong>Security:</strong> Escrow payments and verified suppliers</li>
              <li><strong>Accessibility:</strong> Bilingual support (English & Hausa)</li>
              <li><strong>Fairness:</strong> Structured dispute resolution</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
