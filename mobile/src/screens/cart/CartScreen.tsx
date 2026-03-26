import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Alert,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, Button, EmptyState } from '../../components/common';
import { useCartStore, useAuthStore } from '../../store';
import { formatPrice } from '../../utils/formatters';
import { ordersApi } from '../../api';

export const CartScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { items, removeItem, clearCart, totalAmount } = useCartStore();
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  
  // Store cart items before checkout to prevent re-render issues
  const cartItemsRef = useRef(items);

  const handleRemoveItem = (id: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from cart?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeItem(id) },
      ]
    );
  };

  const handlePaymentComplete = () => {
    setPaymentModalVisible(false);
    setPaymentUrl(null);
    
    if (currentOrderId) {
      navigation.navigate('OrdersTab', { 
        screen: 'OrderDetail', 
        params: { id: currentOrderId } 
      });
    }
    setCurrentOrderId(null);
  };

  const handleWebViewNavigationStateChange = (navState: any) => {
    // Check if payment completed (redirected to callback URL)
    if (navState.url.includes('/payment/callback') || navState.url.includes('trxref=')) {
      handlePaymentComplete();
    }
  };

  const processOnlinePayment = async () => {
    if (!user) {
      navigation.navigate('Auth', { screen: 'Login' });
      return;
    }

    // Use stored cart items
    const checkoutItems = cartItemsRef.current;
    if (checkoutItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    setShowPaymentOptions(false);
    setIsCheckingOut(true);

    try {
      const firstItem = checkoutItems[0];
      const platformFee = firstItem.price * 0.05;
      const total = firstItem.price + platformFee;

      // Step 1: Create order
      const order = await ordersApi.create({
        listing_type: firstItem.listingType,
        listing_id: firstItem.listingId,
        package_details: {
          packageId: firstItem.packageId,
          packageTitle: firstItem.packageTitle,
          deliverables: firstItem.deliverables || [],
          turnaround: firstItem.duration,
          price: firstItem.price,
          location: firstItem.location,
          state_name: firstItem.state_name,
          road_name: firstItem.road_name,
        },
        total_amount: total,
        package_price: firstItem.price,
        payment_method: 'online',
      });

      setCurrentOrderId(order.id);

      // Step 2: Initialize payment
      const paymentData = await ordersApi.initializePayment({
        order_id: order.id,
        email: user.email,
        callback_url: 'https://www.lightban.com/payment/callback',
        amount: total,
      });

      if (paymentData.authorization_url) {
        // Step 3: Clear cart
        await clearCart();
        
        // Step 4: Open payment modal
        setPaymentUrl(paymentData.authorization_url);
        setIsCheckingOut(false);
        setPaymentModalVisible(true);
      } else {
        throw new Error('Payment initialization failed');
      }
    } catch (error: any) {
      setIsCheckingOut(false);
      Alert.alert(
        'Payment Error',
        error.message || 'Could not initialize payment. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const processCashPayment = async () => {
    if (!user) {
      navigation.navigate('Auth', { screen: 'Login' });
      return;
    }

    const checkoutItems = cartItemsRef.current;
    if (checkoutItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    setShowPaymentOptions(false);
    setIsCheckingOut(true);

    try {
      const firstItem = checkoutItems[0];
      const platformFee = firstItem.price * 0.05;
      const total = firstItem.price + platformFee;

      const order = await ordersApi.create({
        listing_type: firstItem.listingType,
        listing_id: firstItem.listingId,
        package_details: {
          packageId: firstItem.packageId,
          packageTitle: firstItem.packageTitle,
          deliverables: firstItem.deliverables || [],
          turnaround: firstItem.duration,
          price: firstItem.price,
          location: firstItem.location,
          state_name: firstItem.state_name,
          road_name: firstItem.road_name,
        },
        total_amount: total,
        package_price: firstItem.price,
        payment_method: 'cash',
      });

      await clearCart();
      setIsCheckingOut(false);
      
      Alert.alert(
        'Order Placed',
        'Your order has been placed. Please visit our office to complete payment.',
        [{ text: 'View Order', onPress: () => navigation.navigate('OrdersTab', { screen: 'OrderDetail', params: { id: order.id } }) }]
      );
    } catch (error: any) {
      setIsCheckingOut(false);
      Alert.alert('Error', error.message || 'Failed to place order');
    }
  };

  const showCheckoutOptions = () => {
    if (!user) {
      navigation.navigate('Auth', { screen: 'Login' });
      return;
    }
    // Store current cart items before showing options
    cartItemsRef.current = items;
    setShowPaymentOptions(true);
  };

  const renderCartItem = ({ item }: { item: typeof items[0] }) => (
    <Card variant="default" padding="md" style={styles.cartItem}>
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{item.listingName}</Text>
          <Text style={styles.packageName}>{item.packageTitle}</Text>
          {item.duration && (
            <Text style={styles.duration}>{item.duration}</Text>
          )}
        </View>
        <View style={styles.itemRight}>
          <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
          <Button
            title=""
            variant="ghost"
            onPress={() => handleRemoveItem(item.id)}
            icon={<Ionicons name="trash-outline" size={20} color={Colors.error} />}
          />
        </View>
      </View>
    </Card>
  );

  // Calculate totals
  const subtotal = totalAmount();
  const platformFee = subtotal * 0.05;
  const total = subtotal + platformFee;

  if (items.length === 0 && !isCheckingOut && !paymentModalVisible) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          description="Add items to your cart to proceed with checkout"
          actionLabel="Explore Services"
          onAction={() => navigation.navigate('ExploreTab')}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Loading Overlay */}
      {isCheckingOut && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Processing your order...</Text>
          </View>
        </View>
      )}

      <FlatList
        data={items}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.headerTitle}>Shopping Cart ({items.length})</Text>
        }
      />

      {/* Order Summary */}
      <View style={styles.summaryContainer}>
        <Card variant="elevated" padding="lg">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPrice(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Platform Fee (5%)</Text>
            <Text style={styles.summaryValue}>{formatPrice(platformFee)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(total)}</Text>
          </View>
        </Card>

        <Button
          title="Proceed to Checkout"
          onPress={showCheckoutOptions}
          loading={isCheckingOut}
          disabled={isCheckingOut}
          fullWidth
          size="lg"
          style={styles.checkoutButton}
        />
      </View>

      {/* Payment Options Modal */}
      <Modal
        visible={showPaymentOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPaymentOptions(false)}
      >
        <TouchableOpacity 
          style={styles.paymentOptionsOverlay}
          activeOpacity={1}
          onPress={() => setShowPaymentOptions(false)}
        >
          <View style={styles.paymentOptionsContainer}>
            <Text style={styles.paymentOptionsTitle}>Choose Payment Method</Text>
            <Text style={styles.paymentOptionsSubtitle}>How would you like to pay?</Text>
            
            <TouchableOpacity 
              style={styles.paymentOption}
              onPress={processOnlinePayment}
            >
              <View style={[styles.paymentOptionIcon, { backgroundColor: Colors.success + '20' }]}>
                <Ionicons name="card-outline" size={24} color={Colors.success} />
              </View>
              <View style={styles.paymentOptionText}>
                <Text style={styles.paymentOptionTitle}>Pay Online</Text>
                <Text style={styles.paymentOptionDesc}>Pay securely with Paystack</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.paymentOption}
              onPress={processCashPayment}
            >
              <View style={[styles.paymentOptionIcon, { backgroundColor: Colors.warning + '20' }]}>
                <Ionicons name="cash-outline" size={24} color={Colors.warning} />
              </View>
              <View style={styles.paymentOptionText}>
                <Text style={styles.paymentOptionTitle}>Pay at Office</Text>
                <Text style={styles.paymentOptionDesc}>Visit our office to pay</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => setShowPaymentOptions(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Payment WebView Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePaymentComplete}
      >
        <SafeAreaView style={styles.webviewContainer}>
          <View style={styles.webviewHeader}>
            <Text style={styles.webviewTitle}>Complete Payment</Text>
            <TouchableOpacity 
              onPress={handlePaymentComplete}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          {paymentUrl && (
            <WebView
              source={{ uri: paymentUrl }}
              onNavigationStateChange={handleWebViewNavigationStateChange}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webviewLoading}>
                  <ActivityIndicator size="large" color={Colors.accent} />
                  <Text style={styles.webviewLoadingText}>Loading Paystack...</Text>
                </View>
              )}
              style={styles.webview}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingContent: {
    backgroundColor: Colors.white,
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
    fontWeight: Fonts.weight.medium,
  },
  list: {
    padding: 16,
    paddingBottom: 220,
  },
  headerTitle: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  cartItem: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  packageName: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  duration: {
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
    marginBottom: 8,
  },
  summaryContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.background,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  checkoutButton: {
    marginTop: 16,
  },
  // Payment Options Modal
  paymentOptionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  paymentOptionsContainer: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  paymentOptionsTitle: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  paymentOptionsSubtitle: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    marginBottom: 12,
  },
  paymentOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  paymentOptionText: {
    flex: 1,
  },
  paymentOptionTitle: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
  },
  paymentOptionDesc: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cancelButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
    fontWeight: Fonts.weight.medium,
  },
  // WebView Modal
  webviewContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  webviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  webviewTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.white,
  },
  webviewLoadingText: {
    marginTop: 16,
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
  },
});
