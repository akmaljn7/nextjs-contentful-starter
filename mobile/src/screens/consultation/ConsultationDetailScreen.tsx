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
import { LoadingSpinner, ErrorMessage, Card, Badge, Button } from '../../components/common';
import { consultationsApi } from '../../api';
import { Consultation } from '../../types/api';
import { formatPrice } from '../../utils/formatters';

export const ConsultationDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { id } = route.params;

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadConsultation();
  }, [id]);

  const loadConsultation = async () => {
    try {
      setError(null);
      const data = await consultationsApi.getById(id);
      setConsultation(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load consultation details');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadConsultation();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'scheduled':
      case 'confirmed':
        return Colors.success;
      case 'pending':
        return Colors.warning;
      case 'completed':
        return Colors.info;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  const getPaymentStatusVariant = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'success';
      case 'pending':
      case 'pending_cash':
        return 'warning';
      case 'refunded':
        return 'error';
      default:
        return 'default';
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading consultation..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadConsultation} fullScreen />;
  }

  if (!consultation) {
    return <ErrorMessage message="Consultation not found" fullScreen />;
  }

  const hasConfirmedSchedule = consultation.scheduled_date && consultation.scheduled_time;
  const isConfirmed = (consultation.status as string) === 'scheduled' || (consultation.status as string) === 'confirmed' || hasConfirmedSchedule;

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header Card */}
      <Card variant="elevated" padding="lg" style={styles.headerCard}>
        <View style={styles.headerIconContainer}>
          <Ionicons 
            name={consultation.consultation_type === 'physical' ? 'business' : 'videocam'} 
            size={36} 
            color={Colors.white} 
          />
        </View>
        <Text style={styles.headerTitle}>{consultation.package_title || 'Consultation'}</Text>
        <Text style={styles.headerSubtitle}>
          {consultation.consultation_type === 'physical' ? 'In-Office' : 'Online'} Consultation
        </Text>
        
        <View style={styles.statusRow}>
          <Badge 
            text={consultation.status} 
            variant={isConfirmed ? 'success' : 'warning'}
          />
          <Badge 
            text={consultation.payment_status || 'Pending'} 
            variant={getPaymentStatusVariant(consultation.payment_status)}
          />
        </View>
      </Card>

      {/* Confirmed Schedule Section - Shown when admin confirms */}
      {hasConfirmedSchedule && (
        <Card variant="default" padding="lg" style={styles.confirmedScheduleCard}>
          <View style={styles.confirmedScheduleHeader}>
            <View style={styles.confirmedScheduleIcon}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
            </View>
            <Text style={styles.confirmedScheduleTitle}>Confirmed Schedule</Text>
          </View>
          
          <View style={styles.confirmedScheduleContent}>
            <View style={styles.scheduleItem}>
              <Ionicons name="calendar" size={20} color={Colors.accent} />
              <Text style={styles.scheduleItemText}>
                {new Date(consultation.scheduled_date!).toLocaleDateString('en-US', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                })}
              </Text>
            </View>
            <View style={styles.scheduleItem}>
              <Ionicons name="time" size={20} color={Colors.accent} />
              <Text style={styles.scheduleItemText}>{consultation.scheduled_time}</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Requested Schedule (if not yet confirmed) */}
      {!hasConfirmedSchedule && (consultation.preferred_date || consultation.preferred_time) && (
        <Card variant="outlined" padding="lg" style={styles.section}>
          <Text style={styles.sectionTitle}>Requested Schedule</Text>
          <View style={styles.detailsGrid}>
            {consultation.preferred_date && (
              <View style={styles.detailItem}>
                <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.detailLabel}>Preferred Date</Text>
                <Text style={styles.detailValue}>
                  {new Date(consultation.preferred_date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short'
                  })}
                </Text>
              </View>
            )}
            {consultation.preferred_time && (
              <View style={styles.detailItem}>
                <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
                <Text style={styles.detailLabel}>Preferred Time</Text>
                <Text style={styles.detailValue}>{consultation.preferred_time}</Text>
              </View>
            )}
          </View>
          <Text style={styles.pendingNote}>
            Awaiting confirmation from our team
          </Text>
        </Card>
      )}

      {/* Business Information */}
      <Card variant="default" padding="lg" style={styles.section}>
        <Text style={styles.sectionTitle}>Business Information</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Business Name</Text>
          <Text style={styles.infoValue}>{consultation.business_name}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Industry</Text>
          <Text style={styles.infoValue}>{consultation.industry}</Text>
        </View>
        
        {consultation.business_stage && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Business Stage</Text>
            <Text style={styles.infoValue}>{consultation.business_stage}</Text>
          </View>
        )}
        
        {consultation.budget_range && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Budget Range</Text>
            <Text style={styles.infoValue}>{consultation.budget_range}</Text>
          </View>
        )}
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Description</Text>
          <Text style={styles.infoValueMultiline}>{consultation.description}</Text>
        </View>
        
        {consultation.goals && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Goals</Text>
            <Text style={styles.infoValueMultiline}>{consultation.goals}</Text>
          </View>
        )}
      </Card>

      {/* Contact Information */}
      <Card variant="default" padding="lg" style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Details</Text>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Name</Text>
          <Text style={styles.infoValue}>{consultation.contact_name}</Text>
        </View>
        
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{consultation.contact_phone}</Text>
        </View>
        
        {consultation.contact_email && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{consultation.contact_email}</Text>
          </View>
        )}
      </Card>

      {/* Payment Summary */}
      <Card variant="default" padding="lg" style={styles.section}>
        <Text style={styles.sectionTitle}>Payment</Text>
        
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Consultation Fee</Text>
          <Text style={styles.paymentValue}>{formatPrice(consultation.price)}</Text>
        </View>
        
        <View style={styles.paymentRow}>
          <Text style={styles.paymentLabel}>Payment Method</Text>
          <Text style={styles.paymentValue}>
            {consultation.payment_method === 'cash' ? 'Cash at Office' : 'Online Payment'}
          </Text>
        </View>
        
        <View style={styles.paymentDivider} />
        
        <View style={styles.paymentRow}>
          <Text style={styles.paymentTotalLabel}>Total</Text>
          <Text style={styles.paymentTotalValue}>{formatPrice(consultation.price)}</Text>
        </View>
      </Card>

      {/* Tracking Timeline */}
      <Card variant="default" padding="lg" style={styles.section}>
        <Text style={styles.sectionTitle}>Booking Status</Text>
        
        <View style={styles.timeline}>
          {/* Booked */}
          <View style={styles.timelineItem}>
            <View style={[styles.timelineDot, styles.timelineDotActive]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>Booking Submitted</Text>
              <Text style={styles.timelineDate}>
                {new Date(consultation.created_at).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
          </View>
          
          {/* Payment */}
          <View style={styles.timelineItem}>
            <View style={[
              styles.timelineDot, 
              consultation.payment_status === 'paid' && styles.timelineDotActive
            ]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>
                {consultation.payment_status === 'paid' ? 'Payment Received' : 'Payment Pending'}
              </Text>
              <Text style={styles.timelineDate}>
                {consultation.payment_method === 'cash' ? 'Pay at office' : 
                  consultation.payment_status === 'paid' ? 'Paid online' : 'Awaiting payment'}
              </Text>
            </View>
          </View>
          
          {/* Scheduled */}
          <View style={styles.timelineItem}>
            <View style={[
              styles.timelineDot, 
              hasConfirmedSchedule && styles.timelineDotActive
            ]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>
                {hasConfirmedSchedule ? 'Schedule Confirmed' : 'Awaiting Confirmation'}
              </Text>
              <Text style={styles.timelineDate}>
                {hasConfirmedSchedule ? 
                  `${consultation.scheduled_date} at ${consultation.scheduled_time}` : 
                  'Our team will confirm your schedule'}
              </Text>
            </View>
          </View>
          
          {/* Completed */}
          <View style={styles.timelineItem}>
            <View style={[
              styles.timelineDot, 
              consultation.status === 'completed' && styles.timelineDotActive
            ]} />
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>
                {consultation.status === 'completed' ? 'Consultation Completed' : 'Consultation'}
              </Text>
              <Text style={styles.timelineDate}>
                {consultation.status === 'completed' ? 'Thank you!' : 'Upcoming'}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Bottom spacing */}
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
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  headerIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.white,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: Fonts.size.sm,
    color: Colors.white + 'bb',
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  confirmedScheduleCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  confirmedScheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmedScheduleIcon: {
    marginRight: 8,
  },
  confirmedScheduleTitle: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.bold,
    color: Colors.success,
  },
  confirmedScheduleContent: {
    backgroundColor: Colors.success + '10',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scheduleItemText: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 24,
  },
  detailItem: {
    flex: 1,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  detailValue: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  pendingNote: {
    fontSize: Fonts.size.sm,
    color: Colors.warning,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
  },
  infoRow: {
    marginBottom: 14,
  },
  infoLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
  },
  infoValueMultiline: {
    fontSize: Fonts.size.md,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  paymentLabel: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  paymentValue: {
    fontSize: Fonts.size.sm,
    color: Colors.textPrimary,
    fontWeight: Fonts.weight.medium,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  paymentTotalLabel: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  paymentTotalValue: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.gray[300],
    marginTop: 4,
    marginRight: 12,
  },
  timelineDotActive: {
    backgroundColor: Colors.success,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
  },
  timelineDate: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  bottomSpacing: {
    height: 32,
  },
});
