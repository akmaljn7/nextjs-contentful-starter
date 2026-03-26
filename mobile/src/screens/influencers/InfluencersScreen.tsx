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
import { InfluencerCard } from '../../components/cards';
import { influencersApi } from '../../api';
import { Influencer } from '../../types/api';

export const InfluencersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInfluencers();
  }, []);

  const loadInfluencers = async () => {
    try {
      setError(null);
      const data = await influencersApi.getAll();
      setInfluencers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load influencers');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadInfluencers();
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading influencers..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadInfluencers} fullScreen />;
  }

  if (influencers.length === 0) {
    return (
      <EmptyState
        icon="people-outline"
        title="No influencers found"
        description="Check back later for new influencers"
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={influencers}
        renderItem={({ item }) => (
          <InfluencerCard
            influencer={item}
            onPress={() => navigation.navigate('InfluencerDetail', { id: item.id })}
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
