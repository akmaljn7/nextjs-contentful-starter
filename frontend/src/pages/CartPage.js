import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore, useAuthStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ShoppingCart, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

export const CartPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, removeItem, getTotalAmount } = useCartStore();
  const [settings, setSettings] = useState(null);

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

  if (!user) {
    navigate('/login');
    return null;
  }

  const totalAmount = getTotalAmount();
  
  // Get platform fee percentage from settings (default to 10 if not set)
  const feePercentage = settings?.platform_fee_percentage || 10;
  const platformFee = totalAmount * (feePercentage / 100);
  const grandTotal = totalAmount + platformFee;

  const handleRemoveItem = (influencerId, packageId) => {
    removeItem(influencerId, packageId);
    toast.success('Package removed from cart');
  };

  const handlePlaceOrder = () => {
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    navigate('/place-order');
  };

  return (
    <div className="min-h-screen bg-background py-6 sm:py-12" data-testid="cart-page">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">Your Cart</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Review your selected packages before placing your order</p>
        </div>

        {items.length === 0 ? (
          <Card className="border-2">
            <CardContent className="p-8 sm:p-12 text-center">
              <ShoppingCart className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
              <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">Your cart is empty</h3>
              <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">Browse our influencers and add packages to get started</p>
              <Button
                onClick={() => navigate('/influencers')}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Browse Influencers
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-3 sm:space-y-4">
              {items.map((item) => (
                <Card
                  key={`${item.influencerId}-${item.packageId}`}
                  className="border-2"
                  data-testid={`cart-item-${item.packageId}`}
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start space-x-3 sm:space-x-4">
                      {/* Influencer Image */}
                      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full overflow-hidden flex-shrink-0 border-2 border-primary/20">
                        {item.influencerImage ? (
                          <img
                            src={item.influencerImage}
                            alt={item.influencerName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                            <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1 pr-2">
                            <h3 className="font-bold text-foreground text-base sm:text-lg truncate">
                              {item.packageTitle}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground">
                              {item.influencerName} (@{item.influencerHandle})
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                            onClick={() => handleRemoveItem(item.influencerId, item.packageId)}
                            data-testid={`remove-item-${item.packageId}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Deliverables */}
                        {item.deliverables && item.deliverables.length > 0 && (
                          <div className="mt-2 sm:mt-3">
                            <div className="space-y-0.5 sm:space-y-1">
                              {item.deliverables.slice(0, 3).map((deliverable, idx) => (
                                <div key={idx} className="flex items-center space-x-1.5 sm:space-x-2">
                                  <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 text-primary flex-shrink-0" />
                                  <span className="text-xs sm:text-sm text-muted-foreground truncate">{deliverable}</span>
                                </div>
                              ))}
                              {item.deliverables.length > 3 && (
                                <p className="text-xs text-muted-foreground pl-4 sm:pl-6">
                                  + {item.deliverables.length - 3} more deliverables
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Price & Turnaround */}
                        <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t flex items-center justify-between">
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            Turnaround: {item.turnaround}
                          </span>
                          <span className="text-lg sm:text-xl font-bold text-foreground">
                            {formatPrice(item.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="border-2 sticky top-20 sm:top-24">
                <CardContent className="p-4 sm:p-6">
                  <h3 className="text-lg sm:text-xl font-bold text-foreground mb-4 sm:mb-6">Order Summary</h3>

                  <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'items'})</span>
                      <span>{formatPrice(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Platform Fee ({feePercentage}%)</span>
                      <span>{formatPrice(platformFee)}</span>
                    </div>
                    <div className="h-px bg-border"></div>
                    <div className="flex justify-between text-base sm:text-lg font-bold text-foreground">
                      <span>Total</span>
                      <span className="text-primary">{formatPrice(grandTotal)}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handlePlaceOrder}
                    className="w-full bg-accent hover:bg-accent/90 text-white font-semibold h-11 sm:h-12"
                    data-testid="place-order-button"
                  >
                    Place Your Order
                  </Button>

                  <p className="text-xs text-muted-foreground text-center mt-3 sm:mt-4">
                    By placing your order, you agree to our Terms of Service
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
