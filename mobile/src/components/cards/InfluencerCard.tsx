import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Influencer } from '../../types/api';
import { formatNumber, formatPrice, getPlatformIcon } from '../../utils/formatters';

interface InfluencerCardProps {
  influencer: Influencer;
  onPress: () => void;
}

export const InfluencerCard: React.FC<InfluencerCardProps> = ({
  influencer,
  onPress,
}) => {
  // Check if influencer is busy
  const isBusy = influencer.is_busy === true;

  // Get display price - from packages or price_per_post
  const getDisplayPrice = () => {
    if (influencer.packages && influencer.packages.length > 0) {
      return Math.min(...influencer.packages.map(p => p.price));
    }
    return influencer.price_per_post;
  };

  // Use profile_image_url or image_url
  const imageUrl = influencer.profile_image_url || influencer.image_url;

  const handlePress = () => {
    if (isBusy) {
      Alert.alert(
        'Influencer Unavailable',
        `${influencer.name} is currently busy and not accepting new orders.`,
        [{ text: 'OK' }]
      );
      return;
    }
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={isBusy ? 1 : 0.9}>
      <Card variant="elevated" padding="none" style={[styles.card, isBusy && styles.cardBusy]}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image 
              source={{ uri: imageUrl }} 
              style={[styles.image, isBusy && styles.imageBusy]} 
              blurRadius={isBusy ? 4 : 0}
            />
          ) : (
            <View style={[styles.imagePlaceholder, isBusy && styles.imageBusy]}>
              <Ionicons name="person-outline" size={40} color={Colors.gray[400]} />
            </View>
          )}
          
          {/* Busy Overlay */}
          {isBusy && (
            <View style={styles.busyOverlay}>
              <View style={styles.busyBadge}>
                <Ionicons name="time" size={20} color={Colors.white} />
                <Text style={styles.busyText}>BUSY</Text>
              </View>
              <Text style={styles.busySubtext}>Currently unavailable</Text>
            </View>
          )}

          {influencer.verified && !isBusy && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.info} />
            </View>
          )}
          {!isBusy && (
            <TouchableOpacity 
              style={styles.platformBadge}
              onPress={(e) => {
                e.stopPropagation();
                if (influencer.profile_link) {
                  Linking.openURL(influencer.profile_link).catch(() => {
                    Alert.alert('Error', 'Could not open the profile link');
                  });
                }
              }}
              disabled={!influencer.profile_link}
              activeOpacity={influencer.profile_link ? 0.7 : 1}
            >
              <Ionicons
                name={getPlatformIcon(influencer.platform) as any}
                size={16}
                color={Colors.white}
              />
              {influencer.profile_link && (
                <Ionicons name="open-outline" size={10} color={Colors.white} style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Content */}
        <View style={[styles.content, isBusy && styles.contentBusy]}>
          <Text style={styles.name} numberOfLines={1}>{influencer.name}</Text>
          <Text style={styles.handle} numberOfLines={1}>@{influencer.handle}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatNumber(influencer.followers)}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            {influencer.engagement_rate !== undefined && influencer.engagement_rate > 0 && (
              <View style={styles.stat}>
                <Text style={styles.statValue}>{influencer.engagement_rate}%</Text>
                <Text style={styles.statLabel}>Engagement</Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Badge text={influencer.niche || influencer.platform} variant="default" size="sm" />
            <Text style={styles.price}>
              From {formatPrice(getDisplayPrice())}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  cardBusy: {
    opacity: 0.9,
  },
  imageContainer: {
    height: 180,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  imageBusy: {
    opacity: 0.6,
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  busyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F97316',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  busyText: {
    color: Colors.white,
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
  },
  busySubtext: {
    color: Colors.white,
    fontSize: Fonts.size.sm,
    marginTop: 8,
    fontWeight: Fonts.weight.medium,
  },
  verifiedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 2,
  },
  platformBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    padding: 6,
  },
  content: {
    padding: 16,
  },
  contentBusy: {
    opacity: 0.6,
  },
  name: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  handle: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stat: {
    marginRight: 24,
  },
  statValue: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.accent,
  },
});
