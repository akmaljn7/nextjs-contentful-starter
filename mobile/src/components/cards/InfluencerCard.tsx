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
  // Get display price - from packages or price_per_post
  const getDisplayPrice = () => {
    if (influencer.packages && influencer.packages.length > 0) {
      return Math.min(...influencer.packages.map(p => p.price));
    }
    return influencer.price_per_post;
  };

  // Use profile_image_url or image_url
  const imageUrl = influencer.profile_image_url || influencer.image_url;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Card variant="elevated" padding="none" style={styles.card}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="person-outline" size={40} color={Colors.gray[400]} />
            </View>
          )}
          {influencer.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.info} />
            </View>
          )}
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
        </View>

        {/* Content */}
        <View style={styles.content}>
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
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
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
