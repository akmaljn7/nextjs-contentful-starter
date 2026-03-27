import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, Button, LoadingSpinner, EmptyState, CustomDropdown } from '../../components/common';
import { PackageCard } from '../../components/cards';
import { billboardsApi } from '../../api';
import { useCartStore } from '../../store';
import { BillboardState, BillboardSize, BillboardType, BillboardPackage } from '../../types/api';
import { formatPrice } from '../../utils/formatters';

export const BillboardDetailScreen: React.FC = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { id, type, isIndependent } = route.params;
  const { items: cartItems, addItem } = useCartStore();

  const [states, setStates] = useState<BillboardState[]>([]);
  const [sizes, setSizes] = useState<BillboardSize[]>([]);
  const [types, setTypes] = useState<BillboardType[]>([]);
  const [packages, setPackages] = useState<BillboardPackage[]>([]);
  
  const [selectedState, setSelectedState] = useState('');
  const [selectedRoad, setSelectedRoad] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedType, setSelectedType] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [showPackages, setShowPackages] = useState(false);

  const billboardCategory = type?.toLowerCase().includes('led') ? 'led' : 
    type?.toLowerCase().includes('lightbox') ? 'lightbox' : 'static_banner';

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      console.log('Loading billboard config...');
      const [statesData, sizesData, typesData] = await Promise.all([
        billboardsApi.getStates(),
        billboardsApi.getSizes(),
        billboardsApi.getTypes({ category: billboardCategory === 'led' ? undefined : billboardCategory }),
      ]);
      console.log('States loaded:', statesData?.length || 0);
      console.log('Sizes loaded:', sizesData?.length || 0);
      console.log('Types loaded:', typesData?.length || 0);
      
      setStates(statesData || []);
      setSizes(sizesData || []);
      setTypes((typesData || []).filter(t => !t.is_independent));
    } catch (error) {
      console.error('Error loading config:', error);
      Alert.alert('Error', 'Failed to load billboard options. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStateChange = (value: string) => {
    setSelectedState(value);
    setSelectedRoad('');
    setShowPackages(false);
  };

  const handleViewPackages = async () => {
    if (!selectedState || !selectedRoad) {
      Alert.alert('Selection Required', 'Please select a state and road');
      return;
    }

    setIsLoadingPackages(true);
    try {
      let pkgs: BillboardPackage[];
      
      if (billboardCategory === 'led') {
        pkgs = await billboardsApi.getLedPackages({
          state_id: selectedState,
          road_name: selectedRoad,
          size_id: selectedSize || undefined,
        });
      } else {
        pkgs = await billboardsApi.getStaticPackages({
          category: billboardCategory,
          state_id: selectedState,
          road_name: selectedRoad,
          type_id: selectedType || undefined,
        });
      }

      setPackages(pkgs);
      setShowPackages(true);
    } catch (error) {
      console.error('Error loading packages:', error);
      Alert.alert('Error', 'Failed to load packages');
    } finally {
      setIsLoadingPackages(false);
    }
  };

  const handleAddToCart = (pkg: BillboardPackage) => {
    const state = states.find(s => s.id === selectedState);
    const size = sizes.find(s => s.id === selectedSize);
    const billboardType = types.find(t => t.id === selectedType);

    addItem({
      id: pkg.id,
      listingType: 'billboard',
      listingId: id,
      listingName: type || 'Billboard',
      packageId: pkg.id,
      packageTitle: pkg.title,
      price: pkg.price,
      duration: pkg.duration,
      deliverables: pkg.deliverables || [],
      image_url: pkg.image_url,
      location: `${state?.name}, ${selectedRoad}`,
      state_name: state?.name,
      road_name: selectedRoad,
      size_name: size?.name,
      type_name: billboardType?.name,
    });
  };

  const isInCart = (pkgId: string) => {
    return cartItems.some(item => item.id === pkgId);
  };

  const availableRoads = selectedState 
    ? states.find(s => s.id === selectedState)?.roads || []
    : [];

  // Convert states to dropdown options
  const stateOptions = states.map(state => ({
    label: state.name,
    value: state.id,
  }));

  // Convert roads to dropdown options
  const roadOptions = availableRoads.map(road => ({
    label: road.name,
    value: road.name,
  }));

  // Convert sizes to dropdown options
  const sizeOptions = sizes.map(size => ({
    label: `${size.name}${size.description ? ` - ${size.description}` : ''}`,
    value: size.id,
  }));

  // Convert types to dropdown options
  const typeOptions = types
    .filter(t => t.billboard_category === billboardCategory)
    .map(t => ({
      label: t.name,
      value: t.id,
    }));

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading..." />;
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Card variant="elevated" padding="lg" style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <Ionicons 
            name={billboardCategory === 'led' ? 'tv' : billboardCategory === 'lightbox' ? 'bulb' : 'image'} 
            size={32} 
            color={Colors.accent} 
          />
        </View>
        <Text style={styles.headerTitle}>
          {billboardCategory === 'led' ? 'Digital LED' : 
           billboardCategory === 'lightbox' ? 'Lightbox' : 'Static Banner'}
        </Text>
        <Text style={styles.headerSubtitle}>
          Select your preferences below to view available packages
        </Text>
      </Card>

      {/* Filters */}
      <View style={styles.filters}>
        {/* State Dropdown */}
        <CustomDropdown
          label={`State (${states.length} available)`}
          placeholder="Select State"
          value={selectedState}
          options={stateOptions}
          onValueChange={handleStateChange}
        />

        {/* Road Dropdown */}
        <CustomDropdown
          label={`Road (${availableRoads.length} available)`}
          placeholder={availableRoads.length > 0 ? "Select Road" : "Select State First"}
          value={selectedRoad}
          options={roadOptions}
          onValueChange={(value) => { setSelectedRoad(value); setShowPackages(false); }}
          disabled={availableRoads.length === 0}
        />

        {/* LED Size Dropdown */}
        {billboardCategory === 'led' && (
          <CustomDropdown
            label="LED Size"
            placeholder="Select Size"
            value={selectedSize}
            options={sizeOptions}
            onValueChange={(value) => { setSelectedSize(value); setShowPackages(false); }}
          />
        )}

        {/* Billboard Type Dropdown (for Static/Lightbox) */}
        {(billboardCategory === 'static_banner' || billboardCategory === 'lightbox') && !isIndependent && (
          <CustomDropdown
            label="Type"
            placeholder="Select Type"
            value={selectedType}
            options={typeOptions}
            onValueChange={(value) => { setSelectedType(value); setShowPackages(false); }}
          />
        )}

        {/* View Packages Button */}
        <Button
          title="View Packages"
          onPress={handleViewPackages}
          loading={isLoadingPackages}
          fullWidth
          size="lg"
          style={styles.viewButton}
        />
      </View>

      {/* Packages */}
      {showPackages && (
        <View style={styles.packagesSection}>
          <Text style={styles.packagesTitle}>
            Available Packages ({packages.length})
          </Text>
          
          {packages.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No Packages Found"
              description="Try different filter options"
            />
          ) : (
            packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                package_={{
                  id: pkg.id,
                  title: pkg.title,
                  description: pkg.description,
                  price: pkg.price,
                  duration: pkg.duration,
                  deliverables: pkg.deliverables || [],
                }}
                onSelect={() => handleAddToCart(pkg)}
                isInCart={isInCart(pkg.id)}
              />
            ))
          )}
        </View>
      )}

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerCard: {
    margin: 16,
    alignItems: 'center',
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: Fonts.size.xl,
    fontWeight: Fonts.weight.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: Fonts.size.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  filters: {
    padding: 16,
  },
  viewButton: {
    marginTop: 8,
  },
  packagesSection: {
    padding: 16,
  },
  packagesTitle: {
    fontSize: Fonts.size.lg,
    fontWeight: Fonts.weight.semibold,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  bottomSpacing: {
    height: 24,
  },
});
