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
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, Button, LoadingSpinner } from '../../components/common';
import { useAuthStore } from '../../store';
import { consultationsApi } from '../../api';
import { formatPrice } from '../../utils/formatters';

// Consultation packages
const CONSULTATION_PACKAGES = [
  {
    id: 'physical',
    title: 'In-Office Consultation',
    subtitle: 'Face-to-face meeting with our experts',
    icon: 'business-outline',
    price: 25000,
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
    price: 15000,
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
  'Food & Beverage',
  'Fashion & Apparel',
  'Real Estate',
  'Healthcare',
  'Education',
  'Finance & Banking',
  'Technology',
  'Entertainment',
  'Agriculture',
  'Manufacturing',
  'Other'
];

export const ConsultationScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, isAuthenticated } = useAuthStore();
  
  const [selectedPackage, setSelectedPackage] = useState<typeof CONSULTATION_PACKAGES[0] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    businessName: '',
    industry: '',
    description: '',
    goals: '',
    budgetRange: '',
    preferredDate: '',
    preferredTime: '',
    contactName: user?.name || '',
    contactPhone: user?.phone || '',
    contactEmail: user?.email || '',
  });

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

    setIsSubmitting(true);

    try {
      const response = await consultationsApi.create({
        user_id: user.id,
        consultation_type: selectedPackage.id as 'online' | 'physical',
        package_title: selectedPackage.title,
        price: selectedPackage.price,
        business_name: formData.businessName,
        industry: formData.industry,
        business_stage: '',
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.industryScroll}>
                {INDUSTRIES.map((industry) => (
                  <TouchableOpacity
                    key={industry}
                    style={[
                      styles.industryChip,
                      formData.industry === industry && styles.industryChipSelected
                    ]}
                    onPress={() => setFormData({ ...formData, industry })}
                  >
                    <Text style={[
                      styles.industryChipText,
                      formData.industry === industry && styles.industryChipTextSelected
                    ]}>{industry}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
  industryScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  industryChip: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  industryChipSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  industryChipText: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  industryChipTextSelected: {
    color: Colors.white,
    fontWeight: Fonts.weight.medium,
  },
  submitButton: {
    marginTop: 10,
  },
  bottomSpacing: {
    height: 40,
  },
});
