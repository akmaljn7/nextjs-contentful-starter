import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, Button, CustomDropdown } from '../../components/common';
import { useAuthStore } from '../../store';
import { consultationsApi, settingsApi, ordersApi, SiteSettings } from '../../api';
import { formatPrice } from '../../utils/formatters';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Default consultation packages (prices will be overridden by settings)
const getConsultationPackages = (settings: SiteSettings | null) => [
  {
    id: 'physical',
    title: 'In-Office Consultation',
    subtitle: 'Face-to-face meeting with our experts',
    icon: 'business-outline',
    price: settings?.consultation_price_office || 25000,
    duration: '1-2 Hours',
    color: Colors.primary,
    features: [
      'One-on-one session with senior strategist',
      'In-depth business analysis',
      'Customized advertising roadmap',
      'Budget allocation strategy',
      'Platform recommendations',
      'Printed strategy document',
      'Follow-up call within 7 days'
    ]
  },
  {
    id: 'online',
    title: 'Online Consultation',
    subtitle: 'Video call from anywhere',
    icon: 'videocam-outline',
    price: settings?.consultation_price_online || 15000,
    duration: '45-60 Minutes',
    color: Colors.accent,
    features: [
      'Video call with ad strategist',
      'Business overview analysis',
      'Advertising recommendations',
      'Budget planning assistance',
      'Digital strategy document',
      'Email follow-up support'
    ]
  }
];

const INDUSTRY_OPTIONS = [
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'food', label: 'Food & Restaurant' },
  { value: 'fashion', label: 'Fashion & Beauty' },
  { value: 'realestate', label: 'Real Estate' },
  { value: 'education', label: 'Education & Training' },
  { value: 'healthcare', label: 'Healthcare & Pharmacy' },
  { value: 'technology', label: 'Technology & IT' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'transport', label: 'Transportation & Logistics' },
  { value: 'entertainment', label: 'Entertainment & Events' },
  { value: 'finance', label: 'Financial Services' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'hospitality', label: 'Hospitality & Tourism' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'other', label: 'Other' },
];

const BUSINESS_STAGE_OPTIONS = [
  { value: 'idea', label: 'Just an idea' },
  { value: 'new', label: 'New business (0-1 year)' },
  { value: 'growing', label: 'Growing business (1-3 years)' },
  { value: 'established', label: 'Established business (3+ years)' },
  { value: 'expanding', label: 'Expanding to new markets' },
];

const BUDGET_RANGE_OPTIONS = [
  { value: 'under-100k', label: 'Under ₦100,000' },
  { value: '100k-500k', label: '₦100,000 - ₦500,000' },
  { value: '500k-1m', label: '₦500,000 - ₦1,000,000' },
  { value: '1m-5m', label: '₦1,000,000 - ₦5,000,000' },
  { value: 'above-5m', label: 'Above ₦5,000,000' },
  { value: 'not-sure', label: 'Not sure yet' },
];

const TIME_SLOT_OPTIONS = [
  { value: '9:00 AM', label: '9:00 AM' },
  { value: '10:00 AM', label: '10:00 AM' },
  { value: '11:00 AM', label: '11:00 AM' },
  { value: '12:00 PM', label: '12:00 PM' },
  { value: '1:00 PM', label: '1:00 PM' },
  { value: '2:00 PM', label: '2:00 PM' },
  { value: '3:00 PM', label: '3:00 PM' },
  { value: '4:00 PM', label: '4:00 PM' },
  { value: '5:00 PM', label: '5:00 PM' },
];

