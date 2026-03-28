import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { LoadingSpinner, ErrorMessage, EmptyState, Card, Badge } from '../../components/common';
import { OrderCard } from '../../components/cards';
import { ordersApi, consultationsApi } from '../../api';
import { Order, Consultation } from '../../types/api';
import { formatPrice } from '../../utils/formatters';

// Combined type for orders and consultations
interface CombinedItem {
  id: string;
  type: 'order' | 'consultation';
  data: Order | Consultation;
  created_at: string;
}

export const OrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  const [items, setItems] = useState<CombinedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'orders' | 'consultations'>('all');

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [])
  );

  const loadAll = async () => {
    try {
      setError(null);
      
      // Fetch both orders and consultations in parallel
      const [ordersData, consultationsData] = await Promise.all([
        ordersApi.getAll().catch(() => []),
        consultationsApi.getAll().catch(() => []),
      ]);

      // Combine and sort by created_at
      const combined: CombinedItem[] = [
        ...ordersData.map(order => ({
          id: order.id,
          type: 'order' as const,
          data: order,
          created_at: order.created_at || '',
        })),
        ...consultationsData.map(consultation => ({
          id: consultation.id,
          type: 'consultation' as const,
          data: consultation,
          created_at: consultation.created_at || '',
        })),
      ];

      // Sort by date (newest first)
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(combined);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadAll();
  };

  const getFilteredItems = () => {
    if (activeTab === 'all') return items;
    return items.filter(item => item.type === (activeTab === 'orders' ? 'order' : 'consultation'));
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'completed':
      case 'confirmed':
        return Colors.success;
      case 'pending':
      case 'pending_payment':
        return Colors.warning;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.info;
    }
  };

  const renderConsultationCard = (consultation: Consultation) => (
    <TouchableOpacity
      style={styles.consultationCard}
      onPress={() => {}}
      activeOpacity={0.7}
    >
      <View style={styles.consultationHeader}>
        <View style={styles.consultationIconContainer}>
          <Ionicons 
            name={consultation.consultation_type === 'physical' ? 'business' : 'videocam'} 
            size={24} 
            color={Colors.white} 
          />
        </View>
        <View style={styles.consultationHeaderText}>
          <Text style={styles.consultationTitle}>{consultation.package_title}</Text>
          <Text style={styles.consultationBusiness}>{consultation.business_name}</Text>
        </View>
        <Badge
          text={consultation.payment_status || 'Pending'}
          variant={consultation.payment_status === 'paid' ? 'success' : 'warning'}
        />
      </View>

      <View style={styles.consultationDetails}>
        <View style={styles.consultationDetailRow}>
          <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.consultationDetailText}>
            {consultation.preferred_date ? new Date(consultation.preferred_date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            }) : 'Not scheduled'}
          </Text>
        </View>
        <View style={styles.consultationDetailRow}>
          <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          <Text style={styles.consultationDetailText}>{consultation.preferred_time || 'TBD'}</Text>
        </View>
      </View>

      <View style={styles.consultationFooter}>
        <Text style={styles.consultationPrice}>{formatPrice(consultation.price)}</Text>
        <Text style={styles.consultationType}>
          {consultation.consultation_type === 'physical' ? 'In-Office' : 'Online'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: CombinedItem }) => {
    if (item.type === 'order') {
      return (
        <OrderCard
          order={item.data as Order}
          onPress={() => navigation.navigate('OrderDetail', { id: item.id })}
        />
      );
    } else {
      return renderConsultationCard(item.data as Consultation);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading orders..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadAll} fullScreen />;
  }

  const filteredItems = getFilteredItems();

  if (items.length === 0) {
    return (
      <EmptyState
        icon="receipt-outline"
        title="No orders yet"
        description="Your orders and consultations will appear here"
        actionLabel="Start Shopping"
        onAction={() => navigation.navigate('ExploreTab', { screen: 'Explore' })}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All ({items.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
            Orders ({items.filter(i => i.type === 'order').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'consultations' && styles.tabActive]}
          onPress={() => setActiveTab('consultations')}
        >
          <Text style={[styles.tabText, activeTab === 'consultations' && styles.tabTextActive]}>
            Consultations ({items.filter(i => i.type === 'consultation').length})
          </Text>
        </TouchableOpacity>
      </View>

      {filteredItems.length === 0 ? (
        <View style={styles.emptyFilterContainer}>
          <Ionicons name="filter-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyFilterText}>
            No {activeTab === 'orders' ? 'orders' : 'consultations'} found
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.primary + '10',
  },
  tabText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyFilterContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyFilterText: {
    fontSize: Fonts.size.md,
    color: Colors.textMuted,
    marginTop: 12,
  },
  consultationCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  consultationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  consultationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  consultationHeaderText: {
    flex: 1,
  },
  consultationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  consultationBusiness: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  consultationDetails: {
    flexDirection: 'row',
    backgroundColor: Colors.gray[50],
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 24,
  },
  consultationDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  consultationDetailText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  consultationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consultationPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.accent,
  },
  consultationType: {
    fontSize: 12,
    color: Colors.textMuted,
    backgroundColor: Colors.gray[100],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
});
