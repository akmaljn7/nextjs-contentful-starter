import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../constants/colors';
import { LoadingSpinner, ErrorMessage, EmptyState } from '../../components/common';
import { OrderCard } from '../../components/cards';
import { ordersApi } from '../../api';
import { Order } from '../../types/api';

export const OrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setError(null);
      const data = await ordersApi.getAll();
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load orders');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadOrders();
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading orders..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadOrders} fullScreen />;
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon="receipt-outline"
        title="No orders yet"
        description="Your orders will appear here once you make a purchase"
        actionLabel="Start Shopping"
        onAction={() => navigation.navigate('ExploreTab')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onPress={() => navigation.navigate('OrderDetail', { id: item.id })}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  list: {
    padding: 16,
  },
});
