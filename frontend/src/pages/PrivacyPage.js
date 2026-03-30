import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { Card, CardContent } from '@/components/ui/card';

export const PrivacyPage = () => {
  const { language } = useLanguageStore();

  return (
    <div className="min-h-screen bg-background" data-testid="privacy-page">
      <div className="bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">{t('footer.privacy', language)}</h1>
          <p className="text-muted-foreground">Last updated: January 2026</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardContent className="p-8 prose max-w-none">
            <p>
              Adlinka Ads Network ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your information when you use our Platform,
              in compliance with the Nigeria Data Protection Act 2023.
            </p>

            <h2>1. Information We Collect</h2>
            <p><strong>Account Information:</strong></p>
            <ul>
              <li>Name, email, phone number</li>
              <li>Business name and registration details (for Suppliers)</li>
              <li>Identity documents for verification (securely stored)</li>
            </ul>
            <p><strong>Transaction Information:</strong></p>
            <ul>
              <li>Order details, payment information (processed by Paystack)</li>
              <li>Messages between Advertisers and Suppliers</li>
            </ul>
            <p><strong>Technical Information:</strong></p>
            <ul>
              <li>IP address, browser type, device information</li>
              <li>Usage data (pages visited, time spent, interactions)</li>
            </ul>

            <h2>2. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul>
              <li>Provide and maintain the Platform</li>
              <li>Process transactions and send notifications</li>
              <li>Verify Supplier identity and prevent fraud</li>
              <li>Resolve disputes and provide customer support</li>
              <li>Improve the Platform through analytics</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2>3. Legal Basis for Processing</h2>
            <p>We process your data based on:</p>
            <ul>
              <li><strong>Contract performance:</strong> To fulfill our services</li>
              <li><strong>Consent:</strong> For marketing communications (opt-in)</li>
              <li><strong>Legal obligation:</strong> KYC/AML compliance, tax reporting</li>
              <li><strong>Legitimate interest:</strong> Fraud prevention, platform improvement</li>
            </ul>

            <h2>4. Information Sharing</h2>
            <p>We share your information with:</p>
            <ul>
              <li><strong>Transaction parties:</strong> Contact details shared between Advertiser and Supplier for order fulfillment</li>
              <li><strong>Service providers:</strong> Paystack (payments), Termii (SMS/messaging), cloud hosting</li>
              <li><strong>Legal authorities:</strong> If required by law or to protect rights</li>
            </ul>
            <p>We do not sell your personal data to third parties.</p>

            <h2>5. Data Security</h2>
            <p>
              We implement industry-standard security measures including encryption, secure servers, and access
              controls. However, no system is 100% secure. You are responsible for protecting your account
              credentials.
            </p>

            <h2>6. Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to provide services.
              Transaction records are kept for 7 years for legal and accounting purposes. You may request deletion
              of your account, subject to legal retention requirements.
            </p>

            <h2>7. Your Rights</h2>
            <p>Under the Nigeria Data Protection Act, you have the right to:</p>
            <ul>
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your data ("right to be forgotten")</li>
              <li><strong>Portability:</strong> Receive your data in a structured format</li>
              <li><strong>Object:</strong> Opt out of marketing communications</li>
              <li><strong>Lodge complaints:</strong> Contact the Nigeria Data Protection Commission</li>
            </ul>
            <p>To exercise these rights, contact us at privacy@adlinka.ng.</p>

            <h2>8. Cookies and Tracking</h2>
            <p>
              We use cookies for session management, preferences (e.g., language), and analytics. You can disable
              cookies in your browser, but some Platform features may not work properly.
            </p>

            <h2>9. Third-Party Links</h2>
            <p>
              The Platform may contain links to external sites. We are not responsible for the privacy practices of
              third-party websites.
            </p>

            <h2>10. Children's Privacy</h2>
            <p>
              The Platform is not intended for users under 18 years of age. We do not knowingly collect data from
              minors.
            </p>

            <h2>11. International Data Transfers</h2>
            <p>
              Your data may be processed outside Nigeria by service providers (e.g., cloud hosting). We ensure
              adequate safeguards are in place for such transfers.
            </p>

            <h2>12. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant changes via
              email or Platform notice.
            </p>

            <h2>13. Contact Us</h2>
            <p>
              For privacy-related questions or to exercise your rights, contact our Data Protection Officer at
              privacy@adlinka.ng or via WhatsApp at +234 801 234 5678.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
