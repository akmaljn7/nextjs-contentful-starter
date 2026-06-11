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
import { kannywoodApi } from '../../api';
import { useCartStore } from '../../store';
import { KannywoodProduction } from '../../types/api';
import { formatNumber, formatPrice } from '../../utils/formatters';

export const KannywoodDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const { id } = route.params;
  const { items: cartItems, addItem } = useCartStore();

  const [production, setProduction] = useState<KannywoodProduction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProduction();
  }, [id]);

  const loadProduction = async () => {
    try {
      setError(null);
      const data = await kannywoodApi.getById(id);
      setProduction(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load production');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleAddToCart = (pkg: any) => {
    if (!production) return;

    addItem({
      id: `${production.id}-${pkg.id}`,
      listingType: 'kannywood',
      listingId: production.id,
      listingName: production.title,
      packageId: pkg.id,
      packageTitle: pkg.title,
      price: pkg.price,
      duration: pkg.duration,
      deliverables: pkg.deliverables || [],
      image_url: production.image_url,
    });
  };

  const isInCart = (pkgId: string) => {
    return cartItems.some(item => item.id === `${id}-${pkgId}`);
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  if (error || !production) {
    return <ErrorMessage message={error || 'Production not found'} onRetry={loadProduction} fullScreen />;
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={loadProduction} />
      }
    >
      {/* Header Image */}
      <View style={styles.headerImage}>
        {production.image_url ? (
          <Image source={{ uri: production.image_url }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="film" size={64} color={Colors.gray[400]} />
          </View>
        )}
        {/* Fully Booked Overlay */}
        {production.is_fully_booked && (
          <View style={styles.fullyBookedOverlay}>
            <View style={styles.fullyBookedBadge}>
              <Text style={styles.fullyBookedText}>FULLY BOOKED</Text>
            </View>
          </View>
        )}
        {production.genre && (
          <View style={styles.genreBadge}>
            <Text style={styles.genreText}>{production.genre}</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>{production.title}</Text>
        
        <View style={styles.badgeRow}>
          {production.placement_type && (
            <Badge 
              text={production.placement_type.replace(/_/g, ' ')} 
              variant="default" 
            />
          )}
          {production.is_fully_booked && (
            <View style={styles.fullyBookedTag}>
              <Text style={styles.fullyBookedTagText}>Fully Booked</Text>
            </View>
          )}
        </View>

        {/* Meta Info */}
        <View style={styles.metaContainer}>
          {production.director && (
            <View style={styles.metaItem}>
              <Ionicons name="videocam-outline" size={18} color={Colors.textSecondary} />
              <View>
                <Text style={styles.metaLabel}>Director</Text>
                <Text style={styles.metaValue}>{production.director}</Text>
              </View>
            </View>
          )}
          {production.production_company && (
            <View style={styles.metaItem}>
              <Ionicons name="business-outline" size={18} color={Colors.textSecondary} />
              <View>
                <Text style={styles.metaLabel}>Production</Text>
                <Text style={styles.metaValue}>{production.production_company}</Text>
              </View>
            </View>
          )}
          {production.release_date && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
              <View>
                <Text style={styles.metaLabel}>Release Date</Text>
                <Text style={styles.metaValue}>{production.release_date}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {(production.estimated_reach || production.est_reach) && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatNumber(production.estimated_reach || parseInt(production.est_reach || '0'))}
              </Text>
              <Text style={styles.statLabel}>Estimated Reach</Text>
            </View>
          )}
          {!production.is_fully_booked && (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatPrice(production.price)}</Text>
              <Text style={styles.statLabel}>Starting Price</Text>
            </View>
          )}
        </View>

        {/* Cast */}
        {production.cast && production.cast.length > 0 && (
          <Card variant="outlined" padding="md" style={styles.castCard}>
            <Text style={styles.sectionTitle}>Cast</Text>
            <View style={styles.castList}>
              {production.cast.map((actor, index) => (
                <View key={index} style={styles.castBadge}>
                  <Text style={styles.castText}>{actor}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Description */}
        <Card variant="outlined" padding="md" style={styles.descriptionCard}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{production.description}</Text>
        </Card>

        {/* Packages */}
        {production.packages && production.packages.length > 0 && (
          <View style={styles.packagesSection}>
            <Text style={styles.sectionTitle}>Available Packages</Text>
            {production.is_fully_booked && (
              <View style={styles.fullyBookedNotice}>
                <Ionicons name="information-circle" size={18} color="#dc2626" />
                <Text style={styles.fullyBookedNoticeText}>
                  This production is currently fully booked. Packages are unavailable for booking.
                </Text>
              </View>
            )}
            {production.packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                package_={pkg}
                onSelect={() => handleAddToCart(pkg)}
                isInCart={isInCart(pkg.id)}
                disabled={production.is_fully_booked}
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
  headerImage: {
    height: 250,
    backgroundColor: Colors.gray[200],
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray[100],
  },
  genreBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: Colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  genreText: {
    color: Colors.white,
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.semibold,
    textTransform: 'capitalize',
  },
  content: {
    padding: 20,
    marginTop: -30,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  title: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  metaContainer: {
    marginTop: 16,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
  },
  metaValue: {
    fontSize: Fonts.size.sm,
    color: Colors.textPrimary,
    fontWeight: Fonts.weight.medium,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    marginVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  castCard: {
    marginBottom: 16,
  },
  castList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  castBadge: {
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  castText: {
    fontSize: Fonts.size.sm,
    color: Colors.textPrimary,
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
  fullyBookedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullyBookedBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    transform: [{ rotate: '-15deg' }],
  },
  fullyBookedText: {
    color: Colors.white,
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    textTransform: 'uppercase',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  fullyBookedTag: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  fullyBookedTagText: {
    fontSize: Fonts.size.sm,
    color: '#dc2626',
    fontWeight: Fonts.weight.semibold,
  },
  fullyBookedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  fullyBookedNoticeText: {
    flex: 1,
    fontSize: Fonts.size.sm,
    color: '#dc2626',
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 40,
  },
});
