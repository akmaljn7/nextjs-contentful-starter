import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore, useAuthStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';
import api from '@/lib/api';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Clock, CheckCircle, ArrowRight, CreditCard, Banknote, Building2 } from 'lucide-react';
import { toast } from 'sonner';

export const PlaceOrderPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, getTotalAmount, clearCart } = useCartStore();
  const [settings, setSettings] = useState(null);
  const [showWaitingModal, setShowWaitingModal] = useState(false);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showCashConfirmModal, setShowCashConfirmModal] = useState(false);
  const [countdown, setCountdown] = useState(300); // 5 minutes in seconds
  const [orderIds, setOrderIds] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isInitializingPayment, setIsInitializingPayment] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings');
        setSettings(response.data);
      } catch (error) {
        console.log('Using default settings');
      }
    };
    fetchSettings();
  }, []);

  // Get platform fee percentage (default to 10 if not set)
  const platformFeePercentage = (settings?.platform_fee_percentage || 10) / 100;

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
          listing_type: item.listingType || item.type || 'influencer',
          listing_id: item.listingId || item.influencerId,
          package_details: {
            packageId: item.packageId,
            packageTitle: item.packageTitle,
            deliverables: item.deliverables || [],
            turnaround: item.turnaround || item.duration,
            price: item.price,  // Original package price for correct fee calculation
            // Additional LED billboard metadata
            location: item.location,
            size: item.size,
            state_name: item.state_name,
            road_name: item.road_name,
            size_name: item.size_name,
          },
          total_amount: item.price + item.price * platformFeePercentage,
          package_price: item.price,  // Send original price separately for backend fee calculation
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

  const handleSkipToPayment = () => {
    // Show payment method selection modal
    setShowWaitingModal(false);
    setShowPaymentMethodModal(true);
  };

  const handleCancelOrder = () => {
    // Close all modals and go back to cart
    setShowWaitingModal(false);
    setShowPaymentMethodModal(false);
    setShowCashConfirmModal(false);
    toast.info('Order cancelled. Your items are still in your cart.');
    navigate('/cart');
  };

  const handleSelectOnlinePayment = async () => {
    // Directly initialize Paystack payment without showing intermediate modal
    setShowPaymentMethodModal(false);
    setIsInitializingPayment(true);
    
    try {
      // Send ALL order IDs (comma-separated) to pay for the entire cart at once
      const allOrderIds = orderIds.join(',');
      const callbackUrl = `${window.location.origin}/payment/callback`;
      
      const response = await api.post('/payments/initialize', {
        order_id: allOrderIds,  // All order IDs for combined payment
        email: user.email,
        callback_url: callbackUrl,
      });

      if (response.data.status === 'success') {
        // Redirect to Paystack payment page
        window.location.href = response.data.authorization_url;
      } else {
        toast.error('Failed to initialize payment. Please try again.');
        setIsInitializingPayment(false);
        setShowPaymentMethodModal(true);
      }
    } catch (error) {
      console.error('Payment initialization error:', error);
      toast.error('Failed to initialize payment. Please try again.');
      setIsInitializingPayment(false);
      setShowPaymentMethodModal(true);
    }
  };

  const handleSelectCashPayment = () => {
    setShowPaymentMethodModal(false);
    setShowCashConfirmModal(true);
  };

  const handleConfirmCashPayment = async () => {
    try {
      // Update order status to awaiting cash payment and set payment method
      for (const orderId of orderIds) {
        await api.put(`/orders/${orderId}/status`, {
          payment_status: 'pending_cash',
          payment_method: 'cash',
          order_status: 'awaiting_payment'
        });
      }
      
      clearCart();
      toast.success('Order confirmed! Check your email for details. Please visit our office to complete payment.');
      setShowCashConfirmModal(false);
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to confirm order. Please try again.');
    }
  };

  useEffect(() => {
    if (countdown === 0 && showWaitingModal) {
      // Auto show payment method selection after countdown
      setShowWaitingModal(false);
      setShowPaymentMethodModal(true);
    }
  }, [countdown, showWaitingModal]);

  const totalAmount = getTotalAmount();
  const platformFee = totalAmount * platformFeePercentage;
  const grandTotal = totalAmount + platformFee;
  const feePercentageDisplay = settings?.platform_fee_percentage || 10;

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
                <span>Platform Fee ({feePercentageDisplay}%)</span>
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
        <DialogContent className="sm:max-w-md max-w-[92vw] mx-auto p-4 sm:p-6" hideClose>
          <div className="text-center py-2 sm:py-4 space-y-3 sm:space-y-5">
            {/* Animated Icon */}
            <div className="relative mx-auto w-12 h-12 sm:w-20 sm:h-20">
              <div className="absolute inset-0 bg-accent/20 rounded-full animate-ping"></div>
              <div className="relative bg-accent rounded-full w-12 h-12 sm:w-20 sm:h-20 flex items-center justify-center">
                <Clock className="h-6 w-6 sm:h-10 sm:w-10 text-white animate-pulse" />
              </div>
            </div>

            {/* Title */}
            <div>
              <h3 className="text-base sm:text-xl font-bold text-foreground mb-0.5 sm:mb-1">Order Placed Successfully!</h3>
              <p className="text-xs sm:text-base text-accent font-semibold">Contacting Advertiser...</p>
            </div>

            {/* Countdown Timer */}
            <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg p-3 sm:p-5">
              <div className="text-3xl sm:text-5xl font-bold text-primary mb-0.5 sm:mb-1" data-testid="countdown-timer">
                {formatCountdown(countdown)}
              </div>
              <p className="text-[10px] sm:text-sm text-muted-foreground">Time remaining</p>
            </div>

            {/* Message - Hidden on very small screens, shown condensed */}
            <div className="bg-muted/30 rounded-lg p-2 sm:p-3">
              <p className="text-[10px] sm:text-xs text-foreground leading-relaxed">
                We're contacting the advertiser to accept your request. They will respond within 5 minutes.
              </p>
            </div>

            {/* Progress Steps - Horizontal on mobile too, just smaller */}
            <div className="flex items-center justify-center space-x-2 sm:space-x-4 text-[10px] sm:text-xs">
              <div className="flex items-center space-x-1 text-green-600">
                <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Placed</span>
              </div>
              <div className="h-px w-4 sm:w-6 bg-border"></div>
              <div className="flex items-center space-x-1 text-accent">
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                <span>Waiting</span>
              </div>
              <div className="h-px w-4 sm:w-6 bg-border"></div>
              <div className="flex items-center space-x-1 text-muted-foreground">
                <CreditCard className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Payment</span>
              </div>
            </div>

            {/* Skip Button */}
            <div className="pt-2 sm:pt-3 border-t space-y-2">
              <Button
                onClick={handleSkipToPayment}
                variant="outline"
                className="w-full border-accent text-accent hover:bg-accent/5 font-semibold text-[10px] sm:text-xs h-9 sm:h-10"
                data-testid="skip-to-payment-button"
              >
                Pay now without waiting
              </Button>
              <Button
                onClick={handleCancelOrder}
                variant="ghost"
                className="w-full text-muted-foreground hover:text-red-600 text-[10px] sm:text-xs h-8 sm:h-9"
                data-testid="cancel-order-button"
              >
                Cancel Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Method Selection Modal */}
      <Dialog open={showPaymentMethodModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md max-w-[95vw] mx-auto" hideClose>
          <div className="text-center py-3 sm:py-4 space-y-4 sm:space-y-5">
            {/* Title */}
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1">Choose Payment Method</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">How would you like to pay?</p>
            </div>

            {/* Amount */}
            <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
              <p className="text-xs text-muted-foreground mb-1">Total Amount</p>
              <p className="text-xl sm:text-2xl font-bold text-primary">{formatPrice(grandTotal)}</p>
            </div>

            {/* Payment Options */}
            <div className="space-y-2 sm:space-y-3">
              {/* Online Payment Option */}
              <Button
                onClick={handleSelectOnlinePayment}
                disabled={isInitializingPayment}
                className="w-full h-14 sm:h-16 bg-green-600 hover:bg-green-700 text-white font-semibold flex items-center justify-start px-3 sm:px-4"
                data-testid="select-online-payment"
              >
                <div className="bg-white/20 rounded-full p-1.5 sm:p-2 mr-3 sm:mr-4">
                  {isInitializingPayment ? (
                    <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                  ) : (
                    <CreditCard className="h-5 w-5 sm:h-6 sm:w-6" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm sm:text-base">{isInitializingPayment ? 'Connecting...' : 'Pay Online'}</p>
                  <p className="text-xs opacity-90">Instant payment via Paystack</p>
                </div>
              </Button>

              {/* Cash Payment Option */}
              <Button
                onClick={handleSelectCashPayment}
                disabled={isInitializingPayment}
                variant="outline"
                className="w-full h-14 sm:h-16 border-2 border-accent text-accent hover:bg-accent/5 font-semibold flex items-center justify-start px-3 sm:px-4"
                data-testid="select-cash-payment"
              >
                <div className="bg-accent/10 rounded-full p-1.5 sm:p-2 mr-3 sm:mr-4">
                  <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm sm:text-base">Pay Cash at Office</p>
                  <p className="text-xs opacity-70">Visit our office to pay</p>
                </div>
              </Button>
            </div>

            {/* Cancel Button */}
            <Button
              onClick={handleCancelOrder}
              disabled={isInitializingPayment}
              variant="ghost"
              className="w-full text-muted-foreground hover:text-red-600 text-sm"
            >
              Cancel Order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cash Payment Confirmation Modal */}
      <Dialog open={showCashConfirmModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md max-w-[95vw] mx-auto" hideClose>
          <div className="text-center py-3 sm:py-4 space-y-3 sm:space-y-5">
            {/* Icon */}
            <div className="relative mx-auto w-12 h-12 sm:w-16 sm:h-16">
              <div className="relative bg-accent rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center">
                <Building2 className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
            </div>

            {/* Title */}
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-1">Pay Cash at Our Office</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Your order will be reserved for 24 hours</p>
            </div>

            {/* Office Details */}
            <div className="bg-muted/30 rounded-lg p-3 sm:p-4 text-left space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Office Address</p>
                <p className="text-xs sm:text-sm font-medium text-foreground">{settings?.site_name || 'Lightban Ads Network'} Office</p>
                <p className="text-xs sm:text-sm text-muted-foreground">{settings?.office_address || 'No 671, Zoo Road, Inec Street, Kano'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Working Hours</p>
                <p className="text-xs sm:text-sm text-foreground">{settings?.business_hours || 'Monday - Saturday: 9:00 AM - 5:00 PM'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Amount to Pay</p>
                <p className="text-base sm:text-lg font-bold text-primary">{formatPrice(grandTotal)}</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="space-y-2">
              <Button
                onClick={handleConfirmCashPayment}
                className="w-full bg-accent hover:bg-accent/90 text-white font-semibold h-10 sm:h-12 text-sm sm:text-base"
                data-testid="confirm-cash-payment"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm Order
              </Button>
              <Button
                onClick={() => {
                  setShowCashConfirmModal(false);
                  setShowPaymentMethodModal(true);
                }}
                variant="ghost"
                className="w-full text-muted-foreground text-sm"
              >
                Back to Payment Options
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
