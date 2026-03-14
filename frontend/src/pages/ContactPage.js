import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, MessageCircle } from 'lucide-react';

export const ContactPage = () => {
  const { language } = useLanguageStore();

  return (
    <div className="min-h-screen bg-background" data-testid="contact-page">
      <div className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">{t('footer.contact', language)}</h1>
          <p className="text-lg text-muted-foreground">We're here to help. Reach out anytime.</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-2">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <MessageCircle className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">WhatsApp Support</h3>
              <p className="text-muted-foreground">Chat with us directly for quick assistance</p>
              <a
                href="https://wa.me/2348012345678"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="whatsapp-contact-button"
              >
                <Button className="bg-primary hover:bg-primary/90">Message on WhatsApp</Button>
              </a>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                <Mail className="h-8 w-8 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Email Us</h3>
              <p className="text-muted-foreground">Send us a detailed message</p>
              <a href="mailto:support@lightban.ng" data-testid="email-contact-button">
                <Button variant="outline" className="border-primary text-primary">support@lightban.ng</Button>
              </a>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 border-2">
          <CardContent className="p-8">
            <h3 className="text-xl font-bold text-foreground mb-4">Office Hours</h3>
            <div className="space-y-2 text-muted-foreground">
              <p>Monday - Friday: 8:00 AM - 6:00 PM WAT</p>
              <p>Saturday: 9:00 AM - 2:00 PM WAT</p>
              <p>Sunday: Closed</p>
            </div>
            <div className="mt-6 p-4 bg-stone-50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Location:</strong> Kano, Nigeria
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
