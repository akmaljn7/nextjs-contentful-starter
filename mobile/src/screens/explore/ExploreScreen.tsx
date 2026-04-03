import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card } from '../../components/common';
import { useTheme } from '../../contexts/ThemeContext';

const EXPLORE_ITEMS = [
  {
    id: 'influencers',
    title: 'Influencers',
    description: 'Connect with top content creators',
    icon: 'people',
    color: '#8b5cf6',
    screen: 'Influencers',
  },
  {
    id: 'billboards',
    title: 'Billboards',
    description: 'Premium outdoor advertising locations',
    icon: 'tv',
    color: '#f59e0b',
    screen: 'Billboards',
  },
  {
    id: 'digital',
    title: 'Digital Ads',
    description: 'Social media & online advertising',
    icon: 'globe',
    color: '#3b82f6',
    screen: 'DigitalAds',
  },
  {
    id: 'kannywood',
    title: 'Kannywood',
    description: 'Movie & TV show placements',
    icon: 'film',
    color: '#ec4899',
    screen: 'Kannywood',
  },
  {
    id: 'consultation',
    title: 'Get a Consultation',
    description: 'Expert advertising guidance',
    icon: 'chatbubbles',
    color: '#10b981',
    screen: 'Consultation',
  },
];

export const ExploreScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  // Calculate top padding for status bar (especially important for Android)
  const topPadding = Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 24) : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: topPadding }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Explore</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Discover advertising opportunities</Text>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {EXPLORE_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.8}
          >
            <Card variant="elevated" padding="lg" style={styles.card}>
              <View style={styles.cardContent}>
                <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                  <Ionicons name={item.icon as any} size={32} color={item.color} />
                </View>
                <View style={styles.textContainer}>
                  <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{item.title}</Text>
                  <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={colors.textMuted} />
              </View>
            </Card>
          </TouchableOpacity>
        ))}
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: Fonts.size['3xl'],
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    marginBottom: 16,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
  },
});
