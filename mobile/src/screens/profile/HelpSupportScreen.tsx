import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, LoadingSpinner, ErrorMessage } from '../../components/common';
import { settingsApi, SiteSettings } from '../../api';

export const HelpSupportScreen: React.FC = () => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setError(null);
      const data = await settingsApi.getSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load information');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadSettings();
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(console.error);
  };

  const FAQ_ITEMS = [
    {
      question: 'How do I book an advertising service?',
      answer: 'Browse our services (Influencers, Billboards, Digital Ads, or Kannywood), select a package, add to cart, and proceed to checkout. You can pay online or at our office.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept online payments via Paystack (cards, bank transfer) and cash payments at our office.'
    },
    {
      question: 'How long does it take to see my ad go live?',
      answer: 'Timing varies by service. Billboard ads typically go live within 24-48 hours. Influencer posts depend on the creator\'s schedule. Digital ads start within hours of payment.'
    },
    {
      question: 'Can I cancel or modify my order?',
      answer: 'Contact our support team as soon as possible. Cancellations may be subject to our terms based on how far along the service is.'
    },
    {
      question: 'How do I track my order?',
      answer: 'Go to "My Orders" in the app to view your order status and timeline. You\'ll also receive email updates.'
    },
  ];

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadSettings} fullScreen />;
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
    >
      {/* Contact Support */}
      <Card variant="elevated" padding="lg" style={styles.card}>
        <View style={styles.headerIcon}>
          <Ionicons name="headset" size={48} color={Colors.accent} />
        </View>
        <Text style={styles.headerTitle}>Need Help?</Text>
        <Text style={styles.headerSubtitle}>Our support team is here to assist you</Text>
        
        <View style={styles.contactButtons}>
          {settings?.contact_phone && (
            <TouchableOpacity 
              style={styles.contactButton}
              onPress={() => openLink(`tel:${settings.contact_phone}`)}
            >
              <Ionicons name="call" size={20} color={Colors.white} />
              <Text style={styles.contactButtonText}>Call Us</Text>
            </TouchableOpacity>
          )}
          
          {settings?.contact_email && (
            <TouchableOpacity 
              style={[styles.contactButton, styles.emailButton]}
              onPress={() => openLink(`mailto:${settings.contact_email}`)}
            >
              <Ionicons name="mail" size={20} color={Colors.accent} />
              <Text style={[styles.contactButtonText, styles.emailButtonText]}>Email Us</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>

      {/* Business Hours */}
      {settings?.business_hours && (
        <Card variant="outlined" padding="md" style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={24} color={Colors.accent} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Business Hours</Text>
              <Text style={styles.infoValue}>{settings.business_hours}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Office Address */}
      {settings?.office_address && (
        <Card variant="outlined" padding="md" style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={24} color={Colors.accent} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Office Location</Text>
              <Text style={styles.infoValue}>{settings.office_address}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* FAQ Section */}
      <View style={styles.faqSection}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        
        {FAQ_ITEMS.map((item, index) => (
          <Card key={index} variant="outlined" padding="md" style={styles.faqCard}>
            <Text style={styles.faqQuestion}>{item.question}</Text>
            <Text style={styles.faqAnswer}>{item.answer}</Text>
          </Card>
        ))}
      </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  card: {
    margin: 16,
    marginBottom: 0,
  },
  headerIcon: {
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  emailButton: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  contactButtonText: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.white,
  },
  emailButtonText: {
    color: Colors.accent,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
    fontWeight: Fonts.weight.medium,
  },
  faqSection: {
    padding: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  faqCard: {
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  bottomSpacing: {
    height: 32,
  },
});
