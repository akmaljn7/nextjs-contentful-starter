import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useCartStore } from '@/lib/store';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export const PaymentCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clearCart } = useCartStore();
  const [status, setStatus] = useState('verifying'); // verifying, success, failed
  const [paymentData, setPaymentData] = useState(null);

  const reference = searchParams.get('reference') || searchParams.get('trxref');

  useEffect(() => {
    if (reference) {
      verifyPayment();
    } else {
      setStatus('failed');
    }
  }, [reference]);

  const verifyPayment = async () => {
    try {
      const response = await api.get(`/payments/verify/${reference}`);
      
      if (response.data.status === 'success') {
        setStatus('success');
        setPaymentData(response.data);
        clearCart();
        toast.success('Payment successful!');
      } else {
        setStatus('failed');
        toast.error('Payment verification failed');
      }
    } catch (error) {
      console.error('Payment verification error:', error);
      setStatus('failed');
      toast.error('Failed to verify payment');
    }
  };

  const handleContinue = () => {
    if (status === 'success') {
      navigate('/dashboard');
    } else {
      navigate('/cart');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12" data-testid="payment-callback-page">
      <div className="max-w-md w-full px-4">
        <Card className="border-2">
          <CardContent className="p-8 text-center">
            {status === 'verifying' && (
              <>
                <div className="relative mx-auto w-20 h-20 mb-6">
                  <div className="absolute inset-0 bg-accent/20 rounded-full animate-ping"></div>
                  <div className="relative bg-accent rounded-full w-20 h-20 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 text-white animate-spin" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Verifying Payment...</h2>
                <p className="text-muted-foreground">Please wait while we confirm your payment</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="relative mx-auto w-20 h-20 mb-6">
                  <div className="relative bg-green-600 rounded-full w-20 h-20 flex items-center justify-center">
                    <CheckCircle className="h-10 w-10 text-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-green-600 mb-2">Payment Successful!</h2>
                <p className="text-muted-foreground mb-6">
                  Your payment has been processed successfully. Your order is now confirmed.
                </p>
                {paymentData && (
                  <div className="bg-muted/30 rounded-lg p-4 mb-6 text-left">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Reference:</span>
                      <span className="text-sm font-mono">{reference}</span>
                    </div>
                    {paymentData.amount && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Amount Paid:</span>
                        <span className="text-sm font-semibold">₦{paymentData.amount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
                <Button
                  onClick={handleContinue}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                  data-testid="continue-to-dashboard"
                >
                  Continue to Dashboard
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </>
            )}

            {status === 'failed' && (
              <>
                <div className="relative mx-auto w-20 h-20 mb-6">
                  <div className="relative bg-red-600 rounded-full w-20 h-20 flex items-center justify-center">
                    <XCircle className="h-10 w-10 text-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-red-600 mb-2">Payment Failed</h2>
                <p className="text-muted-foreground mb-6">
                  We couldn't verify your payment. Please try again or contact support if the issue persists.
                </p>
                <Button
                  onClick={handleContinue}
                  variant="outline"
                  className="w-full border-red-600 text-red-600 hover:bg-red-50 font-bold"
                  data-testid="return-to-cart"
                >
                  Return to Cart
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
