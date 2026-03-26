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
import { Card, LoadingSpinner, ErrorMessage, Badge } from '../../components/common';
import { ordersApi } from '../../api';
import { formatPrice, formatDateTime } from '../../utils/formatters';

interface TimelineItem {
  status: string;
  title: string;
  description: string;
  date: string | null;
  completed: boolean;
}

interface TrackingData {
  order: any;
  listing_info: any;
  timeline: TimelineItem[];
  type: string;
}

export const OrderTrackingScreen: React.FC = () => {
  const route = useRoute<any>();
  const { id } = route.params;

  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTracking();
  }, [id]);

  const loadTracking = async () => {
    try {
      setError(null);
      const data = await ordersApi.getTracking(id);
      setTrackingData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load tracking information');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string, completed: boolean) => {
    if (completed) {
      return { name: 'checkmark-circle', color: Colors.success };
    }
    
    const icons: Record<string, { name: string; color: string }> = {
      pending: { name: 'time-outline', color: Colors.warning },
      accepted: { name: 'thumbs-up-outline', color: Colors.info },
      in_progress: { name: 'construct-outline', color: Colors.info },
      proof_submitted: { name: 'document-text-outline', color: Colors.info },
      completed: { name: 'checkmark-circle', color: Colors.success },
      cancelled: { name: 'close-circle-outline', color: Colors.error },
    };
    
    return icons[status] || { name: 'ellipse-outline', color: Colors.gray[400] };
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading tracking..." />;
  }

  if (error || !trackingData) {
    return <ErrorMessage message={error || 'Tracking not found'} onRetry={loadTracking} fullScreen />;
  }

  const { order, listing_info, timeline } = trackingData;

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={loadTracking} />
      }
    >
      {/* Order Summary Card */}
      <Card variant="elevated" padding="lg" style={styles.summaryCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>Order #{order.id.slice(-8).toUpperCase()}</Text>
          <Badge 
            variant="status" 
            status={order.order_status} 
            text="" 
          />
        </View>
        
        <View style={styles.orderInfo}>
          <View style={styles.infoRow}>
            <Ionicons name="pricetag-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              {order.package_details?.packageTitle || order.listing_type?.replace(/_/g, ' ')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.infoText}>{formatPrice(order.total_amount)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.infoText}>{formatDateTime(order.created_at)}</Text>
          </View>
        </View>
      </Card>

      {/* Timeline */}
      <View style={styles.timelineSection}>
        <Text style={styles.sectionTitle}>Order Timeline</Text>
        
        <View style={styles.timeline}>
          {timeline.map((item, index) => {
            const icon = getStatusIcon(item.status, item.completed);
            const isLast = index === timeline.length - 1;
            
            return (
              <View key={index} style={styles.timelineItem}>
                {/* Line */}
                {!isLast && (
                  <View 
                    style={[
                      styles.timelineLine,
                      item.completed && styles.timelineLineCompleted
                    ]} 
                  />
                )}
                
                {/* Icon */}
                <View 
                  style={[
                    styles.timelineIcon,
                    item.completed && styles.timelineIconCompleted
                  ]}
                >
                  <Ionicons 
                    name={icon.name as any} 
                    size={20} 
                    color={item.completed ? Colors.white : icon.color} 
                  />
                </View>
                
                {/* Content */}
                <View style={styles.timelineContent}>
                  <Text style={[
                    styles.timelineTitle,
                    item.completed && styles.timelineTitleCompleted
                  ]}>
                    {item.title}
                  </Text>
                  <Text style={styles.timelineDescription}>{item.description}</Text>
                  {item.date && (
                    <Text style={styles.timelineDate}>{formatDateTime(item.date)}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Listing Info */}
      {listing_info && (
        <View style={styles.listingSection}>
          <Text style={styles.sectionTitle}>Service Details</Text>
          <Card variant="outlined" padding="md">
            {listing_info.name && (
              <View style={styles.listingRow}>
                <Text style={styles.listingLabel}>Service</Text>
                <Text style={styles.listingValue}>{listing_info.name}</Text>
              </View>
            )}
            {listing_info.location && (
              <View style={styles.listingRow}>
                <Text style={styles.listingLabel}>Location</Text>
                <Text style={styles.listingValue}>{listing_info.location}</Text>
              </View>
            )}
            {listing_info.platform && (
              <View style={styles.listingRow}>
                <Text style={styles.listingLabel}>Platform</Text>
                <Text style={styles.listingValue}>{listing_info.platform}</Text>
              </View>
            )}
          </Card>
        </View>
      )}

      {/* Payment Info */}
      <View style={styles.paymentSection}>
        <Text style={styles.sectionTitle}>Payment Information</Text>
        <Card variant="outlined" padding="md">
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Status</Text>
            <Badge variant="status" status={order.payment_status} text="" size="sm" />
          </View>
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Method</Text>
            <Text style={styles.paymentValue}>
              {order.payment_method === 'cash' ? 'Pay at Office' : 'Online Payment'}
            </Text>
          </View>
          <View style={[styles.paymentRow, styles.paymentTotal]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total_amount)}</Text>
          </View>
        </Card>
      </View>

      {/* Bottom Spacing */}
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  summaryCard: {
    margin: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderId: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  orderInfo: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
  },
  timelineSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    position: 'relative',
    paddingBottom: 24,
  },
  timelineLine: {
    position: 'absolute',
    left: 15,
    top: 36,
    bottom: 0,
    width: 2,
    backgroundColor: Colors.border,
  },
  timelineLineCompleted: {
    backgroundColor: Colors.success,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    zIndex: 1,
  },
  timelineIconCompleted: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 4,
  },
  timelineTitle: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  timelineTitleCompleted: {
    color: Colors.textPrimary,
  },
  timelineDescription: {
    fontSize: Fonts.size.sm,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  timelineDate: {
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
  },
  listingSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  listingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listingLabel: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  listingValue: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
    color: Colors.textPrimary,
  },
  paymentSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  paymentLabel: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  paymentValue: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
    color: Colors.textPrimary,
  },
  paymentTotal: {
    borderBottomWidth: 0,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
  },
  totalValue: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  bottomSpacing: {
    height: 40,
  },
});
