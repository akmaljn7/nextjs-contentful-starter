import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
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
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Card variant="elevated" padding="none" style={styles.card}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {influencer.image_url ? (
            <Image source={{ uri: influencer.image_url }} style={styles.image} />
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
          <View style={styles.platformBadge}>
            <Ionicons
              name={getPlatformIcon(influencer.platform) as any}
              size={16}
              color={Colors.white}
            />
          </View>
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
            {influencer.engagement_rate && (
              <View style={styles.stat}>
                <Text style={styles.statValue}>{influencer.engagement_rate}%</Text>
                <Text style={styles.statLabel}>Engagement</Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Badge text={influencer.category} variant="default" size="sm" />
            {influencer.packages && influencer.packages.length > 0 && (
              <Text style={styles.price}>
                From {formatPrice(Math.min(...influencer.packages.map(p => p.price)))}
              </Text>
            )}
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
