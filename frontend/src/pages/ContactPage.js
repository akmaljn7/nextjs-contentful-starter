import { useState, useEffect } from 'react';
import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, MessageCircle, Phone, MapPin, Clock } from 'lucide-react';
import api from '@/lib/api';

export const ContactPage = () => {
  const { language } = useLanguageStore();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings');
        setSettings(response.data);
      } catch (error) {
        console.log('Using default contact settings');
      }
    };
    fetchSettings();
  }, []);

  // Extract phone number for WhatsApp link
  const phoneNumber = settings?.contact_phone?.replace(/[^0-9]/g, '') || '2348080000805';
  const whatsappLink = `https://wa.me/${phoneNumber.startsWith('234') ? phoneNumber : '234' + phoneNumber}`;

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
                href={whatsappLink}
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
              <a href={`mailto:${settings?.contact_email || 'info@lightban.com'}`} data-testid="email-contact-button">
                <Button variant="outline" className="border-primary text-primary">
                  {settings?.contact_email || 'info@lightban.com'}
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Contact Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Call Us</h3>
                  <p className="text-muted-foreground">{settings?.contact_phone || '+234 800 000 0001'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-1">Visit Us</h3>
                  <p className="text-muted-foreground">{settings?.office_address || 'No 671, Zoo Road, Inec Street, Kano'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 border-2">
          <CardContent className="p-8">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-4">Office Hours</h3>
                <p className="text-muted-foreground text-lg">
                  {settings?.business_hours || 'Monday - Saturday: 8:00 AM - 5:00 PM'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Response time: Within 24 hours on business days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
