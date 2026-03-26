import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, LoadingSpinner, ErrorMessage } from '../../components/common';
import { PackageCard } from '../../components/cards';
import { digitalAdsApi } from '../../api';
import { useCartStore } from '../../store';
import { DigitalAd } from '../../types/api';

// Platform icons and colors
const getPlatformIcon = (platform: string): string => {
  const icons: Record<string, string> = {
    facebook: 'logo-facebook',
    instagram: 'logo-instagram',
    twitter: 'logo-twitter',
    tiktok: 'logo-tiktok',
    youtube: 'logo-youtube',
    google: 'logo-google',
    whatsapp: 'logo-whatsapp',
  };
  return icons[platform?.toLowerCase()] || 'globe-outline';
};

const getPlatformColor = (platform: string): string => {
  const colors: Record<string, string> = {
    facebook: '#1877F2',
    instagram: '#E4405F',
    twitter: '#1DA1F2',
    tiktok: '#000000',
    youtube: '#FF0000',
    google: '#4285F4',
    whatsapp: '#25D366',
  };
  return colors[platform?.toLowerCase()] || Colors.accent;
};

export const DigitalAdDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const { id } = route.params;
  const { items: cartItems, addItem } = useCartStore();

  const [digitalAd, setDigitalAd] = useState<DigitalAd | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDigitalAd();
  }, [id]);

  const loadDigitalAd = async () => {
    try {
      setError(null);
      const data = await digitalAdsApi.getById(id);
      setDigitalAd(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load digital ad');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleAddToCart = (pkg: any) => {
    if (!digitalAd) return;

    addItem({
      id: `${digitalAd.id}-${pkg.id}`,
      listingType: 'digital_ad',
      listingId: digitalAd.id,
      listingName: digitalAd.name || digitalAd.id,
      packageId: pkg.id,
      packageTitle: pkg.title,
      price: pkg.price,
      duration: pkg.duration,
      deliverables: pkg.deliverables || [],
      image_url: digitalAd.image_url,
    });
  };

  const isInCart = (pkgId: string) => {
    return cartItems.some(item => item.id === `${id}-${pkgId}`);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  if (error || !digitalAd) {
    return <ErrorMessage message={error || 'Digital ad not found'} onRetry={loadDigitalAd} fullScreen />;
  }

  const platformColor = getPlatformColor(digitalAd.id);
  const platformIcon = getPlatformIcon(digitalAd.id);

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={loadDigitalAd} />
      }
    >
      {/* Header with Platform Color */}
      <View style={[styles.header, { backgroundColor: platformColor }]}>
        <Ionicons name={platformIcon as any} size={64} color={Colors.white} />
        <Text style={styles.platformName}>{digitalAd.name || digitalAd.id}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Description */}
        <Card variant="outlined" padding="md" style={styles.descriptionCard}>
          <Text style={styles.sectionTitle}>About This Service</Text>
          <Text style={styles.description}>{digitalAd.description}</Text>
        </Card>

        {/* Packages */}
        {digitalAd.packages && digitalAd.packages.length > 0 && (
          <View style={styles.packagesSection}>
            <Text style={styles.sectionTitle}>Available Packages</Text>
            {digitalAd.packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                package_={pkg}
                onSelect={() => handleAddToCart(pkg)}
                isInCart={isInCart(pkg.id)}
              />
            ))}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformName: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.white,
    marginTop: 16,
    textTransform: 'capitalize',
  },
  content: {
    padding: 20,
    marginTop: -20,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  descriptionCard: {
    marginBottom: 24,
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
  packagesSection: {
    marginBottom: 24,
  },
  bottomSpacing: {
    height: 40,
  },
});
