import '@/App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ScrollToTop } from '@/components/ScrollToTop';

// Pages
import { HomePage } from '@/pages/HomePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { InfluencersPage } from '@/pages/InfluencersPage';
import { InfluencerDetailPage } from '@/pages/InfluencerDetailPage';
import { BillboardsPage } from '@/pages/BillboardsPage';
import { DigitalAdsPage } from '@/pages/DigitalAdsPage';
import { KannywoodPage } from '@/pages/KannywoodPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AboutPage } from '@/pages/AboutPage';
import { PricingPage } from '@/pages/PricingPage';
import { ContactPage } from '@/pages/ContactPage';
import { FAQPage } from '@/pages/FAQPage';
import { TermsPage } from '@/pages/TermsPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { CartPage } from '@/pages/CartPage';
import { PlaceOrderPage } from '@/pages/PlaceOrderPage';
import { BillboardDetailPage } from '@/pages/BillboardDetailPage';
import { DigitalAdDetailPage } from '@/pages/DigitalAdDetailPage';
import { PaymentCallbackPage } from '@/pages/PaymentCallbackPage';
import { KannywoodDetailPage } from '@/pages/KannywoodDetailPage';
import { ConsultationPage } from '@/pages/ConsultationPage';

function App() {
  return (
    <ThemeProvider>
      <div className="App min-h-screen flex flex-col">
        <BrowserRouter>
          <ScrollToTop />
          <Header />
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/influencers" element={<InfluencersPage />} />
              <Route path="/influencers/:id" element={<InfluencerDetailPage />} />
              <Route path="/billboards" element={<BillboardsPage />} />
              <Route path="/digital-ads" element={<DigitalAdsPage />} />
              <Route path="/digital-ads/:id" element={<DigitalAdDetailPage />} />
              <Route path="/kannywood" element={<KannywoodPage />} />
              <Route path="/kannywood/:id" element={<KannywoodDetailPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/place-order" element={<PlaceOrderPage />} />
              <Route path="/payment/callback" element={<PaymentCallbackPage />} />
              <Route path="/consultation" element={<ConsultationPage />} />
              
              {/* Billboard detail route */}
              <Route path="/billboards/:id" element={<BillboardDetailPage />} />
              
              {/* Placeholder routes */}
              <Route path="/campaign-builder" element={<PlaceholderPage title="Campaign Builder" />} />
              <Route path="/cookies" element={<PlaceholderPage title="Cookie Policy" />} />
              <Route path="/refund-policy" element={<PlaceholderPage title="Refund Policy" />} />
              <Route path="*" element={<PlaceholderPage title="Page Not Found" />} />
            </Routes>
          </main>
          <Footer />
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </div>
    </ThemeProvider>
  );
}

// Simple placeholder component for incomplete pages
const PlaceholderPage = ({ title }) => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4 px-4">
      <h1 className="text-4xl font-bold text-foreground">{title}</h1>
      <p className="text-muted-foreground">This page is under construction</p>
    </div>
  </div>
);

export default App;
