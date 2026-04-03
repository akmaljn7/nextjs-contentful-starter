import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, LoadingSpinner } from '../../components/common';
import { useAuthStore, useCartStore } from '../../store';
import { influencersApi, billboardsApi } from '../../api';
import { Influencer, Billboard } from '../../types/api';
import { formatNumber, formatPrice } from '../../utils/formatters';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../i18n';

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const cartItems = useCartStore((state) => state.items);
  const { isDark, colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  
  // Calculate top padding for status bar (especially important for Android)
  const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 24) : insets.top;
  
  const SERVICES = [
    { id: 'influencers', name: t.services.influencers, icon: 'people', color: '#8b5cf6', description: t.services.influencersDesc },
    { id: 'billboards', name: t.services.billboards, icon: 'tv', color: '#f59e0b', description: t.services.billboardsDesc },
    { id: 'digital', name: t.services.digitalAds, icon: 'globe', color: '#3b82f6', description: t.services.digitalAdsDesc },
    { id: 'kannywood', name: t.services.kannywood, icon: 'film', color: '#ec4899', description: t.services.kannywoodDesc },
    { id: 'consultation', name: t.services.consultation, icon: 'calendar', color: '#10b981', description: t.services.consultationDesc },
  ];
  
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
      case 'consultation':
        navigation.navigate('ExploreTab', { screen: 'Consultation' });
        break;
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPadding }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textPrimary }]}>{t.home.greeting}, {user?.name?.split(' ')[0] || 'there'}!</Text>
            <Text style={[styles.subGreeting, { color: colors.textSecondary }]}>{t.home.whatToPromote}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.surface }]}
              onPress={() => navigation.navigate('HomeTab', { screen: 'Search' })}
            >
              <Ionicons name="search" size={24} color={colors.textPrimary} />
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
          <Text style={styles.heroTitle}>{t.home.heroTitle}</Text>
          <Text style={styles.heroSubtitle}>{t.home.heroSubtitle}</Text>
          <TouchableOpacity
            style={styles.consultationCTA}
            onPress={() => navigation.navigate('ExploreTab', { screen: 'Consultation' })}
          >
            <Text style={styles.consultationCTAText}>{t.home.getConsultation}</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        </Card>

        {/* Our Services - Horizontal Scroll */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.home.ourServices}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.servicesScroll}>
            {SERVICES.map((service) => (
              <TouchableOpacity
                key={service.id}
                style={[styles.serviceCard, { backgroundColor: colors.surface }]}
                onPress={() => handleCategoryPress(service.id)}
              >
                <View style={[styles.serviceIconBox, { backgroundColor: service.color + '15' }]}>
                  <Ionicons name={service.icon as any} size={32} color={service.color} />
                </View>
                <Text style={[styles.serviceLabel, { color: colors.textPrimary }]}>{service.name}</Text>
                <Text style={[styles.serviceDesc, { color: colors.textSecondary }]}>{service.description}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Featured Influencers */}
        {featuredInfluencers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.home.topInfluencers}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ExploreTab', { screen: 'Influencers' })}>
                <Text style={styles.seeAllText}>{t.common.seeAll}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {featuredInfluencers.map((influencer) => (
                <TouchableOpacity
                  key={influencer.id}
                  style={[styles.influencerCard, { backgroundColor: isDark ? colors.surface : Colors.primary }]}
                  onPress={() => {
                    navigation.navigate('ExploreTab', { 
                      screen: 'InfluencerDetail', 
                      params: { id: influencer.id },
                      initial: false,
                    });
                  }}
                >
                  <View style={styles.influencerImageContainer}>
                    {(influencer.profile_image_url || influencer.image_url) ? (
                      <Image source={{ uri: influencer.profile_image_url || influencer.image_url }} style={styles.influencerImage} />
                    ) : (
                      <View style={[styles.influencerImagePlaceholder, { backgroundColor: colors.gray[200] }]}>
                        <Ionicons name="person" size={32} color={colors.gray[400]} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.influencerName} numberOfLines={1}>{influencer.name}</Text>
                  <Text style={styles.influencerPlatform}>{influencer.platform}</Text>
                  <Text style={styles.influencerFollowers}>{formatNumber(influencer.followers)} {t.influencers.followers}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Featured Billboards */}
        {featuredBillboards.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.home.billboardCategories}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ExploreTab', { screen: 'Billboards' })}>
                <Text style={styles.seeAllText}>{t.common.seeAll}</Text>
              </TouchableOpacity>
            </View>
            {featuredBillboards.map((billboard) => (
              <TouchableOpacity
                key={billboard.id}
                style={[styles.billboardCard, { backgroundColor: colors.surface }]}
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
                    <Text style={[styles.billboardName, { color: colors.textPrimary }]}>{billboard.location_name}</Text>
                    <Text style={[styles.billboardType, { color: colors.textSecondary }]}>{billboard.billboard_type}</Text>
                  </View>
                </View>
                <View style={styles.billboardPrice}>
                  <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>From</Text>
                  <Text style={styles.priceValue}>{formatPrice(billboard.price_monthly)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
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
  servicesScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  serviceCard: {
    width: 110,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
  },
  serviceIconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  serviceLabel: {
    fontSize: Fonts.size.sm,
    color: Colors.textPrimary,
    fontWeight: Fonts.weight.semibold,
    textAlign: 'center',
    marginBottom: 4,
  },
  serviceDesc: {
    fontSize: Fonts.size.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  horizontalScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  influencerCard: {
    width: 140,
    backgroundColor: Colors.primary,
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
    color: Colors.white,
    marginBottom: 2,
  },
  influencerPlatform: {
    fontSize: Fonts.size.xs,
    color: Colors.accent,
    marginBottom: 2,
  },
  influencerFollowers: {
    fontSize: Fonts.size.xs,
    color: Colors.white + 'aa',
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
