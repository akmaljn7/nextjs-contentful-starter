import { Link } from 'react-router-dom';
import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { MessageCircle, Mail, MapPin, Phone } from 'lucide-react';

export const Footer = () => {
  const { language } = useLanguageStore();

  return (
    <footer className="bg-primary text-white mt-16 relative overflow-hidden">
      {/* Orange diagonal accent - inspired by letterhead */}
      <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-accent via-orange-500 to-accent"></div>
      
      {/* Diagonal stripe design element */}
      <div className="absolute bottom-0 left-0 w-64 h-full bg-accent/10 transform -skew-x-12 origin-bottom-left"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand */}
          <div className="space-y-4">
            <img 
              src="https://customer-assets.emergentagent.com/job_ads-kano/artifacts/r3mtjzen_logo_no_background.png" 
              alt="Lightban Technology" 
              className="h-16 w-auto"
            />
            <p className="text-sm text-white/80">
              Northern Nigeria's trusted advertising marketplace.
            </p>
            
            {/* Contact Info */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4 text-accent" />
                <span>0808-000-0805</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-accent" />
                <span>lightbantechnologies@gmail.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4 text-accent" />
                <span>No 671, Zoo Road, Inec Street, Kano</span>
              </div>
            </div>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-white mb-4 text-lg">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/about"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                  data-testid="footer-about-link"
                >
                  {t('footer.about', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/pricing"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                  data-testid="footer-pricing-link"
                >
                  {t('footer.pricing', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                  data-testid="footer-faq-link"
                >
                  {t('footer.faq', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                  data-testid="footer-contact-link"
                >
                  {t('footer.contact', language)}
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-semibold text-white mb-4 text-lg">Categories</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/influencers"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                  data-testid="footer-influencers-link"
                >
                  {t('cat.influencers', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/billboards"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                  data-testid="footer-billboards-link"
                >
                  {t('cat.billboards', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/digital-ads"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                  data-testid="footer-digitalads-link"
                >
                  {t('cat.digitalads', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/kannywood"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                  data-testid="footer-kannywood-link"
                >
                  {t('cat.kannywood', language)}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-white mb-4 text-lg">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/terms"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                  data-testid="footer-terms-link"
                >
                  {t('footer.terms', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                  data-testid="footer-privacy-link"
                >
                  {t('footer.privacy', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/cookies"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/refund-policy"
                  className="text-sm text-white/80 hover:text-accent transition-colors"
                >
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <p className="text-sm text-white/70">{t('footer.copyright', language)}</p>
            <a
              href="https://wa.me/2348080000805"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
              data-testid="whatsapp-link"
            >
              <MessageCircle className="h-5 w-5" />
              <span>WhatsApp Support</span>
            </a>
          </div>
        </div>
      </div>
      
      {/* Bottom orange accent */}
      <div className="h-2 bg-gradient-to-r from-accent via-orange-500 to-accent"></div>
    </footer>
  );
};
