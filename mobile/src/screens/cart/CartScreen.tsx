import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, Button, EmptyState } from '../../components/common';
import { useCartStore, useAuthStore } from '../../store';
import { formatPrice } from '../../utils/formatters';
import { ordersApi, settingsApi, SiteSettings, authApi } from '../../api';
import { authStorage } from '../../utils/storage';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n';

export const CartScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, updateUser, logout } = useAuthStore();
  const { items, removeItem, clearCart, totalAmount } = useCartStore();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  // Calculate top padding for status bar (especially important for Android)
  const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 24) : insets.top;
  
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  
  // Profile completion modal
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profilePhone, setProfilePhone] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  
  // Store cart items before checkout to prevent re-render issues
  const cartItemsRef = useRef(items);

  // Fetch settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.getSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  // Get platform fee percentage from settings (default 5% if not set)
  const platformFeePercentage = settings?.platform_fee_percentage || 5;

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

  const handlePaymentComplete = async () => {
    setPaymentModalVisible(false);
    setPaymentUrl(null);
    
    // Navigate to Orders list (works for both single and multiple orders)
    navigation.navigate('OrdersTab', { screen: 'Orders' });
    
    setCurrentOrderId(null);
  };

  const handleWebViewNavigationStateChange = async (navState: any) => {
    const url = navState.url;
    
    // Check if payment was successful (Paystack redirects with reference)
    if (url.includes('/payment/callback') || url.includes('trxref=') || url.includes('reference=')) {
      // Extract reference from URL
      const urlParams = new URLSearchParams(url.split('?')[1] || '');
      const reference = urlParams.get('trxref') || urlParams.get('reference');
      
      if (reference) {
        try {
          // Verify payment on backend - this updates payment status
          await ordersApi.verifyPayment(reference);
        } catch (error) {
          console.log('Payment verification will be handled by webhook');
        }
      }
      
      handlePaymentComplete();
    }
  };

  const processOnlinePayment = async () => {
    if (!user) {
      setShowPaymentOptions(false);
      Alert.alert('Login Required', 'Please login to continue.');
      await logout();
      return;
    }

    // Verify token exists before proceeding
    const token = await authStorage.getToken();
    if (!token) {
      setShowPaymentOptions(false);
      Alert.alert(
        'Session Expired',
        'Your login session has expired. Please log in again.',
        [{ text: 'OK', onPress: () => logout() }]
      );
      return;
    }

    // Check if user has phone number - required for order contact
    if (!user.phone || user.phone.trim() === '') {
      // Close payment options first, then show profile modal
      setShowPaymentOptions(false);
      setProfilePhone('');
      // Pre-fill email if it's an Apple relay email
      if (user.email?.includes('privaterelay.appleid.com')) {
        setProfileEmail('');
      } else {
        setProfileEmail(user.email || '');
      }
      // Small delay to ensure payment modal closes before profile modal opens
      setTimeout(() => {
        setShowProfileModal(true);
      }, 300);
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
      // Calculate total for ALL items
      let grandTotal = 0;
      const createdOrders: string[] = [];
      
      // Create orders for all items
      for (const item of checkoutItems) {
        const platformFee = item.price * (platformFeePercentage / 100);
        const itemTotal = item.price + platformFee;
        grandTotal += itemTotal;

        const order = await ordersApi.create({
          listing_type: item.listingType,
          listing_id: item.listingId,
          package_details: {
            packageId: item.packageId,
            packageTitle: item.packageTitle,
            deliverables: item.deliverables || [],
            turnaround: item.duration,
            price: item.price,
            location: item.location,
            state_name: item.state_name,
            road_name: item.road_name,
          },
          total_amount: itemTotal,
          package_price: item.price,
          payment_method: 'online',
        });
        
        createdOrders.push(order.id);
      }

      // Use all order IDs for payment (comma-separated)
      const allOrderIds = createdOrders.join(',');
      setCurrentOrderId(createdOrders[0]); // For navigation after payment

      const paymentData = await ordersApi.initializePayment({
        order_id: allOrderIds,  // Pass ALL order IDs
        email: user.email,
        callback_url: 'https://www.adlinka.com/payment/callback',
        amount: grandTotal,
        metadata: {
          order_ids: createdOrders,
          total_orders: createdOrders.length,
        },
      });

      if (paymentData.authorization_url) {
        await clearCart();
        setPaymentUrl(paymentData.authorization_url);
        setIsCheckingOut(false);
        setPaymentModalVisible(true);
      } else {
        throw new Error('Payment initialization failed');
      }
    } catch (error: any) {
      setIsCheckingOut(false);
      // Check if it's an authentication error
      if (error.message?.includes('Not authenticated') || error.status === 401) {
        Alert.alert(
          'Session Expired',
          'Your login session has expired. Please log in again.',
          [{ text: 'OK', onPress: () => logout() }]
        );
      } else {
        Alert.alert('Payment Error', error.message || 'Could not initialize payment.');
      }
    }
  };

  const processCashPayment = async () => {
    if (!user) {
      setShowPaymentOptions(false);
      Alert.alert('Login Required', 'Please login to continue.');
      await logout();
      return;
    }

    // Verify token exists before proceeding
    const token = await authStorage.getToken();
    if (!token) {
      setShowPaymentOptions(false);
      Alert.alert(
        'Session Expired',
        'Your login session has expired. Please log in again.',
        [{ text: 'OK', onPress: () => logout() }]
      );
      return;
    }

    // Check if user has phone number - required for order contact
    if (!user.phone || user.phone.trim() === '') {
      // Close payment options first, then show profile modal
      setShowPaymentOptions(false);
      setProfilePhone('');
      if (user.email?.includes('privaterelay.appleid.com')) {
        setProfileEmail('');
      } else {
        setProfileEmail(user.email || '');
      }
      // Small delay to ensure payment modal closes before profile modal opens
      setTimeout(() => {
        setShowProfileModal(true);
      }, 300);
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
      const createdOrders: string[] = [];
      
      // Create orders for all items
      for (const item of checkoutItems) {
        const platformFee = item.price * (platformFeePercentage / 100);
        const itemTotal = item.price + platformFee;

        const order = await ordersApi.create({
          listing_type: item.listingType,
          listing_id: item.listingId,
          package_details: {
            packageId: item.packageId,
            packageTitle: item.packageTitle,
            deliverables: item.deliverables || [],
            turnaround: item.duration,
            price: item.price,
            location: item.location,
            state_name: item.state_name,
            road_name: item.road_name,
          },
          total_amount: itemTotal,
          package_price: item.price,
          payment_method: 'cash',
        });
        
        createdOrders.push(order.id);
      }

      await clearCart();
      setIsCheckingOut(false);
      
      const orderText = createdOrders.length > 1 
        ? `${createdOrders.length} ${t.checkout.ordersPlacedMessage}` 
        : t.checkout.orderPlacedMessage;
      
      Alert.alert(
        t.checkout.orderPlaced,
        `${orderText}. ${t.checkout.visitOffice}`,
        [{ text: t.checkout.viewOrders, onPress: () => navigation.navigate('OrdersTab', { screen: 'Orders' }) }]
      );
    } catch (error: any) {
      setIsCheckingOut(false);
      // Check if it's an authentication error
      if (error.message?.includes('Not authenticated') || error.status === 401) {
        Alert.alert(
          'Session Expired',
          'Your login session has expired. Please log in again.',
          [{ text: 'OK', onPress: () => logout() }]
        );
      } else {
        Alert.alert(t.common.error, error.message || t.errors.somethingWentWrong);
      }
    }
  };

  const showCheckoutOptions = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to continue with checkout.');
      await logout();
      return;
    }
    
    // Verify token is still valid before showing checkout options
    try {
      const token = await authStorage.getToken();
      if (!token) {
        Alert.alert(
          'Session Expired',
          'Please log in again to continue with your order.',
          [{ text: 'OK', onPress: () => logout() }]
        );
        return;
      }
    } catch (error) {
      console.error('Token check error:', error);
    }
    
    cartItemsRef.current = items;
    setShowPaymentOptions(true);
  };

  // Save profile with phone number
  const handleSaveProfile = async () => {
    if (!profilePhone || profilePhone.trim().length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number (at least 10 digits)');
      return;
    }

    setIsSavingProfile(true);
    try {
      const updateData: any = { phone: profilePhone.trim() };
      
      // Only update email if user provided a new one and current is Apple relay
      if (profileEmail && profileEmail.trim() && !profileEmail.includes('privaterelay.appleid.com')) {
        updateData.email = profileEmail.trim();
      }

      const updatedUser = await authApi.updateProfile(updateData);
      updateUser(updatedUser);
      
      setShowProfileModal(false);
      Alert.alert('Profile Updated', 'Your contact information has been saved. You can now proceed with checkout.', [
        { text: 'Continue', onPress: () => setShowPaymentOptions(true) }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const renderCartItem = ({ item }: { item: typeof items[0] }) => (
    <Card variant="default" padding="md" style={[styles.cartItem, { backgroundColor: colors.surface }]}>
      <View style={styles.itemRow}>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={2}>{item.listingName}</Text>
          <Text style={[styles.packageName, { color: colors.textSecondary }]}>{item.packageTitle}</Text>
          {item.duration && <Text style={[styles.duration, { color: colors.textMuted }]}>{item.duration}</Text>}
        </View>
        <View style={styles.itemRight}>
          <Text style={[styles.itemPrice, { color: colors.textPrimary }]}>{formatPrice(item.price)}</Text>
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

  const subtotal = totalAmount();
  const platformFee = subtotal * (platformFeePercentage / 100);
  const total = subtotal + platformFee;

  if (items.length === 0 && !isCheckingOut && !paymentModalVisible) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPadding }]}>
        <EmptyState
          icon="cart-outline"
          title={t.cart.emptyCart}
          description={t.cart.emptyCartMessage}
          actionLabel={t.cart.exploreServices}
          onAction={() => navigation.navigate('ExploreTab', { screen: 'Explore' })}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPadding }]}>
      {isCheckingOut && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingContent, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textPrimary }]}>{t.checkout.processing}</Text>
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
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t.cart.yourCart} ({items.length})</Text>
        }
      />

      <View style={[styles.summaryContainer, { backgroundColor: colors.background }]}>
        <Card variant="elevated" padding="lg">
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t.cart.subtotal}</Text>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatPrice(subtotal)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{t.cart.platformFee} ({platformFeePercentage}%)</Text>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{formatPrice(platformFee)}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryRow}>
            <Text style={[styles.totalLabel, { color: colors.textPrimary }]}>{t.cart.total}</Text>
            <Text style={styles.totalValue}>{formatPrice(total)}</Text>
          </View>
        </Card>

        <Button
          title={t.cart.proceedToCheckout}
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
          <TouchableOpacity activeOpacity={1} style={[styles.paymentOptionsContainer, { backgroundColor: colors.surface }]}>
            <Text style={[styles.paymentOptionsTitle, { color: colors.textPrimary }]}>{t.checkout.selectPayment}</Text>
            <Text style={[styles.paymentOptionsSubtitle, { color: colors.textSecondary }]}>{t.checkout.paymentMethod}</Text>
            
            <TouchableOpacity style={[styles.paymentOption, { backgroundColor: colors.background }]} onPress={processOnlinePayment}>
              <View style={[styles.paymentOptionIcon, { backgroundColor: Colors.success + '20' }]}>
                <Ionicons name="card-outline" size={24} color={Colors.success} />
              </View>
              <View style={styles.paymentOptionText}>
                <Text style={[styles.paymentOptionTitle, { color: colors.textPrimary }]}>{t.checkout.payOnline}</Text>
                <Text style={[styles.paymentOptionDesc, { color: colors.textSecondary }]}>{t.checkout.payOnlineDesc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.paymentOption, { backgroundColor: colors.background }]} onPress={processCashPayment}>
              <View style={[styles.paymentOptionIcon, { backgroundColor: Colors.warning + '20' }]}>
                <Ionicons name="cash-outline" size={24} color={Colors.warning} />
              </View>
              <View style={styles.paymentOptionText}>
                <Text style={[styles.paymentOptionTitle, { color: colors.textPrimary }]}>{t.checkout.payAtOffice}</Text>
                <Text style={[styles.paymentOptionDesc, { color: colors.textSecondary }]}>{t.checkout.payAtOfficeDesc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPaymentOptions(false)}>
              <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
            </TouchableOpacity>

            {/* Payment Disclosure for App Store Compliance */}
            <Text style={[styles.paymentDisclosure, { color: colors.textMuted }]}>
              Payments are processed securely by Paystack for advertising services. 
              This is not an in-app purchase.
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Payment WebView Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handlePaymentComplete}
      >
        <View style={[styles.webviewContainer, { paddingTop: topPadding }]}>
          <View style={styles.webviewHeader}>
            <Text style={styles.webviewTitle}>Complete Payment</Text>
            <TouchableOpacity onPress={handlePaymentComplete} style={styles.closeButton}>
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
        </View>
      </Modal>

      {/* Complete Profile Modal - Required for Apple Sign-in users */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          Keyboard.dismiss();
          setShowProfileModal(false);
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoidingView}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <View style={[styles.profileModalContent, { backgroundColor: colors.surface }]}>
                <View style={styles.modalHandle} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Complete Your Profile</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  We need your contact information to process your order and keep you updated.
                </Text>

                <ScrollView 
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.profileInputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Phone Number *</Text>
                    <TextInput
                      style={[styles.profileInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                      placeholder="e.g., +234 801 234 5678"
                      placeholderTextColor={colors.textMuted}
                      value={profilePhone}
                      onChangeText={setProfilePhone}
                      keyboardType="phone-pad"
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.profileInputContainer}>
                    <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>Email (Optional)</Text>
                    <TextInput
                      style={[styles.profileInput, { backgroundColor: colors.background, color: colors.textPrimary, borderColor: colors.border }]}
                      placeholder="your@email.com"
                      placeholderTextColor={colors.textMuted}
                      value={profileEmail}
                      onChangeText={setProfileEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      returnKeyType="done"
                      onSubmitEditing={handleSaveProfile}
                    />
                    <Text style={[styles.inputHint, { color: colors.textMuted }]}>
                      Optional: Add a real email to receive order updates
                    </Text>
                  </View>

                  <TouchableOpacity 
                    style={[styles.saveProfileButton, isSavingProfile && styles.saveProfileButtonDisabled]}
                    onPress={handleSaveProfile}
                    disabled={isSavingProfile}
                  >
                    {isSavingProfile ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <Text style={styles.saveProfileButtonText}>Save & Continue</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.cancelProfileButton} 
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowProfileModal(false);
                    }}
                  >
                    <Text style={[styles.cancelProfileButtonText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingContent: { backgroundColor: Colors.white, padding: 32, borderRadius: 16, alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: Fonts.size.md, color: Colors.textPrimary, fontWeight: Fonts.weight.medium },
  list: { padding: 16, paddingBottom: 220 },
  headerTitle: { fontSize: Fonts.size.xl, fontWeight: Fonts.weight.bold, color: Colors.textPrimary, marginBottom: 16 },
  cartItem: { marginBottom: 12 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemInfo: { flex: 1, marginRight: 16 },
  itemName: { fontSize: Fonts.size.md, fontWeight: Fonts.weight.semibold, color: Colors.textPrimary, marginBottom: 4 },
  packageName: { fontSize: Fonts.size.sm, color: Colors.textSecondary, marginBottom: 2 },
  duration: { fontSize: Fonts.size.xs, color: Colors.textMuted },
  itemRight: { alignItems: 'flex-end' },
  itemPrice: { fontSize: Fonts.size.lg, fontWeight: Fonts.weight.bold, color: Colors.accent, marginBottom: 8 },
  summaryContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.background, padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: Fonts.size.md, color: Colors.textSecondary },
  summaryValue: { fontSize: Fonts.size.md, color: Colors.textPrimary },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  totalLabel: { fontSize: Fonts.size.lg, fontWeight: Fonts.weight.bold, color: Colors.textPrimary },
  totalValue: { fontSize: Fonts.size.xl, fontWeight: Fonts.weight.bold, color: Colors.accent },
  checkoutButton: { marginTop: 16 },
  paymentOptionsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  paymentOptionsContainer: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  paymentOptionsTitle: { fontSize: Fonts.size.xl, fontWeight: Fonts.weight.bold, color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  paymentOptionsSubtitle: { fontSize: Fonts.size.md, color: Colors.textSecondary, textAlign: 'center', marginBottom: 24 },
  paymentOption: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.background, borderRadius: 12, marginBottom: 12 },
  paymentOptionIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  paymentOptionText: { flex: 1 },
  paymentOptionTitle: { fontSize: Fonts.size.md, fontWeight: Fonts.weight.semibold, color: Colors.textPrimary },
  paymentOptionDesc: { fontSize: Fonts.size.sm, color: Colors.textSecondary, marginTop: 2 },
  cancelButton: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  cancelButtonText: { fontSize: Fonts.size.md, color: Colors.textSecondary, fontWeight: Fonts.weight.medium },
  paymentDisclosure: { fontSize: Fonts.size.xs, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  webviewContainer: { flex: 1, backgroundColor: Colors.white },
  webviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  webviewTitle: { fontSize: Fonts.size.lg, fontWeight: Fonts.weight.bold, color: Colors.textPrimary },
  closeButton: { padding: 4 },
  webview: { flex: 1 },
  webviewLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white },
  webviewLoadingText: { marginTop: 16, fontSize: Fonts.size.md, color: Colors.textSecondary },
  // Profile Modal Styles
  keyboardAvoidingView: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  profileModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    paddingBottom: 24,
    maxHeight: '80%',
  },
  modalSubtitle: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  profileInputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  profileInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: Fonts.size.md,
    backgroundColor: Colors.background,
  },
  inputHint: {
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  saveProfileButton: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveProfileButtonDisabled: {
    opacity: 0.7,
  },
  saveProfileButtonText: {
    color: Colors.white,
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
  },
  cancelProfileButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelProfileButtonText: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
  },
});
