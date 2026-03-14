import { useLanguageStore } from '@/lib/store';
import { t } from '@/lib/translations';
import { Card, CardContent } from '@/components/ui/card';

export const TermsPage = () => {
  const { language } = useLanguageStore();

  return (
    <div className="min-h-screen bg-stone-50" data-testid="terms-page">
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">{t('footer.terms', language)}</h1>
          <p className="text-muted-foreground">Last updated: January 2026</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <CardContent className="p-8 prose max-w-none">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using Lightban Ads Network ("the Platform"), you agree to be bound by these Terms of
              Service. If you do not agree, please do not use the Platform.
            </p>

            <h2>2. Definitions</h2>
            <p>
              <strong>Advertiser:</strong> A user seeking advertising services.<br />
              <strong>Supplier:</strong> A verified provider of advertising inventory (influencers, billboard owners,
              Kannywood producers, digital ad agencies).<br />
              <strong>Order:</strong> A transaction between an Advertiser and a Supplier facilitated by the Platform.
            </p>

            <h2>3. Platform Services</h2>
            <p>
              Lightban Ads Network is a marketplace connecting Advertisers with Suppliers. We do not provide
              advertising services directly. The Platform facilitates:
            </p>
            <ul>
              <li>Listing and discovery of advertising inventory</li>
              <li>Payment processing and escrow holding</li>
              <li>Order management and communication</li>
              <li>Dispute resolution</li>
            </ul>

            <h2>4. User Accounts</h2>
            <p>
              You must create an account to use the Platform. You are responsible for maintaining the confidentiality
              of your credentials and for all activities under your account.
            </p>

            <h2>5. Supplier Verification</h2>
            <p>
              Suppliers must undergo identity verification (individuals) or business verification (companies). The
              Platform reserves the right to reject listings that do not meet quality standards or violate policies.
            </p>

            <h2>6. Payment Terms</h2>
            <p>
              All payments are processed through our partner Paystack. The Platform charges a 10% fee on all
              transactions. Payments are held in escrow until the Advertiser approves delivery or a dispute is
              resolved.
            </p>

            <h2>7. Dispute Resolution</h2>
            <p>
              If an Advertiser is not satisfied with a delivery, they may open a dispute within 7 days. Our mediation
              team will review evidence and issue a binding decision. Refunds may be issued for justified disputes.
            </p>

            <h2>8. Prohibited Activities</h2>
            <p>Users may not:</p>
            <ul>
              <li>Post false or misleading listings</li>
              <li>Circumvent the Platform to avoid fees</li>
              <li>Engage in fraudulent transactions</li>
              <li>Harass or threaten other users</li>
              <li>Use the Platform for illegal purposes</li>
            </ul>

            <h2>9. Intellectual Property</h2>
            <p>
              The Platform and its original content are protected by copyright and other intellectual property laws.
              Suppliers retain rights to their own content but grant the Platform a license to display it.
            </p>

            <h2>10. Limitation of Liability</h2>
            <p>
              Lightban Ads Network is not liable for losses arising from Supplier non-performance, quality issues, or
              disputes. Our total liability is limited to the platform fee paid for the specific transaction.
            </p>

            <h2>11. Termination</h2>
            <p>
              We may suspend or terminate accounts that violate these Terms. Users may close their accounts at any
              time, subject to fulfilling outstanding orders.
            </p>

            <h2>12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Federal Republic of Nigeria. Disputes will be resolved in
              courts of competent jurisdiction in Nigeria.
            </p>

            <h2>13. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Platform after changes constitutes
              acceptance.
            </p>

            <h2>14. Contact</h2>
            <p>
              For questions about these Terms, contact us at legal@lightban.ng or via WhatsApp at +234 801 234 5678.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
