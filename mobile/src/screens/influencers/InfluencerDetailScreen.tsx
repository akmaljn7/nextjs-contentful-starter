import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  RefreshControl,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, LoadingSpinner, ErrorMessage, Badge } from '../../components/common';
import { PackageCard } from '../../components/cards';
import { influencersApi } from '../../api';
import { useCartStore } from '../../store';
import { Influencer } from '../../types/api';
import { formatNumber, getPlatformIcon } from '../../utils/formatters';

export const InfluencerDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const { id } = route.params;
  const { items: cartItems, addItem } = useCartStore();

  const [influencer, setInfluencer] = useState<Influencer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInfluencer();
  }, [id]);

  const loadInfluencer = async () => {
    try {
      setError(null);
      const data = await influencersApi.getById(id);
      setInfluencer(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load influencer');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleAddToCart = (pkg: any) => {
    if (!influencer) return;

    addItem({
      id: `${influencer.id}-${pkg.id}`,
      listingType: 'influencer',
      listingId: influencer.id,
      listingName: influencer.name,
      packageId: pkg.id,
      packageTitle: pkg.title,
      price: pkg.price,
      duration: pkg.duration,
      deliverables: pkg.deliverables || [],
      image_url: influencer.image_url,
    });
  };

  const isInCart = (pkgId: string) => {
    return cartItems.some(item => item.id === `${id}-${pkgId}`);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  if (error || !influencer) {
    return <ErrorMessage message={error || 'Influencer not found'} onRetry={loadInfluencer} fullScreen />;
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={loadInfluencer} />
      }
    >
      {/* Header Image */}
      <View style={styles.headerImage}>
        {influencer.image_url ? (
          <Image source={{ uri: influencer.image_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="person" size={64} color={Colors.gray[400]} />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <View style={styles.nameContainer}>
            <Text style={styles.name}>{influencer.name}</Text>
            {influencer.verified && (
              <Ionicons name="checkmark-circle" size={24} color={Colors.info} style={styles.verifiedIcon} />
            )}
          </View>
          <View style={[styles.platformBadge, { backgroundColor: Colors.accent }]}>
            <Ionicons name={getPlatformIcon(influencer.platform) as any} size={16} color={Colors.white} />
            <Text style={styles.platformText}>{influencer.platform}</Text>
          </View>
        </View>

        <Text style={styles.handle}>@{influencer.handle}</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatNumber(influencer.followers)}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          {influencer.engagement_rate && (
            <View style={styles.stat}>
              <Text style={styles.statValue}>{influencer.engagement_rate}%</Text>
              <Text style={styles.statLabel}>Engagement</Text>
            </View>
          )}
          <View style={styles.stat}>
            <Badge text={influencer.category} variant="default" size="sm" />
            <Text style={styles.statLabel}>Category</Text>
          </View>
        </View>

        {/* Description */}
        <Card variant="outlined" padding="md" style={styles.descriptionCard}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{influencer.description}</Text>
        </Card>

        {/* Packages */}
        {influencer.packages && influencer.packages.length > 0 && (
          <View style={styles.packagesSection}>
            <Text style={styles.sectionTitle}>Available Packages</Text>
            {influencer.packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                package_={pkg}
                onSelect={() => handleAddToCart(pkg)}
                isInCart={isInCart(pkg.id)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerImage: {
    height: 300,
    backgroundColor: Colors.gray[200],
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 20,
    marginTop: -40,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  verifiedIcon: {
    marginLeft: 8,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  platformText: {
    color: Colors.white,
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
    marginLeft: 6,
  },
  handle: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
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
});
