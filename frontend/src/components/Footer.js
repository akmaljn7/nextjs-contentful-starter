import { Link } from 'react-router-dom';
import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { MessageCircle } from 'lucide-react';

export const Footer = () => {
  const { language } = useLanguageStore();

  return (
    <footer className="bg-stone-50 border-t mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-xl">L</span>
              </div>
              <span className="font-bold text-lg text-foreground">Lightban</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Northern Nigeria's trusted advertising marketplace.
            </p>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/about"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="footer-about-link"
                >
                  {t('footer.about', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/pricing"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="footer-pricing-link"
                >
                  {t('footer.pricing', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/faq"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="footer-faq-link"
                >
                  {t('footer.faq', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/contact"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="footer-contact-link"
                >
                  {t('footer.contact', language)}
                </Link>
              </li>
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Categories</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/influencers"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="footer-influencers-link"
                >
                  {t('cat.influencers', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/billboards"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="footer-billboards-link"
                >
                  {t('cat.billboards', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/digital-ads"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="footer-digitalads-link"
                >
                  {t('cat.digitalads', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/kannywood"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="footer-kannywood-link"
                >
                  {t('cat.kannywood', language)}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-foreground mb-3">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/terms"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="footer-terms-link"
                >
                  {t('footer.terms', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/privacy"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  data-testid="footer-privacy-link"
                >
                  {t('footer.privacy', language)}
                </Link>
              </li>
              <li>
                <Link
                  to="/cookies"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link
                  to="/refund-policy"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* WhatsApp CTA */}
        <div className="mt-8 pt-8 border-t">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <p className="text-sm text-muted-foreground">{t('footer.copyright', language)}</p>
            <a
              href="https://wa.me/2348012345678"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-sm font-medium text-primary hover:text-primary/80"
              data-testid="whatsapp-link"
            >
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp Support</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
