import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  const s = useSharedValue(0);
  useEffect(() => { s.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 1 + s.value * 0.3 }] }));
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
        <Animated.View style={[{ width: 80, height: 80, backgroundColor: 'orange', borderRadius: 40 }, st]} />
        <Text style={{ color: 'white' }}>ok</Text>
      </View>
    </GestureHandlerRootView>
  );
}
