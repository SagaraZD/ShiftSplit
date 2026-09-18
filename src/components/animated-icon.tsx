import Constants from 'expo-constants';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BRAND_FONT_FAMILY } from '@/constants/theme';

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

const INITIAL_SCALE_FACTOR = Dimensions.get('screen').height / 90;
const DURATION = 600;
// Guaranteed minimum time the branded splash stays fully visible, so it
// never flashes by too fast to read even when auth resolves instantly.
const MIN_DISPLAY_MS = 1800;

interface Props {
  /** True once the app has finished its real startup work (e.g. auth check). */
  ready: boolean;
}

export function AnimatedSplashOverlay({ ready }: Props) {
  const [layoutDone, setLayoutDone] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!layoutDone) return;
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [layoutDone]);

  useEffect(() => {
    if (ready && minTimeElapsed) setAnimate(true);
  }, [ready, minTimeElapsed]);

  if (!visible) return null;

  // The minimum-visible hold is handled above by MIN_DISPLAY_MS before
  // `animate` ever becomes true, so this keyframe is just the fade-out.
  const splashKeyframe = new Keyframe({
    0: {
      opacity: 1,
    },
    100: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
  });

  const content = (
    <View style={styles.contentContainer}>
      <Text style={styles.appName}>ShiftSplit</Text>
      <Image style={styles.image} source={require('@/assets/images/splash-icon.png')} />
      <View style={styles.footer}>
        <ActivityIndicator color="#FFFFFF" />
        <Text style={styles.credit}>By Ganushka Gamage ❤️</Text>
        <Text style={styles.version}>v{appVersion}</Text>
      </View>
    </View>
  );

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {content}
    </Animated.View>
  ) : (
    <View
      onLayout={() => {
        SplashScreen.hideAsync().finally(() => {
          setLayoutDone(true);
        });
      }}
      style={styles.splashOverlay}>
      {content}
    </View>
  );
}

const keyframe = new Keyframe({
  0: {
    transform: [{ scale: INITIAL_SCALE_FACTOR }],
  },
  100: {
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const logoKeyframe = new Keyframe({
  0: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
  },
  40: {
    transform: [{ scale: 1.3 }],
    opacity: 0,
    easing: Easing.elastic(0.7),
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
    easing: Easing.elastic(0.7),
  },
});

const glowKeyframe = new Keyframe({
  0: {
    transform: [{ rotateZ: '0deg' }],
  },
  100: {
    transform: [{ rotateZ: '7200deg' }],
  },
});

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Animated.View entering={glowKeyframe.duration(60 * 1000 * 4)} style={styles.glow}>
        <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      </Animated.View>

      <Animated.View entering={keyframe.duration(DURATION)} style={styles.background} />
      <Animated.View style={styles.imageContainer} entering={logoKeyframe.duration(DURATION)}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    width: 180,
    height: 180,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#236F6E',
    zIndex: 1000,
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 90,
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 34,
    fontFamily: BRAND_FONT_FAMILY,
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    gap: 12,
  },
  credit: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.85,
  },
  version: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.6,
  },
});
