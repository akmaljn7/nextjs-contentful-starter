import React from 'react';
import { View, Image, StyleSheet, Dimensions, Text } from 'react-native';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

const { width, height } = Dimensions.get('window');

export const SplashScreenComponent: React.FC = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/splash.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.appName}>Lightban Ads</Text>
      <Text style={styles.tagline}>Your Trusted Ads Partner</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#161433',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: width * 0.5,
    height: width * 0.5,
    marginBottom: 20,
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
  },
  tagline: {
    fontSize: 16,
    color: '#c4a35a',
    marginTop: 8,
  },
});
