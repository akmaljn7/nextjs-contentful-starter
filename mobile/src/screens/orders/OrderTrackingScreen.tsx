import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Image,
  TouchableOpacity,
  Modal,
  Dimensions,
  Linking,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, LoadingSpinner, ErrorMessage, Badge } from '../../components/common';
import { ordersApi } from '../../api';
import { formatPrice, formatDateTime } from '../../utils/formatters';
import { API_URL } from '../../constants/config';

const { width: screenWidth } = Dimensions.get('window');

// Helper to ensure media URLs are absolute
const getAbsoluteMediaUrl = (url: string): string => {
  if (!url) return '';
  // If already absolute URL, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Get base URL (remove /api suffix if present)
  const baseUrl = API_URL.replace(/\/api$/, '');
  // Convert relative URL to absolute
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

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
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

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

      {/* Completion Proof Section */}
      {order.order_status === 'completed' && order.completion_proof && order.completion_proof.length > 0 && (
        <View style={styles.proofSection}>
          <Text style={styles.sectionTitle}>Proof of Completion</Text>
          <Card variant="outlined" padding="md">
            <Text style={styles.proofDescription}>
              The following images/videos confirm that your order has been completed successfully.
            </Text>
            <View style={styles.proofList}>
              {order.completion_proof.map((proof: any, index: number) => {
                const mediaUrl = getAbsoluteMediaUrl(proof.url);
                const isVideo = proof.type === 'video';
                
                return (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.proofLinkItem}
                    onPress={() => Linking.openURL(mediaUrl)}
                  >
                    <View style={[styles.proofIconContainer, isVideo ? styles.videoIcon : styles.imageIcon]}>
                      <Ionicons 
                        name={isVideo ? "play-circle-outline" : "image-outline"} 
                        size={24} 
                        color={isVideo ? "#3B82F6" : "#22C55E"} 
                      />
                    </View>
                    <View style={styles.proofLinkText}>
                      <Text style={styles.proofLinkTitle}>
                        {isVideo ? 'View Video' : 'View Image'} #{index + 1}
                      </Text>
                      <Text style={styles.proofLinkSubtitle}>Tap to open</Text>
                    </View>
                    <Ionicons name="open-outline" size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>
        </View>
      )}

      {/* Image Viewer Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1}
          onPress={() => setSelectedImage(null)}
        >
          <View style={styles.modalContent}>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={styles.fullImage}
                resizeMode="contain"
              />
            )}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close-circle" size={36} color={Colors.white} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
            {listing_info.handle && (
              <View style={styles.listingRow}>
                <Text style={styles.listingLabel}>Handle</Text>
                <Text style={styles.listingValue}>@{listing_info.handle}</Text>
              </View>
            )}
            {listing_info.director && (
              <View style={styles.listingRow}>
                <Text style={styles.listingLabel}>Director</Text>
                <Text style={styles.listingValue}>{listing_info.director}</Text>
              </View>
            )}
            {listing_info.production && (
              <View style={styles.listingRow}>
                <Text style={styles.listingLabel}>Production</Text>
                <Text style={styles.listingValue}>{listing_info.production}</Text>
              </View>
            )}
            {listing_info.description && (
              <View style={styles.listingRow}>
                <Text style={styles.listingLabel}>Description</Text>
                <Text style={styles.listingValue}>{listing_info.description}</Text>
              </View>
            )}
            {/* Package Details Fallback */}
            {order.package_details?.packageTitle && !listing_info.name && (
              <View style={styles.listingRow}>
                <Text style={styles.listingLabel}>Package</Text>
                <Text style={styles.listingValue}>{order.package_details.packageTitle}</Text>
              </View>
            )}
            {order.package_details?.turnaround && (
              <View style={styles.listingRow}>
                <Text style={styles.listingLabel}>Duration</Text>
                <Text style={styles.listingValue}>{order.package_details.turnaround}</Text>
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
  proofSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  proofDescription: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  proofList: {
    gap: 8,
  },
  proofLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  proofIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  videoIcon: {
    backgroundColor: '#EFF6FF',
  },
  imageIcon: {
    backgroundColor: '#F0FDF4',
  },
  proofLinkText: {
    flex: 1,
  },
  proofLinkTitle: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
    color: Colors.textPrimary,
  },
  proofLinkSubtitle: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  proofGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  proofItem: {
    width: (screenWidth - 64) / 2,
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.background,
  },
  proofMedia: {
    width: '100%',
    height: '100%',
  },
  proofOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: screenWidth,
    height: screenWidth,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
});
