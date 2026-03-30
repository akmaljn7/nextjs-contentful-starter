import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const SplashScreenComponent: React.FC = () => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/splash.png')}
        style={styles.splashImage}
        resizeMode="contain"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImage: {
    width: width * 0.6,
    height: height * 0.4,
  },
});
