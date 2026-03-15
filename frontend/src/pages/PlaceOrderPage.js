import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore, useAuthStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';
import api from '@/lib/api';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export const PlaceOrderPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, getTotalAmount, clearCart } = useCartStore();
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const [orderIds, setOrderIds] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!user || items.length === 0) {
      navigate('/cart');
    }
  }, [user, items, navigate]);

  useEffect(() => {
    let interval;
    if (showWaitingModal && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [showWaitingModal, countdown]);

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlaceOrder = async () => {
    setIsProcessing(true);
    try {
      // Create orders for each cart item
      const orderPromises = items.map((item) =>
        api.post('/orders', {
          listing_type: item.listingType || 'influencer',
          listing_id: item.influencerId,
          package_details: {
            packageId: item.packageId,
            packageTitle: item.packageTitle,
            deliverables: item.deliverables,
            turnaround: item.turnaround,
          },
          total_amount: item.price + item.price * 0.1,
        })
      );

      const responses = await Promise.all(orderPromises);
      const createdOrderIds = responses.map((res) => res.data.id);
      setOrderIds(createdOrderIds);

      // Show waiting modal
      setShowWaitingModal(true);
      setCountdown(300);
    } catch (error) {
      toast.error('Failed to place order. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleSkipToPayment = async () => {
    // Proceed to payment without waiting
    setShowWaitingModal(false);
    await processPayment();
  };

  const processPayment = async () => {
    try {
      // Mock payment for all orders
      const paymentPromises = orderIds.map((orderId) =>
        api.post('/payments/mock-payment', null, { params: { order_id: orderId } })
      );

      await Promise.all(paymentPromises);

      toast.success('Payment successful! Orders confirmed.');
      clearCart();
      navigate('/dashboard');
    } catch (error) {
      toast.error('Payment failed. Please try again.');
    }
  };

  useEffect(() => {
    if (countdown === 0 && showWaitingModal) {
      // Auto proceed to payment after countdown
      processPayment();
    }
  }, [countdown, showWaitingModal]);

  const totalAmount = getTotalAmount();
  const platformFee = totalAmount * 0.1;
  const grandTotal = totalAmount + platformFee;

  return (
    <div className="min-h-screen bg-background py-12" data-testid="place-order-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Review & Place Your Order</h1>
          <p className="text-muted-foreground">Confirm your order details before proceeding</p>
        </div>

        <Card className="border-2 mb-6">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Order Summary</h3>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between pb-3 border-b last:border-0">
                  <div>
                    <p className="font-medium text-foreground">{item.packageTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.influencerName} (@{item.influencerHandle})
                    </p>
                  </div>
                  <p className="font-semibold text-foreground">{formatPrice(item.price)}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 mt-6 pt-6 border-t">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatPrice(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Platform Fee (10%)</span>
                <span>{formatPrice(platformFee)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-foreground pt-3 border-t">
                <span>Total Amount</span>
                <span className="text-primary">{formatPrice(grandTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handlePlaceOrder}
          disabled={isProcessing}
          className="w-full bg-accent hover:bg-accent/90 text-white font-bold h-14 text-lg"
          data-testid="confirm-place-order-button"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Placing Your Order...
            </>
          ) : (
            <>
              Place Your Order
              <ArrowRight className="h-5 w-5 ml-2" />
            </>
          )}
        </Button>
      </div>

      {/* Waiting Modal with Countdown */}
      <Dialog open={showWaitingModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-2xl" hideClose>
          <div className="text-center py-6 space-y-6">
            {/* Animated Icon */}
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-accent/20 rounded-full animate-ping"></div>
              <div className="relative bg-accent rounded-full w-24 h-24 flex items-center justify-center">
                <Clock className="h-12 w-12 text-white animate-pulse" />
              </div>
            </div>

            {/* Title */}
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Order Placed Successfully!</h3>
              <p className="text-lg text-accent font-semibold">Contacting Advertiser...</p>
            </div>

            {/* Countdown Timer */}
            <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg p-6">
              <div className="text-5xl font-bold text-primary mb-2" data-testid="countdown-timer">
                {formatCountdown(countdown)}
              </div>
              <p className="text-sm text-muted-foreground">Time remaining</p>
            </div>

            {/* Message */}
            <div className="bg-muted/30 rounded-lg p-4">
              <p className="text-sm text-foreground leading-relaxed">
                Wait a moment as we are contacting the advertiser to accept your request before making the payment.
                The advertiser would accept the request within 5 minutes.
              </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center space-x-4 text-sm">
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>Order Placed</span>
              </div>
              <div className="h-px w-8 bg-border"></div>
              <div className="flex items-center space-x-2 text-accent">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Awaiting Acceptance</span>
              </div>
              <div className="h-px w-8 bg-border"></div>
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Clock className="h-5 w-5" />
                <span>Payment</span>
              </div>
            </div>

            {/* Skip Button */}
            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-3">Don't want to wait?</p>
              <Button
                onClick={handleSkipToPayment}
                variant="outline"
                className="w-full border-accent text-accent hover:bg-accent/5 font-semibold"
                data-testid="skip-to-payment-button"
              >
                Click me to make the payment before the advertiser accepts the request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
