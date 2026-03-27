import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, LoadingSpinner } from '../../components/common';
import { useAuthStore, useCartStore } from '../../store';
import { influencersApi, billboardsApi } from '../../api';
import { Influencer, Billboard } from '../../types/api';
import { formatNumber, formatPrice } from '../../utils/formatters';

const SERVICES = [
  { id: 'influencers', name: 'Influencers', icon: 'people', color: '#8b5cf6', description: 'Social media marketing' },
  { id: 'billboards', name: 'Billboards', icon: 'tv', color: '#f59e0b', description: 'Outdoor advertising' },
  { id: 'digital', name: 'Digital Ads', icon: 'globe', color: '#3b82f6', description: 'Online campaigns' },
  { id: 'kannywood', name: 'Kannywood', icon: 'film', color: '#ec4899', description: 'Movie placements' },
];

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const cartItems = useCartStore((state) => state.items);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [featuredInfluencers, setFeaturedInfluencers] = useState<Influencer[]>([]);
  const [featuredBillboards, setFeaturedBillboards] = useState<Billboard[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [influencers, billboards] = await Promise.all([
        influencersApi.getAll(),
        billboardsApi.getAll(),
      ]);
      setFeaturedInfluencers(influencers.slice(0, 4));
      setFeaturedBillboards(billboards.slice(0, 3));
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const onRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  const handleCategoryPress = (categoryId: string) => {
    switch (categoryId) {
      case 'influencers':
        navigation.navigate('ExploreTab', { screen: 'Influencers' });
        break;
      case 'billboards':
        navigation.navigate('ExploreTab', { screen: 'Billboards' });
        break;
      case 'digital':
        navigation.navigate('ExploreTab', { screen: 'DigitalAds' });
        break;
      case 'kannywood':
        navigation.navigate('ExploreTab', { screen: 'Kannywood' });
        break;
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'}!</Text>
            <Text style={styles.subGreeting}>What would you like to promote today?</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => navigation.navigate('HomeTab', { screen: 'Search' })}
            >
              <Ionicons name="search" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => navigation.navigate('CartTab')}
            >
              <Ionicons name="cart" size={24} color={Colors.white} />
              {cartItems.length > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItems.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero Banner */}
        <Card variant="elevated" padding="lg" style={styles.heroBanner}>
          <Text style={styles.heroTitle}>Book trusted ads across Northern Nigeria</Text>
          <Text style={styles.heroSubtitle}>
            Connect with verified influencers, premium billboards, and Kannywood placements
          </Text>
          <TouchableOpacity
            style={styles.consultationCTA}
            onPress={() => navigation.navigate('ExploreTab', { screen: 'Consultation' })}
          >
            <Text style={styles.consultationCTAText}>Get a Consultation</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        </Card>

        {/* Categories - 4 in a row */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.categoriesRow}>
            {SERVICES.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={styles.categoryItem}
                onPress={() => handleCategoryPress(service.id)}
              >
                <View style={[styles.categoryIconBox, { backgroundColor: service.color + '15' }]}>
                  <Ionicons name={service.icon as any} size={28} color={service.color} />
                </View>
                <Text style={styles.categoryLabel}>{service.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Featured Influencers */}
        {featuredInfluencers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Influencers</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ExploreTab', { screen: 'Influencers' })}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {featuredInfluencers.map((influencer) => (
                <TouchableOpacity
                  key={influencer.id}
                  style={styles.influencerCard}
                  onPress={() => navigation.navigate('ExploreTab', { 
                    screen: 'InfluencerDetail', 
                    params: { id: influencer.id } 
                  })}
                >
                  <View style={styles.influencerImageContainer}>
                    {(influencer.profile_image_url || influencer.image_url) ? (
                      <Image source={{ uri: influencer.profile_image_url || influencer.image_url }} style={styles.influencerImage} />
                    ) : (
                      <View style={styles.influencerImagePlaceholder}>
                        <Ionicons name="person" size={32} color={Colors.gray[400]} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.influencerName} numberOfLines={1}>{influencer.name}</Text>
                  <Text style={styles.influencerPlatform}>{influencer.platform}</Text>
                  <Text style={styles.influencerFollowers}>{formatNumber(influencer.followers)} followers</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Featured Billboards */}
        {featuredBillboards.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Billboard Categories</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ExploreTab', { screen: 'Billboards' })}>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {featuredBillboards.map((billboard) => (
              <TouchableOpacity
                key={billboard.id}
                style={styles.billboardCard}
                onPress={() => navigation.navigate('ExploreTab', { 
                  screen: 'BillboardDetail', 
                  params: { id: billboard.id, type: billboard.billboard_type } 
                })}
              >
                <View style={styles.billboardInfo}>
                  <View style={styles.billboardIconContainer}>
                    <Ionicons name="tv-outline" size={24} color={Colors.accent} />
                  </View>
                  <View style={styles.billboardText}>
                    <Text style={styles.billboardName}>{billboard.location_name}</Text>
                    <Text style={styles.billboardType}>{billboard.billboard_type}</Text>
                  </View>
                </View>
                <View style={styles.billboardPrice}>
                  <Text style={styles.priceLabel}>From</Text>
                  <Text style={styles.priceValue}>{formatPrice(billboard.price_monthly)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: Fonts.size['2xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  subGreeting: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: Fonts.weight.bold,
  },
  heroBanner: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: Colors.primary,
  },
  heroTitle: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.white,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: Fonts.size.sm,
    color: Colors.white + 'cc',
    lineHeight: 20,
    marginBottom: 16,
  },
  consultationCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    alignSelf: 'flex-start',
    gap: 8,
  },
  consultationCTAText: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.white,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: Fonts.size.sm,
    color: Colors.accent,
    fontWeight: Fonts.weight.medium,
  },
  categoriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryItem: {
    alignItems: 'center',
    width: '23%',
  },
  categoryIconBox: {
    width: 70,
    height: 70,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textPrimary,
    fontWeight: Fonts.weight.medium,
    textAlign: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginHorizontal: -6,
  },
  categoryCard: {
    width: '25%',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginBottom: 16,
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: Fonts.size.xs,
    color: Colors.textPrimary,
    fontWeight: Fonts.weight.medium,
    textAlign: 'center',
  },
  horizontalScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  influencerCard: {
    width: 140,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
    alignItems: 'center',
  },
  influencerImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 12,
  },
  influencerImage: {
    width: '100%',
    height: '100%',
  },
  influencerImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.gray[200],
    alignItems: 'center',
    justifyContent: 'center',
  },
  influencerName: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  influencerPlatform: {
    fontSize: Fonts.size.xs,
    color: Colors.accent,
    marginBottom: 2,
  },
  influencerFollowers: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
  },
  billboardCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  billboardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  billboardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  billboardText: {
    flex: 1,
  },
  billboardName: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  billboardType: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
  billboardPrice: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.bold,
    color: Colors.accent,
  },
  bottomSpacing: {
    height: 24,
  },
});
