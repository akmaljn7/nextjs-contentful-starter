import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, LoadingSpinner, ErrorMessage, EmptyState, Badge } from '../../components/common';
import { kannywoodApi } from '../../api';
import { KannywoodProduction } from '../../types/api';
import { formatPrice, formatNumber } from '../../utils/formatters';

export const KannywoodScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  
  const [productions, setProductions] = useState<KannywoodProduction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProductions();
  }, []);

  const loadProductions = async () => {
    try {
      setError(null);
      const data = await kannywoodApi.getAll();
      setProductions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load Kannywood productions');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadProductions();
  };

  const getPlacementIcon = (type: string): string => {
    const icons: Record<string, string> = {
      'product_placement': 'cube-outline',
      'scene_integration': 'film-outline',
      'title_sponsorship': 'trophy-outline',
      'trailer_mention': 'play-circle-outline',
    };
    return icons[type?.toLowerCase()] || 'film-outline';
  };

  const handleCardPress = (item: KannywoodProduction) => {
    if (item.is_fully_booked) {
      Alert.alert(
        'Fully Booked',
        'This production is currently fully booked. Please check back later or explore other Kannywood opportunities.',
        [{ text: 'OK', style: 'default' }]
      );
    } else {
      navigation.navigate('KannywoodDetail', { id: item.id });
    }
  };

  const renderProductionCard = ({ item }: { item: KannywoodProduction }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => handleCardPress(item)}
    >
      <Card variant="elevated" padding="none" style={[styles.productionCard, item.is_fully_booked && styles.productionCardDisabled]}>
        {/* Image */}
        <View style={styles.imageContainer}>
          {item.image_url ? (
            <Image 
              source={{ uri: item.image_url }} 
              style={styles.image}
              blurRadius={item.is_fully_booked ? 3 : 0}
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="film" size={48} color={Colors.gray[400]} />
            </View>
          )}
          {/* Fully Booked Overlay */}
          {item.is_fully_booked && (
            <View style={styles.fullyBookedOverlay}>
              <View style={styles.fullyBookedBadge}>
                <Ionicons name="time" size={20} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.fullyBookedText}>FULLY BOOKED</Text>
              </View>
              <Text style={styles.fullyBookedSubtext}>Currently unavailable</Text>
            </View>
          )}
          {item.genre && !item.is_fully_booked && (
            <View style={styles.genreBadge}>
              <Text style={styles.genreText}>{item.genre}</Text>
            </View>
          )}
        </View>
        
        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          
          <View style={styles.placementRow}>
            {item.placement_type && (
              <>
                <Ionicons 
                  name={getPlacementIcon(item.placement_type) as any} 
                  size={16} 
                  color={Colors.textSecondary} 
                />
                <Text style={styles.placementType}>
                  {item.placement_type.replace(/_/g, ' ')}
                </Text>
              </>
            )}
            {item.is_fully_booked && (
              <View style={styles.fullyBookedTag}>
                <Text style={styles.fullyBookedTagText}>Fully Booked</Text>
              </View>
            )}
          </View>
          
          <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
          
          {/* Meta Info */}
          <View style={styles.metaRow}>
            {item.director && (
              <View style={styles.metaItem}>
                <Ionicons name="videocam-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.metaText}>{item.director}</Text>
              </View>
            )}
            {item.release_date && (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.metaText}>{item.release_date}</Text>
              </View>
            )}
          </View>
          
          {/* Stats */}
          <View style={styles.statsRow}>
            {(item.estimated_reach || item.est_reach) && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {formatNumber(item.estimated_reach || parseInt(item.est_reach || '0'))}
                </Text>
                <Text style={styles.statLabel}>Est. Reach</Text>
              </View>
            )}
            {item.packages && item.packages.length > 0 && !item.is_fully_booked && (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{item.packages.length}</Text>
                <Text style={styles.statLabel}>Packages</Text>
              </View>
            )}
          </View>
          
          {/* Footer */}
          <View style={styles.footer}>
            {!item.is_fully_booked && (
              <View>
                <Text style={styles.priceLabel}>Starting from</Text>
                <Text style={styles.priceValue}>{formatPrice(item.price)}</Text>
              </View>
            )}
            {item.is_fully_booked ? (
              <View style={styles.fullyBookedButton}>
                <Text style={styles.fullyBookedButtonText}>Fully Booked</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.viewButton}
                onPress={() => navigation.navigate('KannywoodDetail', { id: item.id })}
              >
                <Text style={styles.viewButtonText}>View Details</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.white} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading Kannywood productions..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={loadProductions} fullScreen />;
  }

  if (productions.length === 0) {
    return (
      <EmptyState
        icon="film-outline"
        title="No Kannywood productions available"
        description="Check back later for movie and TV placement opportunities"
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Kannywood Placements</Text>
        <Text style={styles.headerSubtitle}>
          Feature your brand in Northern Nigeria's top productions
        </Text>
      </View>
      
      <FlatList
        data={productions}
        renderItem={renderProductionCard}
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
  productionCard: {
    marginBottom: 20,
    overflow: 'hidden',
  },
  productionCardDisabled: {
    opacity: 0.85,
  },
  imageContainer: {
    height: 180,
    backgroundColor: Colors.gray[200],
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gray[100],
  },
  genreBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: Colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  genreText: {
    color: Colors.white,
    fontSize: Fonts.size.xs,
    fontWeight: Fonts.weight.semibold,
    textTransform: 'capitalize',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  placementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  placementType: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  description: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  priceLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  viewButtonText: {
    color: Colors.white,
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.semibold,
  },
  fullyBookedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullyBookedBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fullyBookedText: {
    color: Colors.white,
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    textTransform: 'uppercase',
  },
  fullyBookedSubtext: {
    color: Colors.white,
    fontSize: Fonts.size.sm,
    marginTop: 8,
    fontWeight: Fonts.weight.medium,
  },
  fullyBookedTag: {
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  fullyBookedTagText: {
    fontSize: Fonts.size.xs,
    color: '#dc2626',
    fontWeight: Fonts.weight.medium,
  },
  fullyBookedButton: {
    backgroundColor: Colors.gray[300],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fullyBookedButtonText: {
    color: Colors.gray[600],
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.semibold,
  },
});
