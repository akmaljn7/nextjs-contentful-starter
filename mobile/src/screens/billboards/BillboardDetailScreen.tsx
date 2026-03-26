import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { Card, Button, LoadingSpinner, EmptyState } from '../../components/common';
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
      const [statesData, sizesData, typesData] = await Promise.all([
        billboardsApi.getStates(),
        billboardsApi.getSizes(),
        billboardsApi.getTypes({ category: billboardCategory === 'led' ? undefined : billboardCategory }),
      ]);
      setStates(statesData);
      setSizes(sizesData);
      setTypes(typesData.filter(t => !t.is_independent));
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStateChange = (stateId: string) => {
    setSelectedState(stateId);
    setSelectedRoad('');
    setShowPackages(false);
    setPackages([]);
  };

  const handleViewPackages = async () => {
    if (!selectedState || !selectedRoad) {
      Alert.alert('Required', 'Please select state and road');
      return;
    }

    if (billboardCategory === 'led' && !selectedSize) {
      Alert.alert('Required', 'Please select LED size');
      return;
    }

    if ((billboardCategory === 'static_banner' || billboardCategory === 'lightbox') && !selectedType) {
      Alert.alert('Required', 'Please select billboard type');
      return;
    }

    setIsLoadingPackages(true);
    try {
      let data: BillboardPackage[];

      if (billboardCategory === 'led') {
        data = await billboardsApi.getLedPackages({
          state_id: selectedState,
          road_name: selectedRoad,
          size_id: selectedSize,
        });
      } else if (isIndependent) {
        data = await billboardsApi.getStaticPackages({
          billboard_type_id: id,
          state_id: selectedState,
          road_name: selectedRoad,
        });
      } else {
        data = await billboardsApi.getStaticPackages({
          category: billboardCategory,
          state_id: selectedState,
          road_name: selectedRoad,
          type_id: selectedType,
        });
      }

      setPackages(data);
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
      listingType: billboardCategory === 'led' ? 'led_billboard' : 
        isIndependent ? 'independent_billboard' : billboardCategory,
      listingId: pkg.id,
      listingName: `${type} - ${state?.name}, ${selectedRoad}`,
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
        <Text style={styles.headerTitle}>{type}</Text>
        <Text style={styles.headerSubtitle}>Select your preferences below to view available packages</Text>
      </Card>

      {/* Filters */}
      <View style={styles.filters}>
        {/* State Picker */}
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>State</Text>
          <View style={styles.picker}>
            <Picker
              selectedValue={selectedState}
              onValueChange={handleStateChange}
              style={styles.pickerInput}
            >
              <Picker.Item label="Select State" value="" />
              {states.map((state) => (
                <Picker.Item key={state.id} label={state.name} value={state.id} />
              ))}
            </Picker>
          </View>
        </View>

        {/* Road Picker */}
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerLabel}>Road</Text>
          <View style={styles.picker}>
            <Picker
              selectedValue={selectedRoad}
              onValueChange={(value) => { setSelectedRoad(value); setShowPackages(false); }}
              style={styles.pickerInput}
              enabled={availableRoads.length > 0}
            >
              <Picker.Item label="Select Road" value="" />
              {availableRoads.map((road, idx) => (
                <Picker.Item key={idx} label={road.name} value={road.name} />
              ))}
            </Picker>
          </View>
        </View>

        {/* LED Size Picker */}
        {billboardCategory === 'led' && (
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>LED Size</Text>
            <View style={styles.picker}>
              <Picker
                selectedValue={selectedSize}
                onValueChange={(value) => { setSelectedSize(value); setShowPackages(false); }}
                style={styles.pickerInput}
              >
                <Picker.Item label="Select Size" value="" />
                {sizes.map((size) => (
                  <Picker.Item key={size.id} label={`${size.name} (${size.dimensions})`} value={size.id} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        {/* Billboard Type Picker (for Static/Lightbox) */}
        {(billboardCategory === 'static_banner' || billboardCategory === 'lightbox') && !isIndependent && (
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerLabel}>Type</Text>
            <View style={styles.picker}>
              <Picker
                selectedValue={selectedType}
                onValueChange={(value) => { setSelectedType(value); setShowPackages(false); }}
                style={styles.pickerInput}
              >
                <Picker.Item label="Select Type" value="" />
                {types.filter(t => t.billboard_category === billboardCategory).map((type) => (
                  <Picker.Item key={type.id} label={type.name} value={type.id} />
                ))}
              </Picker>
            </View>
          </View>
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
          <Text style={styles.packagesTitle}>Available Packages</Text>
          {packages.length === 0 ? (
            <EmptyState
              icon="folder-open-outline"
              title="No packages found"
              description="Try different selections"
            />
          ) : (
            packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                package_={pkg}
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
    fontSize: Fonts.size['2xl'],
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
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: Fonts.size.sm,
    fontWeight: Fonts.weight.medium,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  picker: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerInput: {
    height: 50,
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
