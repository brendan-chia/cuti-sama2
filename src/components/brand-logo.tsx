import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

// Frame the original artwork without its outer whitespace; the source stays unchanged.
const artwork = require('../../assets/images/OTTER WEARING A BACKPACK AND HOLDING A ,AP.png');
const frame = { x: 230, y: 200, width: 1460, height: 448 };
export function BrandLogo({ compact = false }: { compact?: boolean }) {
  const [width, setWidth] = useState(compact ? 148 : 320);
  const scale = width / frame.width;
  return <View testID="brand-logo" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.frame, compact && styles.compact]}>
    <Image source={artwork} accessibilityLabel="CutiSama2 — an otter with a backpack and travel map" contentFit="fill" style={{ position: 'absolute', width: 1884 * scale, height: 835 * scale, left: -frame.x * scale, top: -frame.y * scale }} />
  </View>;
}
const styles = StyleSheet.create({
  frame: { width: '100%', maxWidth: 400, aspectRatio: frame.width / frame.height, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  compact: { width: 148 },
});
