import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const artwork = require('../../assets/images/yellow-otter-logo.png');

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <View testID="brand-logo" style={[styles.frame, compact && styles.compact]}>
    <Image source={artwork} accessibilityLabel="CutiSama2 — an otter with a backpack and travel map" contentFit="contain" style={StyleSheet.absoluteFill} />
  </View>;
}

const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 400, aspectRatio: 1443 / 431 },
  compact: { width: 148 },
});
