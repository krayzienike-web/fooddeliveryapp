import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { FoodImage } from '@/shared/ui';

/**
 * Live rear camera behind the dish («На столе», Android). If the guest declines the camera,
 * a restaurant table photo stands in so the mode still makes sense.
 */
export function CameraBackdrop({ onState }: { onState?: (s: 'camera' | 'photo' | 'asking') => void }) {
  const { c } = useTheme();
  const [perm, request] = useCameraPermissions();
  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) request();
  }, [perm, request]);
  const live = !!perm?.granted;
  useEffect(() => onState?.(perm === null ? 'asking' : live ? 'camera' : 'photo'), [perm, live, onState]);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.island }]}>
      {live ? <CameraView style={StyleSheet.absoluteFill} facing="back" /> : <FoodImage id="rest-3" style={StyleSheet.absoluteFill} blurRadius={2} />}
    </View>
  );
}
