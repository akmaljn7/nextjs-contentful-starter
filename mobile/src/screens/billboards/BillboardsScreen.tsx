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
import { BillboardCard } from '../../components/cards';
import { billboardsApi } from '../../api';
import { Billboard, BillboardType } from '../../types/api';

export const BillboardsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [independentTypes, setIndependentTypes] = useState<BillboardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBillboards();
  }, []);

  const loadBillboards = async () => {
    try {
      setError(null);
      const [billboardData, independentData] = await Promise.all([
        billboardsApi.getAll(),
        billboardsApi.getIndependentTypes(),
      ]);
      setBillboards(billboardData);
      setIndependentTypes(independentData);
    } catch (err: any) {
      setError(err.message || 'Failed to load billboards');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadBillboards();
  };

  // Combine billboards with independent types for display
  const allItems = [
    ...billboards.map(b => ({ ...b, itemType: 'billboard' as const })),
    ...independentTypes.map(t => ({
      id: t.id,
      location_name: t.name,
      billboard_type: t.name,
      description: t.description || 'Custom billboard advertising',
      traffic_daily: t.traffic_daily || 0,
      price_monthly: t.price_starting || 0,
      image_url: t.image_url,
      verified: false,
      itemType: 'independent' as const,
    })),
  ];

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading billboards..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadBillboards} fullScreen />;
  }

  if (allItems.length === 0) {
    return (
      <EmptyState
        icon="tv-outline"
        title="No billboards found"
        description="Check back later for new billboard listings"
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={allItems}
        renderItem={({ item }) => (
          <BillboardCard
            billboard={item as Billboard}
            onPress={() => navigation.navigate('BillboardDetail', { 
              id: item.id, 
              type: item.billboard_type,
              isIndependent: (item as any).itemType === 'independent'
            })}
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
