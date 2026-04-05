import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Button, Input } from '../../components/common';
import { useAuthStore } from '../../store';
import { validateRegisterForm } from '../../utils/validators';
import { AuthStackParamList } from '../../types/navigation';

type RegisterScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

const TERMS_AND_CONDITIONS = `ADLINKA - TERMS AND CONDITIONS

Last Updated: March 2024

1. INTRODUCTION
Welcome to Adlinka ("Platform", "we", "us", or "our"). These Terms and Conditions ("Terms") govern your use of our advertising marketplace platform connecting advertisers with suppliers including influencers, billboard owners, digital ad platforms, and Kannywood production companies in Northern Nigeria.

By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree to these Terms, please do not use the Platform.

2. DEFINITIONS
- "Advertiser" refers to individuals or businesses seeking advertising services
- "Supplier" refers to influencers, billboard owners, digital ad platforms, and other service providers
- "Services" refers to advertising placement and related services offered through the Platform
- "Content" refers to all materials, data, and information uploaded to the Platform

3. ACCOUNT REGISTRATION
3.1 You must provide accurate, current, and complete information during registration
3.2 You are responsible for maintaining the confidentiality of your account credentials
3.3 You must be at least 18 years old to create an account
3.4 We reserve the right to suspend or terminate accounts that violate these Terms

4. PLATFORM SERVICES
4.1 Adlinka facilitates connections between Advertisers and Suppliers
4.2 We do not guarantee the availability, quality, or performance of any advertising service
4.3 All transactions are subject to our platform fee as displayed during checkout
4.4 We reserve the right to modify services and pricing at any time

5. PAYMENT TERMS
5.1 All payments are processed securely through our payment partners (Paystack)
5.2 Prices are displayed in Nigerian Naira (₦)
5.3 Platform fees are non-refundable once a service has been initiated
5.4 Refund requests are handled on a case-by-case basis

6. USER RESPONSIBILITIES
6.1 Advertisers must provide accurate campaign information and materials
6.2 Suppliers must deliver services as described and agreed upon
6.3 Users must not engage in fraudulent, misleading, or illegal activities
6.4 Users must respect intellectual property rights

7. CONTENT GUIDELINES
7.1 All content must comply with Nigerian advertising standards and regulations
7.2 Content promoting illegal products, hate speech, or adult material is prohibited
7.3 We reserve the right to remove content that violates these guidelines

8. DISPUTE RESOLUTION
8.1 We encourage users to resolve disputes amicably
8.2 We may mediate disputes but are not obligated to do so
8.3 Our decision on platform-related disputes is final

9. LIMITATION OF LIABILITY
9.1 Adlinka is not liable for:
   - Service quality delivered by Suppliers
   - Losses resulting from user disputes
   - Technical issues beyond our control
   - Third-party actions or content

10. PRIVACY
Your use of the Platform is also governed by our Privacy Policy, which is incorporated into these Terms by reference.

11. MODIFICATIONS
We reserve the right to modify these Terms at any time. Continued use of the Platform after modifications constitutes acceptance of the updated Terms.

12. CONTACT INFORMATION
For questions about these Terms, please contact:
Adlinka
Email: support@adlinka.com
Phone: +234 XXX XXX XXXX
Address: Kano, Nigeria

By using Adlinka, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.`;

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showTermsModal, setShowTermsModal] = useState(false);

  const handleRegister = async () => {
    clearError();
    
    // Validate form (without confirm password)
    const errors = validateRegisterForm(name, email, password, phone);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    setFormErrors({});
    await register({ name, email, password, phone });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to get started with Adlinka</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {error && (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={20} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Input
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your full name"
              autoCapitalize="words"
              error={formErrors.name}
              leftIcon={<Ionicons name="person-outline" size={20} color={Colors.textMuted} />}
            />

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              error={formErrors.email}
              leftIcon={<Ionicons name="mail-outline" size={20} color={Colors.textMuted} />}
            />

            <Input
              label="Phone Number *"
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              error={formErrors.phone}
              leftIcon={<Ionicons name="call-outline" size={20} color={Colors.textMuted} />}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              secureTextEntry
              error={formErrors.password}
              leftIcon={<Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} />}
            />

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={isLoading}
              fullWidth
              size="lg"
              style={styles.registerButton}
            />

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.termsText}>
              By creating an account, you agree to our{' '}
              <Text style={styles.termsLink} onPress={() => setShowTermsModal(true)}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink} onPress={() => setShowTermsModal(true)}>Privacy Policy</Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Terms and Conditions Modal */}
      <Modal
        visible={showTermsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terms & Conditions</Text>
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowTermsModal(false)}
            >
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView 
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.termsContent}>{TERMS_AND_CONDITIONS}</Text>
            <View style={styles.modalBottomSpacing} />
          </ScrollView>
          <View style={styles.modalFooter}>
            <Button
              title="I Understand"
              onPress={() => setShowTermsModal(false)}
              fullWidth
            />
          </View>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: Fonts.size['3xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
  },
  form: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.errorLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    color: Colors.error,
    fontSize: Fonts.size.sm,
    flex: 1,
  },
  registerButton: {
    marginTop: 8,
    marginBottom: 24,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  loginText: {
    color: Colors.textSecondary,
    fontSize: Fonts.size.md,
  },
  loginLink: {
    color: Colors.accent,
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
  },
  termsText: {
    fontSize: Fonts.size.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  modalTitle: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  termsContent: {
    fontSize: Fonts.size.sm,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  modalBottomSpacing: {
    height: 40,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
});
