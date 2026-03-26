import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Order } from '../../types/api';
import { formatPrice, formatDate } from '../../utils/formatters';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  onPress,
}) => {
  const getItemsSummary = () => {
    if (order.items.length === 1) {
      return order.items[0].listingName;
    }
    return `${order.items.length} items`;
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <Card variant="default" padding="md" style={styles.card}>
        <View style={styles.header}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>Order #{order.id.slice(-8).toUpperCase()}</Text>
            <Text style={styles.date}>{formatDate(order.created_at)}</Text>
          </View>
          <Badge variant="status" status={order.status} text="" />
        </View>

        <View style={styles.divider} />

        <View style={styles.content}>
          <Text style={styles.itemsSummary} numberOfLines={2}>
            {getItemsSummary()}
          </Text>
          
          <View style={styles.footer}>
            <View>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.total}>{formatPrice(order.total_amount)}</Text>
            </View>
            
            <View style={styles.paymentInfo}>
              <Badge
                variant="status"
                status={order.payment_status}
                text=""
                size="sm"
              />
            </View>
          </View>
        </View>

        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
  },
  date: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  content: {},
  itemsSummary: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
  },
  total: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  paymentInfo: {
    alignItems: 'flex-end',
  },
  arrowContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
});
