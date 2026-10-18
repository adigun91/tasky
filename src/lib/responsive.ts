import { useWindowDimensions } from 'react-native';

export type DeviceType = 'phone' | 'tablet' | 'desktop';

/** Narrow forms (task-form, profile, settings) shouldn't stretch edge-to-edge on large screens. */
export const FORM_MAX_WIDTH = 560;
/** Wider content (task list, calendar) can use more space, enabling multi-column layouts. */
export const CONTENT_MAX_WIDTH = 900;

/**
 * Classifies the current window into a device type. Uses the shorter side (orientation-independent)
 * to tell native phones from tablets, and the raw width to catch wide web/desktop windows.
 */
export function useDeviceType(): DeviceType {
  const { width, height } = useWindowDimensions();
  const shortSide = Math.min(width, height);
  if (width >= 1000) return 'desktop';
  if (shortSide >= 600) return 'tablet';
  return 'phone';
}

export function useIsTablet(): boolean {
  return useDeviceType() !== 'phone';
}

/** Task/day-cell columns to render side by side, based on available width. */
export function useColumns(): number {
  const deviceType = useDeviceType();
  if (deviceType === 'desktop') return 3;
  if (deviceType === 'tablet') return 2;
  return 1;
}

/** Centers content and caps its width on tablet/desktop so it doesn't stretch edge-to-edge. */
export function useResponsiveContentStyle(maxWidth: number = CONTENT_MAX_WIDTH) {
  return { width: '100%' as const, maxWidth, alignSelf: 'center' as const };
}
