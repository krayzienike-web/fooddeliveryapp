import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { elevation, motion, radius, space, useTheme } from '@/shared/theme';
import { Txt } from './Txt';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  testID?: string;
  /** Max height as a share of the window. */
  maxHeight?: number;
}

/** Bottom sheet: calm spring in, drag the grabber/header down to dismiss. */
export function Sheet({ open, onClose, title, children, footer, testID, maxHeight = 0.88 }: SheetProps) {
  const { c } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(open);
  const y = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      y.value = withSpring(0, motion.springCalm);
      backdrop.value = withTiming(1, { duration: motion.durMedium });
    } else if (mounted) {
      backdrop.value = withTiming(0, { duration: motion.durMedium });
      y.value = withTiming(height, { duration: motion.durMedium }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pan = usePanGesture({
    activeOffsetY: 8,
    onUpdate: (e) => {
      'worklet';
      y.value = Math.max(0, e.translationY);
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > 120 || e.velocityY > 900) runOnJS(onClose)();
      else y.value = withSpring(0, motion.springCalm);
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  if (!mounted) return null;
  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Закрыть" />
      </Animated.View>
      <Animated.View
        testID={testID}
        style={[
          styles.sheet,
          elevation.sheet,
          { backgroundColor: c.surface, maxHeight: height * maxHeight, paddingBottom: Math.max(insets.bottom, space.l) },
          sheetStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={{ paddingTop: space.s, paddingBottom: title ? space.s : 0, paddingHorizontal: space.xl }}>
            <View style={[styles.grabber, { backgroundColor: c.outline }]} />
            {title ? (
              <Txt v="headline" style={{ marginTop: space.m }}>
                {title}
              </Txt>
            ) : null}
          </View>
        </GestureDetector>
        <View style={{ flexShrink: 1 }}>{children}</View>
        {footer ? <View style={{ paddingHorizontal: space.xl, paddingTop: space.m }}>{footer}</View> : null}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: radius.l, borderTopRightRadius: radius.l, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
});