export const ConsultationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuthStore();
  
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<ReturnType<typeof getConsultationPackages>[0] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Payment states
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [currentConsultationId, setCurrentConsultationId] = useState<string | null>(null);
  
  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  const [formData, setFormData] = useState({
    businessName: '',
    industry: '',
    businessStage: '',
    description: '',
    goals: '',
    budgetRange: '',
    preferredDate: '',
    preferredTime: '',
    contactName: user?.name || '',
    contactPhone: user?.phone || '',
    contactEmail: user?.email || '',
  });

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
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Get packages with dynamic prices from settings
  const CONSULTATION_PACKAGES = getConsultationPackages(settings);

  // Generate date options for next 30 days
  const getDateOptions = () => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      // Skip weekends
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        const formattedDate = date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
        dates.push({
          value: date.toISOString().split('T')[0],
          label: formattedDate
        });
      }
    }
    return dates;
  };

  const handlePackageSelect = (pkg: typeof CONSULTATION_PACKAGES[0]) => {
    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to book a consultation',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => navigation.navigate('Auth', { screen: 'Login' }) }
        ]
      );
      return;
    }
    setSelectedPackage(pkg);
    setShowForm(true);
  };

  const handlePaymentComplete = () => {
    setPaymentModalVisible(false);
    setPaymentUrl(null);
    setShowSuccessModal(true);
  };

  const handleWebViewNavigationStateChange = (navState: any) => {
    if (navState.url.includes('/payment/callback') || navState.url.includes('trxref=')) {
      handlePaymentComplete();
    }
  };

  const handleSubmit = async () => {
    if (!selectedPackage || !user) return;

    // Validate required fields
    if (!formData.businessName || !formData.industry || !formData.description || !formData.contactPhone) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    if (!formData.preferredDate) {
      Alert.alert('Missing Information', 'Please select your preferred date');
      return;
    }

    if (!formData.preferredTime) {
      Alert.alert('Missing Information', 'Please select your preferred time');
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create consultation booking
      const consultationResponse = await consultationsApi.create({
        user_id: user.id,
        consultation_type: selectedPackage.id as 'online' | 'physical',
        package_title: selectedPackage.title,
        price: selectedPackage.price,
        business_name: formData.businessName,
        industry: formData.industry,
        business_stage: formData.businessStage,
        description: formData.description,
        goals: formData.goals,
        budget_range: formData.budgetRange,
        preferred_date: formData.preferredDate,
        preferred_time: formData.preferredTime,
        contact_name: formData.contactName || user.name,
        contact_email: formData.contactEmail || user.email,
        contact_phone: formData.contactPhone,
      });

      setCurrentConsultationId(consultationResponse.consultation?.id || null);

      // Step 2: Initialize Paystack payment
      const paymentData = await ordersApi.initializePayment({
        order_id: consultationResponse.consultation?.id || '',
        email: user.email,
        callback_url: 'https://www.lightban.com/payment/callback',
        amount: selectedPackage.price,
      });

      if (paymentData.authorization_url) {
        setPaymentUrl(paymentData.authorization_url);
        setIsSubmitting(false);
        setPaymentModalVisible(true);
      } else {
        throw new Error('Payment initialization failed');
      }
    } catch (error: any) {
      setIsSubmitting(false);
      Alert.alert('Error', error.message || 'Failed to process booking');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedPackage(null);
    setShowSuccessModal(false);
    setCurrentConsultationId(null);
    setFormData({
      businessName: '',
      industry: '',
      businessStage: '',
      description: '',
      goals: '',
      budgetRange: '',
      preferredDate: '',
      preferredTime: '',
      contactName: user?.name || '',
      contactPhone: user?.phone || '',
      contactEmail: user?.email || '',
    });
  };

  const handleViewOrders = () => {
    resetForm();
    navigation.navigate('OrdersTab');
  };

  const renderPackageCard = (pkg: typeof CONSULTATION_PACKAGES[0]) => (
    <TouchableOpacity
      key={pkg.id}
      activeOpacity={0.9}
      onPress={() => handlePackageSelect(pkg)}
    >
      <Card 
        variant={selectedPackage?.id === pkg.id ? 'elevated' : 'outlined'} 
        padding="none" 
        style={[
          styles.packageCard,
          selectedPackage?.id === pkg.id && styles.packageCardSelected
        ]}
      >
        {/* Header */}
        <View style={[styles.packageHeader, { backgroundColor: pkg.color }]}>
          <Ionicons name={pkg.icon as any} size={32} color={Colors.white} />
          <View style={styles.packageHeaderText}>
            <Text style={styles.packageTitle}>{pkg.title}</Text>
            <Text style={styles.packageSubtitle}>{pkg.subtitle}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.packageContent}>
          {/* Price */}
          <View style={styles.priceRow}>
            <Text style={styles.priceValue}>{formatPrice(pkg.price)}</Text>
            <Text style={styles.priceDuration}>{pkg.duration}</Text>
          </View>

          {/* Features */}
          <View style={styles.featuresList}>
            {pkg.features.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Select Button */}
          <Button
            title={selectedPackage?.id === pkg.id ? 'Selected' : 'Select Package'}
            variant={selectedPackage?.id === pkg.id ? 'secondary' : 'primary'}
            fullWidth
            onPress={() => handlePackageSelect(pkg)}
          />
        </View>
      </Card>
    </TouchableOpacity>
  );

  // Success Modal Component
  const SuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      transparent
      animationType="fade"
      onRequestClose={() => {}}
    >
      <View style={styles.successModalOverlay}>
        <View style={styles.successModalContent}>
          {/* Success Icon */}
          <View style={styles.successIconContainer}>
            <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
          </View>
          
          {/* Title */}
          <Text style={styles.successTitle}>Booking Confirmed!</Text>
          
          {/* Message */}
          <Text style={styles.successMessage}>
            Your consultation has been booked successfully. We've sent a confirmation email with all the details.
          </Text>
          
          {/* Package Info */}
          {selectedPackage && (
            <View style={styles.successPackageInfo}>
              <View style={[styles.successPackageIcon, { backgroundColor: selectedPackage.color }]}>
                <Ionicons name={selectedPackage.icon as any} size={24} color={Colors.white} />
              </View>
              <View style={styles.successPackageDetails}>
                <Text style={styles.successPackageTitle}>{selectedPackage.title}</Text>
                <Text style={styles.successPackagePrice}>{formatPrice(selectedPackage.price)}</Text>
              </View>
            </View>
          )}
          
          {/* Schedule Info */}
          <View style={styles.successScheduleBox}>
            <View style={styles.successScheduleRow}>
              <Ionicons name="calendar-outline" size={20} color={Colors.accent} />
              <Text style={styles.successScheduleText}>
                {formData.preferredDate && new Date(formData.preferredDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </Text>
            </View>
            <View style={styles.successScheduleRow}>
              <Ionicons name="time-outline" size={20} color={Colors.accent} />
              <Text style={styles.successScheduleText}>{formData.preferredTime}</Text>
            </View>
          </View>
          
          {/* Buttons */}
          <View style={styles.successButtons}>
            <Button
              title="View My Orders"
              onPress={handleViewOrders}
              fullWidth
              size="lg"
            />
            <TouchableOpacity 
              style={styles.successSecondaryButton}
              onPress={resetForm}
            >
              <Text style={styles.successSecondaryButtonText}>Book Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Get Expert Advice</Text>
          <Text style={styles.headerSubtitle}>
            Book a consultation with our advertising experts to create your perfect marketing strategy
          </Text>
        </View>

        {/* Loading State */}
        {isLoadingSettings && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
            <Text style={styles.loadingText}>Loading packages...</Text>
          </View>
        )}

        {/* Package Selection */}
        {!showForm && !isLoadingSettings && (
          <View style={styles.packagesSection}>
            <Text style={styles.sectionTitle}>Choose Your Package</Text>
            {CONSULTATION_PACKAGES.map(renderPackageCard)}
          </View>
        )}

        {/* Consultation Form */}
        {showForm && selectedPackage && (
          <View style={styles.formSection}>
            {/* Selected Package Summary */}
            <Card variant="default" padding="md" style={styles.selectedPackageCard}>
              <View style={styles.selectedPackageRow}>
                <View style={[styles.selectedPackageIcon, { backgroundColor: selectedPackage.color }]}>
                  <Ionicons name={selectedPackage.icon as any} size={24} color={Colors.white} />
                </View>
                <View style={styles.selectedPackageInfo}>
                  <Text style={styles.selectedPackageTitle}>{selectedPackage.title}</Text>
                  <Text style={styles.selectedPackagePrice}>{formatPrice(selectedPackage.price)}</Text>
                </View>
                <TouchableOpacity onPress={() => { setShowForm(false); setSelectedPackage(null); }}>
                  <Ionicons name="close-circle" size={24} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </Card>

            <Text style={styles.sectionTitle}>Tell Us About Your Business</Text>

            {/* Business Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your business name"
                placeholderTextColor={Colors.textMuted}
                value={formData.businessName}
                onChangeText={(text) => setFormData({ ...formData, businessName: text })}
              />
            </View>

            {/* Industry */}
            <CustomDropdown
              label="Industry *"
              placeholder="Select Industry"
              value={formData.industry}
              options={INDUSTRY_OPTIONS}
              onValueChange={(value) => setFormData({ ...formData, industry: value })}
            />

            {/* Business Stage */}
            <CustomDropdown
              label="Business Stage *"
              placeholder="Select Business Stage"
              value={formData.businessStage}
              options={BUSINESS_STAGE_OPTIONS}
              onValueChange={(value) => setFormData({ ...formData, businessStage: value })}
            />

            {/* Description */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Describe Your Business *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us about your business and what you'd like to achieve..."
                placeholderTextColor={Colors.textMuted}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Goals */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Advertising Goals</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="What do you hope to achieve with advertising?"
                placeholderTextColor={Colors.textMuted}
                value={formData.goals}
                onChangeText={(text) => setFormData({ ...formData, goals: text })}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Budget Range */}
            <CustomDropdown
              label="Advertising Budget"
              placeholder="Select Budget Range"
              value={formData.budgetRange}
              options={BUDGET_RANGE_OPTIONS}
              onValueChange={(value) => setFormData({ ...formData, budgetRange: value })}
            />

            <Text style={styles.sectionTitle}>Preferred Schedule</Text>

            {/* Preferred Date */}
            <CustomDropdown
              label="Preferred Date *"
              placeholder="Select Date"
              value={formData.preferredDate}
              options={getDateOptions()}
              onValueChange={(value) => setFormData({ ...formData, preferredDate: value })}
            />

            {/* Preferred Time */}
            <CustomDropdown
              label="Preferred Time *"
              placeholder="Select Time"
              value={formData.preferredTime}
              options={TIME_SLOT_OPTIONS}
              onValueChange={(value) => setFormData({ ...formData, preferredTime: value })}
            />

            <Text style={styles.sectionTitle}>Contact Information</Text>

            {/* Contact Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={Colors.textMuted}
                value={formData.contactName}
                onChangeText={(text) => setFormData({ ...formData, contactName: text })}
              />
            </View>

            {/* Contact Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="Your phone number"
                placeholderTextColor={Colors.textMuted}
                value={formData.contactPhone}
                onChangeText={(text) => setFormData({ ...formData, contactPhone: text })}
                keyboardType="phone-pad"
              />
            </View>

            {/* Contact Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Your email"
                placeholderTextColor={Colors.textMuted}
                value={formData.contactEmail}
                onChangeText={(text) => setFormData({ ...formData, contactEmail: text })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Payment Summary */}
            <Card variant="outlined" padding="md" style={styles.paymentSummary}>
              <Text style={styles.paymentSummaryTitle}>Payment Summary</Text>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>{selectedPackage.title}</Text>
                <Text style={styles.paymentValue}>{formatPrice(selectedPackage.price)}</Text>
              </View>
              <View style={styles.paymentDivider} />
              <View style={styles.paymentRow}>
                <Text style={styles.paymentTotalLabel}>Total</Text>
                <Text style={styles.paymentTotalValue}>{formatPrice(selectedPackage.price)}</Text>
              </View>
            </Card>

            {/* Submit Button */}
            <Button
              title={`Pay ${formatPrice(selectedPackage.price)}`}
              onPress={handleSubmit}
              loading={isSubmitting}
              fullWidth
              size="lg"
              style={styles.submitButton}
            />
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Paystack Payment Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        onRequestClose={() => {
          setPaymentModalVisible(false);
          setPaymentUrl(null);
        }}
      >
        <View style={styles.paymentModalContainer}>
          <View style={styles.paymentModalHeader}>
            <TouchableOpacity 
              onPress={() => {
                setPaymentModalVisible(false);
                setPaymentUrl(null);
              }}
              style={styles.paymentCloseButton}
            >
              <Ionicons name="close" size={28} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.paymentModalTitle}>Complete Payment</Text>
            <View style={styles.paymentCloseButton} />
          </View>
          
          {paymentUrl ? (
            <WebView
              source={{ uri: paymentUrl }}
              style={styles.webview}
              onNavigationStateChange={handleWebViewNavigationStateChange}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.webviewLoading}>
                  <ActivityIndicator size="large" color={Colors.accent} />
                  <Text style={styles.webviewLoadingText}>Loading payment...</Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.webviewLoading}>
              <ActivityIndicator size="large" color={Colors.accent} />
            </View>
          )}
        </View>
      </Modal>

      {/* Success Modal */}
      <SuccessModal />
    </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.white,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: Fonts.size.md,
    color: Colors.white + 'cc',
    lineHeight: 22,
  },
  packagesSection: {
    padding: 20,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
  },
  sectionTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
    marginTop: 8,
  },
  packageCard: {
    marginBottom: 20,
    overflow: 'hidden',
  },
  packageCardSelected: {
    borderColor: Colors.accent,
    borderWidth: 2,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  packageHeaderText: {
    flex: 1,
  },
  packageTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.white,
  },
  packageSubtitle: {
    fontSize: Fonts.size.sm,
    color: Colors.white + 'cc',
    marginTop: 2,
  },
  packageContent: {
    padding: 20,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  priceValue: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  priceDuration: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginLeft: 8,
  },
  featuresList: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  featureText: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  formSection: {
    padding: 20,
  },
  selectedPackageCard: {
    marginBottom: 20,
  },
  selectedPackageRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectedPackageIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedPackageInfo: {
    flex: 1,
  },
  selectedPackageTitle: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
  },
  selectedPackagePrice: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  paymentSummary: {
    marginTop: 16,
    marginBottom: 8,
  },
  paymentSummaryTitle: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  paymentLabel: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  paymentValue: {
    fontSize: Fonts.size.sm,
    color: Colors.textPrimary,
    fontWeight: Fonts.weight.medium,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  paymentTotalLabel: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  paymentTotalValue: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  submitButton: {
    marginTop: 10,
  },
  bottomSpacing: {
    height: 40,
  },
  // Payment Modal
  paymentModalContainer: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  paymentModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  paymentCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentModalTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.white,
  },
  webview: {
    flex: 1,
  },
  webviewLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  webviewLoadingText: {
    marginTop: 12,
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
  },
  // Success Modal
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalContent: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  successPackageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gray[50],
    borderRadius: 12,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  successPackageIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  successPackageDetails: {
    flex: 1,
  },
  successPackageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  successPackagePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  successScheduleBox: {
    backgroundColor: Colors.accent + '10',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  successScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  successScheduleText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  successButtons: {
    width: '100%',
  },
  successSecondaryButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  successSecondaryButtonText: {
    fontSize: 15,
    color: Colors.accent,
    fontWeight: '600',
  },
});
