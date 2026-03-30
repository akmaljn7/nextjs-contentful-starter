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

export const AboutScreen: React.FC = () => {
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
      {/* Company Info */}
      <Card variant="elevated" padding="lg" style={styles.card}>
        <View style={styles.logoContainer}>
          <View style={styles.logoPlaceholder}>
            <Ionicons name="megaphone" size={48} color={Colors.accent} />
          </View>
        </View>
        <Text style={styles.companyName}>{settings?.site_name || 'Adlinka'}</Text>
        <Text style={styles.tagline}>{settings?.tagline || 'Your trusted advertising partner in Northern Nigeria'}</Text>
      </Card>

      {/* About */}
      <Card variant="outlined" padding="md" style={styles.card}>
        <Text style={styles.sectionTitle}>About Us</Text>
        <Text style={styles.description}>
          {settings?.seo_description || 
            'Adlinka is the premier advertising marketplace in Northern Nigeria. We connect businesses with verified influencers, premium billboard locations, digital advertising platforms, and Kannywood movie placements.'}
        </Text>
      </Card>

      {/* Contact Info */}
      <Card variant="outlined" padding="md" style={styles.card}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        
        {settings?.contact_email && (
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => openLink(`mailto:${settings.contact_email}`)}
          >
            <Ionicons name="mail-outline" size={20} color={Colors.accent} />
            <Text style={styles.contactText}>{settings.contact_email}</Text>
          </TouchableOpacity>
        )}
        
        {settings?.contact_phone && (
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => openLink(`tel:${settings.contact_phone}`)}
          >
            <Ionicons name="call-outline" size={20} color={Colors.accent} />
            <Text style={styles.contactText}>{settings.contact_phone}</Text>
          </TouchableOpacity>
        )}
        
        {settings?.office_address && (
          <View style={styles.contactItem}>
            <Ionicons name="location-outline" size={20} color={Colors.accent} />
            <Text style={styles.contactText}>{settings.office_address}</Text>
          </View>
        )}
        
        {settings?.business_hours && (
          <View style={styles.contactItem}>
            <Ionicons name="time-outline" size={20} color={Colors.accent} />
            <Text style={styles.contactText}>{settings.business_hours}</Text>
          </View>
        )}
      </Card>

      {/* Social Links */}
      {settings?.social_links && Object.keys(settings.social_links).length > 0 && (
        <Card variant="outlined" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>Follow Us</Text>
          <View style={styles.socialLinks}>
            {Object.entries(settings.social_links).map(([platform, url]) => {
              if (!url) return null;
              const iconName = platform === 'facebook' ? 'logo-facebook' :
                              platform === 'instagram' ? 'logo-instagram' :
                              platform === 'twitter' ? 'logo-twitter' :
                              platform === 'linkedin' ? 'logo-linkedin' :
                              platform === 'youtube' ? 'logo-youtube' :
                              platform === 'tiktok' ? 'logo-tiktok' : 'globe-outline';
              return (
                <TouchableOpacity
                  key={platform}
                  style={styles.socialButton}
                  onPress={() => openLink(url)}
                >
                  <Ionicons name={iconName as any} size={24} color={Colors.accent} />
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>
      )}

      {/* App Version */}
      <View style={styles.versionContainer}>
        <Text style={styles.versionText}>Version 1.0.0</Text>
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
  logoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyName: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  tagline: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  description: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  contactText: {
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
    flex: 1,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 16,
  },
  socialButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: Fonts.size.sm,
    color: Colors.textMuted,
  },
  bottomSpacing: {
    height: 32,
  },
});
