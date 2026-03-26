import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, LoadingSpinner, ErrorMessage, EmptyState, Badge } from '../../components/common';
import { digitalAdsApi } from '../../api';
import { DigitalAd } from '../../types/api';
import { formatPrice } from '../../utils/formatters';

// Platform icons mapping
const getPlatformIcon = (platform: string): string => {
  const icons: Record<string, string> = {
    facebook: 'logo-facebook',
    instagram: 'logo-instagram',
    twitter: 'logo-twitter',
    tiktok: 'logo-tiktok',
    youtube: 'logo-youtube',
    google: 'logo-google',
    whatsapp: 'logo-whatsapp',
  };
  return icons[platform?.toLowerCase()] || 'globe-outline';
};

// Platform colors
const getPlatformColor = (platform: string): string => {
  const colors: Record<string, string> = {
    facebook: '#1877F2',
    instagram: '#E4405F',
    twitter: '#1DA1F2',
    tiktok: '#000000',
    youtube: '#FF0000',
    google: '#4285F4',
    whatsapp: '#25D366',
  };
  return colors[platform?.toLowerCase()] || Colors.accent;
};

export const DigitalAdsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  const [digitalAds, setDigitalAds] = useState<DigitalAd[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDigitalAds();
  }, []);

  const loadDigitalAds = async () => {
    try {
      setError(null);
      const data = await digitalAdsApi.getAll();
      setDigitalAds(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load digital ads');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadDigitalAds();
  };

  const getMinPrice = (ad: DigitalAd) => {
    if (ad.packages && ad.packages.length > 0) {
      return Math.min(...ad.packages.map(p => p.price));
    }
    return 0;
  };

  const renderDigitalAdCard = ({ item }: { item: DigitalAd }) => {
    const platformColor = getPlatformColor(item.id);
    const platformIcon = getPlatformIcon(item.id);
    const minPrice = getMinPrice(item);
    
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('DigitalAdDetail', { id: item.id })}
      >
        <Card variant="elevated" padding="none" style={styles.adCard}>
          {/* Image from Backend or fallback to colored header */}
          {item.image_url ? (
            <Image 
              source={{ uri: item.image_url }} 
              style={styles.adImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.adHeader, { backgroundColor: platformColor }]}>
              <Ionicons name={platformIcon as any} size={32} color={Colors.white} />
              <Text style={styles.platformName}>{item.name || item.id}</Text>
            </View>
          )}
          
          {/* Content */}
          <View style={styles.adContent}>
            {item.image_url && (
              <View style={styles.platformRow}>
                <Ionicons name={platformIcon as any} size={20} color={platformColor} />
                <Text style={[styles.platformNameSmall, { color: platformColor }]}>{item.name || item.id}</Text>
              </View>
            )}
            
            <Text style={styles.adDescription} numberOfLines={2}>
              {item.description}
            </Text>
            
            {item.packages && item.packages.length > 0 && (
              <View style={styles.packagesInfo}>
                <Badge 
                  text={`${item.packages.length} Packages`} 
                  variant="default" 
                  size="sm" 
                />
              </View>
            )}
            
            <View style={styles.adFooter}>
              <View>
                <Text style={styles.priceLabel}>Starting from</Text>
                <Text style={styles.priceValue}>{formatPrice(minPrice)}</Text>
              </View>
              <View style={styles.viewButton}>
                <Text style={styles.viewButtonText}>View Packages</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
              </View>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading digital ads..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadDigitalAds} fullScreen />;
  }

  if (digitalAds.length === 0) {
    return (
      <EmptyState
        icon="globe-outline"
        title="No digital ads available"
        description="Check back later for digital advertising options"
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Digital Advertising</Text>
        <Text style={styles.headerSubtitle}>
          Reach your audience across major social platforms
        </Text>
      </View>
      
      <FlatList
        data={digitalAds}
        renderItem={renderDigitalAdCard}
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
  headerContainer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  adCard: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  adImage: {
    width: '100%',
    height: 160,
  },
  adHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  platformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  platformNameSmall: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.bold,
    textTransform: 'capitalize',
  },
  platformName: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.white,
    textTransform: 'capitalize',
  },
  adContent: {
    padding: 16,
  },
  adDescription: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  packagesInfo: {
    marginBottom: 12,
  },
  adFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  priceLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewButtonText: {
    fontSize: Fonts.size.sm,
    color: Colors.accent,
    fontWeight: Fonts.weight.semibold,
    marginRight: 4,
  },
});
