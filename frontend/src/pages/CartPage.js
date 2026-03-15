import { useNavigate } from 'react-router-dom';
import { useCartStore, useAuthStore } from '@/lib/store';
import { formatPrice } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ShoppingCart, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const CartPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, removeItem, getTotalAmount } = useCartStore();

  if (!user) {
    navigate('/login');
    return null;
  }

  const totalAmount = getTotalAmount();

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
    <div className="min-h-screen bg-background py-12" data-testid="cart-page">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Your Cart</h1>
          <p className="text-muted-foreground">Review your selected packages before placing your order</p>
        </div>

        {items.length === 0 ? (
          <Card className="border-2">
            <CardContent className="p-12 text-center">
              <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-bold text-foreground mb-2">Your cart is empty</h3>
              <p className="text-muted-foreground mb-6">Browse our influencers and add packages to get started</p>
              <Button
                onClick={() => navigate('/influencers')}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                Browse Influencers
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map((item) => (
                <Card
                  key={`${item.influencerId}-${item.packageId}`}
                  className="border-2"
                  data-testid={`cart-item-${item.packageId}`}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      {/* Influencer Image */}
                      <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 border-2 border-primary/20">
                        {item.influencerImage ? (
                          <img
                            src={item.influencerImage}
                            alt={item.influencerName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                            <ShoppingCart className="h-8 w-8 text-primary" />
                          </div>
                        )}
                      </div>

                      {/* Package Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-foreground">{item.packageTitle}</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                              {item.influencerName} (@{item.influencerHandle})
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.influencerId, item.packageId)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`remove-item-${item.packageId}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-1 mb-3">
                          {item.deliverables.slice(0, 3).map((deliverable, idx) => (
                            <div key={idx} className="flex items-start space-x-2">
                              <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                              <p className="text-sm text-muted-foreground">{deliverable}</p>
                            </div>
                          ))}
                          {item.deliverables.length > 3 && (
                            <p className="text-sm text-muted-foreground ml-6">
                              + {item.deliverables.length - 3} more deliverables
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t">
                          <p className="text-sm text-muted-foreground">Turnaround: {item.turnaround}</p>
                          <p className="text-xl font-bold text-primary">{formatPrice(item.price)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="border-2 sticky top-24">
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-foreground mb-6">Order Summary</h3>

                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal ({items.length} {items.length === 1 ? 'item' : 'items'})</span>
                      <span>{formatPrice(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Platform Fee (10%)</span>
                      <span>{formatPrice(totalAmount * 0.1)}</span>
                    </div>
                    <div className="h-px bg-border"></div>
                    <div className="flex justify-between text-lg font-bold text-foreground">
                      <span>Total</span>
                      <span className="text-primary">{formatPrice(totalAmount + totalAmount * 0.1)}</span>
                    </div>
                  </div>

                  <Button
                    onClick={handlePlaceOrder}
                    className="w-full bg-accent hover:bg-accent/90 text-white font-semibold h-12"
                    data-testid="place-order-button"
                  >
                    Place Your Order
                  </Button>

                  <p className="text-xs text-muted-foreground text-center mt-4">
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
