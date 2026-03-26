import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
  const [isCheckingOut, setIsCheckingOut] = React.useState(false);

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

  const handleCheckout = async (paymentMethod: 'online' | 'cash') => {
    if (!user) {
      navigation.navigate('Auth', { screen: 'Login' });
      return;
    }

    setIsCheckingOut(true);
    try {
      const order = await ordersApi.create({
        items,
        payment_method: paymentMethod,
      });

      await clearCart();

      if (paymentMethod === 'online') {
        // Navigate to payment
        const paymentData = await ordersApi.initializePayment(order.id);
        // Handle payment URL - in real app, use WebView or Linking
        Alert.alert(
          'Payment',
          'You will be redirected to complete payment.',
          [{ text: 'OK', onPress: () => navigation.navigate('OrdersTab', { screen: 'OrderDetail', params: { id: order.id } }) }]
        );
      } else {
        Alert.alert(
          'Order Placed',
          'Your order has been placed. Please visit our office to complete payment.',
          [{ text: 'View Order', onPress: () => navigation.navigate('OrdersTab', { screen: 'OrderDetail', params: { id: order.id } }) }]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to place order');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const showCheckoutOptions = () => {
    Alert.alert(
      'Choose Payment Method',
      'How would you like to pay?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay Online', onPress: () => handleCheckout('online') },
        { text: 'Pay at Office', onPress: () => handleCheckout('cash') },
      ]
    );
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

  if (items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="cart-outline"
          title="Your cart is empty"
          description="Browse our services and add items to your cart"
          actionLabel="Start Exploring"
          onAction={() => navigation.navigate('ExploreTab')}
        />
      </SafeAreaView>
    );
  }

  const platformFee = totalAmount() * 0.05;
  const grandTotal = totalAmount() + platformFee;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shopping Cart</Text>
        <Text style={styles.itemCount}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={items}
        renderItem={renderCartItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{formatPrice(totalAmount())}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Platform Fee (5%)</Text>
          <Text style={styles.summaryValue}>{formatPrice(platformFee)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(grandTotal)}</Text>
        </View>

        <Button
          title="Proceed to Checkout"
          onPress={showCheckoutOptions}
          loading={isCheckingOut}
          fullWidth
          size="lg"
          style={styles.checkoutButton}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    backgroundColor: Colors.primary,
  },
  title: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.white,
  },
  itemCount: {
    fontSize: Fonts.size.sm,
    color: Colors.white + 'aa',
    marginTop: 4,
  },
  list: {
    padding: 16,
    paddingBottom: 200,
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
    color: Colors.accent,
    marginBottom: 2,
  },
  duration: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  summary: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 34,
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
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  checkoutButton: {},
});
