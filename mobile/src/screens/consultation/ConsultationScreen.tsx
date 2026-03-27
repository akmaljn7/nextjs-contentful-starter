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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, Button, LoadingSpinner } from '../../components/common';
import { useAuthStore } from '../../store';
import { consultationsApi, settingsApi, SiteSettings } from '../../api';
import { formatPrice } from '../../utils/formatters';

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

const INDUSTRIES = [
  'Retail & E-commerce',
  'Food & Restaurant',
  'Fashion & Beauty',
  'Real Estate',
  'Education & Training',
  'Healthcare & Pharmacy',
  'Technology & IT',
  'Agriculture',
  'Transportation & Logistics',
  'Entertainment & Events',
  'Financial Services',
  'Manufacturing',
  'Hospitality & Tourism',
  'Professional Services',
  'Other'
];

const BUSINESS_STAGES = [
  { value: 'idea', label: 'Just an idea' },
  { value: 'new', label: 'New business (0-1 year)' },
  { value: 'growing', label: 'Growing business (1-3 years)' },
  { value: 'established', label: 'Established business (3+ years)' },
  { value: 'expanding', label: 'Expanding to new markets' }
];

const BUDGET_RANGES = [
  { value: 'under-100k', label: 'Under ₦100,000' },
  { value: '100k-500k', label: '₦100,000 - ₦500,000' },
  { value: '500k-1m', label: '₦500,000 - ₦1,000,000' },
  { value: '1m-5m', label: '₦1,000,000 - ₦5,000,000' },
  { value: 'above-5m', label: 'Above ₦5,000,000' },
  { value: 'not-sure', label: 'Not sure yet' }
];

const TIME_SLOTS = [
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM'
];

export const ConsultationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuthStore();
  
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState<ReturnType<typeof getConsultationPackages>[0] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
      const response = await consultationsApi.create({
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

      Alert.alert(
        'Consultation Booked!',
        'Your consultation request has been submitted. Our team will contact you shortly to confirm your appointment.',
        [
          { 
            text: 'View My Consultations', 
            onPress: () => navigation.navigate('OrdersTab') 
          }
        ]
      );

      // Reset form
      setShowForm(false);
      setSelectedPackage(null);
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

    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit consultation request');
    } finally {
      setIsSubmitting(false);
    }
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

        {/* Package Selection */}
        {!showForm && (
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
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Industry *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.industry}
                  onValueChange={(value) => setFormData({ ...formData, industry: value })}
                  style={styles.picker}
                  itemStyle={styles.pickerItemStyle}
                  dropdownIconColor="#111827"
                >
                  <Picker.Item label="Select Industry" value="" color="#6b7280" />
                  {INDUSTRIES.map((industry) => (
                    <Picker.Item key={industry} label={industry} value={industry} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Business Stage */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Stage *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.businessStage}
                  onValueChange={(value) => setFormData({ ...formData, businessStage: value })}
                  style={styles.picker}
                  itemStyle={styles.pickerItemStyle}
                  dropdownIconColor="#111827"
                >
                  <Picker.Item label="Select Business Stage" value="" color="#6b7280" />
                  {BUSINESS_STAGES.map((stage) => (
                    <Picker.Item key={stage.value} label={stage.label} value={stage.value} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

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
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Advertising Budget</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.budgetRange}
                  onValueChange={(value) => setFormData({ ...formData, budgetRange: value })}
                  style={styles.picker}
                  itemStyle={styles.pickerItemStyle}
                  dropdownIconColor="#111827"
                >
                  <Picker.Item label="Select Budget Range" value="" color="#6b7280" />
                  {BUDGET_RANGES.map((range) => (
                    <Picker.Item key={range.value} label={range.label} value={range.value} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Preferred Schedule</Text>

            {/* Preferred Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred Date *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.preferredDate}
                  onValueChange={(value) => setFormData({ ...formData, preferredDate: value })}
                  style={styles.picker}
                  itemStyle={styles.pickerItemStyle}
                  dropdownIconColor="#111827"
                >
                  <Picker.Item label="Select Date" value="" color="#6b7280" />
                  {getDateOptions().map((date) => (
                    <Picker.Item key={date.value} label={date.label} value={date.value} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

            {/* Preferred Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred Time *</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formData.preferredTime}
                  onValueChange={(value) => setFormData({ ...formData, preferredTime: value })}
                  style={styles.picker}
                  itemStyle={styles.pickerItemStyle}
                  dropdownIconColor="#111827"
                >
                  <Picker.Item label="Select Time" value="" color="#6b7280" />
                  {TIME_SLOTS.map((time) => (
                    <Picker.Item key={time} label={time} value={time} color="#111827" />
                  ))}
                </Picker>
              </View>
            </View>

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

            {/* Submit Button */}
            <Button
              title="Submit Consultation Request"
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
    marginBottom: 20,
  },
  label: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#111827',
  },
  pickerItemStyle: {
    fontSize: 16,
    color: '#111827',
  },
  submitButton: {
    marginTop: 10,
  },
  bottomSpacing: {
    height: 40,
  },
});
