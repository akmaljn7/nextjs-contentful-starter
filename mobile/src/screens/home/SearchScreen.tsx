import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Input, LoadingSpinner, EmptyState, Card } from '../../components/common';
import { searchApi } from '../../api';
import { SearchResult } from '../../types/api';
import { formatPrice } from '../../utils/formatters';

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  const [query, setQuery] = useState(route.params?.query || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (route.params?.query) {
      handleSearch(route.params.query);
    }
  }, [route.params?.query]);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setHasSearched(true);
    try {
      const response = await searchApi.search(searchQuery.trim());
      setResults(response.results || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultPress = (result: SearchResult) => {
    switch (result.type) {
      case 'influencer':
        navigation.navigate('ExploreTab', { 
          screen: 'InfluencerDetail', 
          params: { id: result.id } 
        });
        break;
      case 'billboard':
        navigation.navigate('ExploreTab', { 
          screen: 'BillboardDetail', 
          params: { id: result.id, type: 'LED' } 
        });
        break;
      case 'digital_ad':
        navigation.navigate('ExploreTab', { 
          screen: 'DigitalAdDetail', 
          params: { id: result.id } 
        });
        break;
      case 'kannywood':
        navigation.navigate('ExploreTab', { 
          screen: 'KannywoodDetail', 
          params: { id: result.id } 
        });
        break;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'influencer': return 'person';
      case 'billboard': return 'tv';
      case 'digital_ad': return 'globe';
      case 'kannywood': return 'film';
      default: return 'search';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'influencer': return '#8b5cf6';
      case 'billboard': return '#f59e0b';
      case 'digital_ad': return '#3b82f6';
      case 'kannywood': return '#ec4899';
      default: return Colors.accent;
    }
  };

  const renderResult = ({ item }: { item: SearchResult }) => (
    <TouchableOpacity onPress={() => handleResultPress(item)}>
      <Card variant="default" padding="md" style={styles.resultCard}>
        <View style={styles.resultContent}>
          <View style={[styles.resultIcon, { backgroundColor: getTypeColor(item.type) + '20' }]}>
            <Ionicons name={getTypeIcon(item.type) as any} size={24} color={getTypeColor(item.type)} />
          </View>
          <View style={styles.resultText}>
            <Text style={styles.resultName} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.resultDescription} numberOfLines={2}>{item.description}</Text>
            <View style={styles.resultMeta}>
              <Text style={styles.resultType}>{item.type.replace('_', ' ')}</Text>
              {item.price && (
                <Text style={styles.resultPrice}>From {formatPrice(item.price)}</Text>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search influencers, billboards..."
          leftIcon={<Ionicons name="search" size={20} color={Colors.textMuted} />}
          rightIcon={
            query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            ) : undefined
          }
          style={styles.searchInput}
        />
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={() => handleSearch(query)}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {isLoading ? (
        <LoadingSpinner message="Searching..." />
      ) : hasSearched && results.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No results found"
          description={`We couldn't find anything matching "${query}"`}
        />
      ) : (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          contentContainerStyle={styles.resultsList}
          showsVerticalScrollIndicator={false}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
    marginRight: 12,
  },
  searchButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchButtonText: {
    color: Colors.white,
    fontWeight: Fonts.weight.semibold,
  },
  resultsList: {
    padding: 16,
  },
  resultCard: {
    marginBottom: 12,
  },
  resultContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    fontSize: Fonts.size.md,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  resultDescription: {
    fontSize: Fonts.size.sm,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultType: {
    fontSize: Fonts.size.xs,
    color: Colors.textMuted,
    textTransform: 'capitalize',
  },
  resultPrice: {
    fontSize: Fonts.size.xs,
    color: Colors.accent,
    fontWeight: Fonts.weight.semibold,
    marginLeft: 12,
  },
});
