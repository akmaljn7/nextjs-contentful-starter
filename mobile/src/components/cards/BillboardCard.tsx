import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Billboard } from '../../types/api';
import { formatNumber, formatPrice } from '../../utils/formatters';

interface BillboardCardProps {
  billboard: Billboard;
  onPress: () => void;
}

export const BillboardCard: React.FC<BillboardCardProps> = ({
  billboard,
  onPress,
}) => {
  const getBillboardIcon = () => {
    const type = billboard.billboard_type?.toLowerCase() || '';
    if (type.includes('led') || type.includes('digital')) return 'tv-outline';
    if (type.includes('lightbox')) return 'bulb-outline';
    return 'image-outline';
  };

  const getBadgeColor = () => {
    const type = billboard.billboard_type?.toLowerCase() || '';
    if (type.includes('led') || type.includes('digital')) return Colors.accent;
    if (type.includes('lightbox')) return Colors.warning;
    return Colors.primary;
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Card variant="elevated" padding="none" style={styles.card}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {billboard.image_url ? (
            <Image source={{ uri: billboard.image_url }} style={styles.image} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name={getBillboardIcon()} size={48} color={Colors.gray[400]} />
            </View>
          )}
          {billboard.verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.info} />
            </View>
          )}
          <View style={[styles.typeBadge, { backgroundColor: getBadgeColor() }]}>
            <Text style={styles.typeBadgeText}>{billboard.billboard_type}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={2}>{billboard.location_name}</Text>
          <Text style={styles.description} numberOfLines={2}>{billboard.description}</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="people-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.statValue}>{formatNumber(billboard.traffic_daily)}</Text>
              <Text style={styles.statLabel}>Daily Traffic</Text>
            </View>
          </View>

          <View style={styles.footer}>
            <View>
              <Text style={styles.priceLabel}>Starting from</Text>
              <Text style={styles.price}>{formatPrice(billboard.price_monthly)}</Text>
              <Text style={styles.pricePeriod}>per month</Text>
            </View>
            <View style={styles.arrowContainer}>
              <Ionicons name="arrow-forward" size={20} color={Colors.accent} />
            </View>
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
    height: 160,
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
  typeBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    color: Colors.white,
    fontSize: Fonts.size.xs,
    fontWeight: Fonts.weight.semibold,
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
  description: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statValue: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginLeft: 6,
    marginRight: 4,
  },
  statLabel: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
  },
  price: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  pricePeriod: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
  },
  arrowContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
