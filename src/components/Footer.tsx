import { StyleSheet, Text, View } from 'react-native';

/** Shown at the bottom of every screen (and the splash transition) — year auto-updates. */
export function Footer({ light = false }: { light?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <View style={styles.container}>
      <Text style={[styles.text, light && styles.textLight]}>
        © {year} Powered by autom8 Inc ®
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingVertical: 10,
  },
  text: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  textLight: { color: 'rgba(255,255,255,0.7)' },
});
