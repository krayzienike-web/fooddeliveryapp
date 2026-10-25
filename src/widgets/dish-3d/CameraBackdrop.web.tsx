import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { unstable_createElement as createElement } from 'react-native-web';
import { useTheme } from '@/shared/theme';
import { FoodImage } from '@/shared/ui';

/**
 * Web: rear camera through getUserMedia when the browser (and the hosting frame) allow it,
 * otherwise a restaurant table photo. Never blocks the 3D view.
 */
export function CameraBackdrop({ onState }: { onState?: (s: 'camera' | 'photo' | 'asking') => void }) {
  const { c } = useTheme();
  const video = useRef<HTMLVideoElement | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let stream: MediaStream | null = null;
    let alive = true;
    onState?.('asking');
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) {
      onState?.('photo');
      return;
    }
    md.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => undefined);
        }
        setLive(true);
        onState?.('camera');
      })
      .catch(() => onState?.('photo'));
    return () => {
      alive = false;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.island }]}>
      {!live ? <FoodImage id="rest-3" style={StyleSheet.absoluteFill} blurRadius={2} /> : null}
      {createElement('video', {
        ref: video,
        muted: true,
        playsInline: true,
        autoPlay: true,
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: live ? 1 : 0 },
      })}
    </View>
  );
}
