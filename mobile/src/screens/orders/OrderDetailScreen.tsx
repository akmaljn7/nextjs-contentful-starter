import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, LoadingSpinner, ErrorMessage, Badge, Button } from '../../components/common';
import { OrderMediaUpload } from '../../components/media/OrderMediaUpload';
import { ordersApi } from '../../api';
import { Order } from '../../types/api';
import { formatPrice, formatDate, formatDateTime } from '../../utils/formatters';

export const OrderDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      setError(null);
      const data = await ordersApi.getById(id);
      setOrder(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading order..." />;
  }

  if (error || !order) {
    return <ErrorMessage message={error || 'Order not found'} onRetry={loadOrder} fullScreen />;
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={loadOrder} />
      }
    >
      {/* Order Header */}
      <Card variant="elevated" padding="lg" style={styles.headerCard}>
        <View style={styles.orderIdRow}>
          <Text style={styles.orderId}>Order #{order.id.slice(-8).toUpperCase()}</Text>
          <Badge variant="status" status={order.order_status} text="" />
        </View>
        <Text style={styles.orderDate}>{formatDateTime(order.created_at)}</Text>

        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Payment</Text>
            <Badge variant="status" status={order.payment_status} text="" size="sm" />
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Method</Text>
            <Text style={styles.statusValue}>
              {order.payment_method === 'cash' ? 'Pay at Office' : 'Online'}
            </Text>
          </View>
        </View>
      </Card>

      {/* Order Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Details</Text>
        <Card variant="outlined" padding="md" style={styles.itemCard}>
          <Text style={styles.itemName}>
            {order.package_details?.packageTitle || order.package_details?.title || order.listing_type?.replace(/_/g, ' ')}
          </Text>
          <Text style={styles.packageTitle}>
            {order.listing_type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Text>
          {order.package_details?.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.location}>{order.package_details.location}</Text>
            </View>
          )}
          {order.package_details?.state_name && order.package_details?.road_name && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.location}>{order.package_details.state_name} - {order.package_details.road_name}</Text>
            </View>
          )}
          {order.package_details?.deliverables && order.package_details.deliverables.length > 0 && (
            <View style={styles.deliverablesContainer}>
              <Text style={styles.deliverablesTitle}>Deliverables:</Text>
              {order.package_details.deliverables.map((item: string, idx: number) => (
                <View key={idx} style={styles.deliverableItem}>
                  <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                  <Text style={styles.deliverableText}>{item}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.itemFooter}>
            <Text style={styles.duration}>{order.package_details?.turnaround || ''}</Text>
            <Text style={styles.itemPrice}>{formatPrice(order.package_details?.price || order.total_amount)}</Text>
          </View>
        </Card>
      </View>

      {/* Ad Media Upload Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Ad Content</Text>
        <Text style={styles.sectionSubtitle}>
          Upload the photos, videos, or links you want us to advertise
        </Text>
        <OrderMediaUpload
          order={order}
          onMediaUpdate={loadOrder}
          readOnly={order.order_status === 'completed' || order.order_status === 'cancelled'}
          showHeader={false}
        />
      </View>

      {/* Order Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <Card variant="default" padding="md">
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>
              {formatPrice(order.total_amount - (order.platform_fee || 0))}
            </Text>
          </View>
          {order.platform_fee && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform Fee</Text>
              <Text style={styles.summaryValue}>{formatPrice(order.platform_fee)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total_amount)}</Text>
          </View>
        </Card>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          title="View Tracking"
          variant="outline"
          onPress={() => navigation.navigate('OrderTracking', { id: order.id })}
          fullWidth
          icon={<Ionicons name="location-outline" size={18} color={Colors.accent} />}
          style={styles.actionButton}
        />
        <Button
          title="Contact Support"
          variant="primary"
          onPress={() => navigation.navigate('Chat', { conversationId: `order-${order.id}`, orderId: order.id })}
          fullWidth
          icon={<Ionicons name="chatbubble-outline" size={18} color={Colors.white} />}
          style={styles.actionButton}
        />
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
  headerCard: {
    margin: 16,
  },
  orderIdRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderId: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  orderDate: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  statusItem: {
    flex: 1,
  },
  statusLabel: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.medium,
    color: Colors.textPrimary,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 12,
    marginTop: -8,
  },
  itemCard: {
    marginBottom: 12,
  },
  itemName: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  packageTitle: {
    fontSize: Fonts.size.sm,
    color: Colors.accent,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  location: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  duration: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  itemPrice: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  deliverablesContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deliverablesTitle: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  deliverableItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  deliverableText: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginLeft: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
  },
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  actions: {
    padding: 16,
  },
  actionButton: {
    marginBottom: 12,
  },
  bottomSpacing: {
    height: 24,
  },
});
