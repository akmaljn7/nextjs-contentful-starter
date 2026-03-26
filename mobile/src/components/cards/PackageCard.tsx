import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Package } from '../../types/api';
import { formatPrice } from '../../utils/formatters';

interface PackageCardProps {
  package_: Package;
  onSelect: () => void;
  isSelected?: boolean;
  isInCart?: boolean;
}

export const PackageCard: React.FC<PackageCardProps> = ({
  package_,
  onSelect,
  isSelected = false,
  isInCart = false,
}) => {
  return (
    <Card
      variant={isSelected ? 'elevated' : 'outlined'}
      padding="md"
      style={[
        styles.card,
        isSelected && styles.cardSelected,
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{package_.title}</Text>
        <Text style={styles.price}>{formatPrice(package_.price)}</Text>
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {package_.description}
      </Text>

      {package_.duration && (
        <View style={styles.durationRow}>
          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.duration}>{package_.duration}</Text>
        </View>
      )}

      {package_.deliverables && package_.deliverables.length > 0 && (
        <View style={styles.deliverables}>
          <Text style={styles.deliverablesTitle}>Includes:</Text>
          {package_.deliverables.slice(0, 3).map((item, index) => (
            <View key={index} style={styles.deliverableItem}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.deliverableText}>{item}</Text>
            </View>
          ))}
          {package_.deliverables.length > 3 && (
            <Text style={styles.moreItems}>
              +{package_.deliverables.length - 3} more
            </Text>
          )}
        </View>
      )}

      <Button
        title={isInCart ? 'In Cart' : 'Add to Cart'}
        onPress={onSelect}
        variant={isInCart ? 'secondary' : 'primary'}
        size="md"
        fullWidth
        disabled={isInCart}
        icon={
          <Ionicons
            name={isInCart ? 'checkmark-circle' : 'cart-outline'}
            size={18}
            color={Colors.white}
          />
        }
        style={styles.button}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: Colors.accent,
    borderWidth: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginRight: 12,
  },
  price: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  description: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  duration: {
    marginLeft: 6,
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  deliverables: {
    marginBottom: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deliverablesTitle: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  deliverableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  deliverableText: {
    marginLeft: 8,
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  moreItems: {
    fontSize: Fonts.size.sm,
    color: Colors.accent,
    marginTop: 4,
  },
  button: {
    marginTop: 4,
  },
});
