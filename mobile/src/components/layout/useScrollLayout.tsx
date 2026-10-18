import { useLayoutEffect, type ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { Edge } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAnimatedTheme } from "react-native-unistyles/reanimated";

export type ScrollLayoutProps = {
  /** Fixed content above the scrollable area, not part of its header. */
  beforeScroll?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
  /** Scroll distance in points over which the header becomes opaque. */
  headerTransitionDistance?: number;
  edges?: Edge[];
};

function ScrollHeaderBackground({
  offset,
  distance,
}: {
  offset: SharedValue<number>;
  distance: number;
}) {
  const theme = useAnimatedTheme();

  const animatedStyle = useAnimatedStyle(() => {
    const progress = interpolate(offset.value, [0, distance], [0, 1], Extrapolation.CLAMP);

    return {
      backgroundColor: interpolateColor(
        progress,
        [0, 1],
        ["transparent", theme.value.colors.surface],
      ),
      boxShadow: `0px 4px 12px 0px ${interpolateColor(progress, [0, 1], ["rgba(15, 23, 42, 0)", "rgba(15, 23, 42, 0.08)"])}`,
    };
  });

  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle]} />;
}

export function useScrollLayout(offset: SharedValue<number>, headerTransitionDistance = 48) {
  const navigation = useNavigation();
  const distance = Math.max(1, headerTransitionDistance);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTransparent: true,
      headerBackground: () => <ScrollHeaderBackground offset={offset} distance={distance} />,
    });

    return () => navigation.setOptions({ headerBackground: undefined, headerTransparent: false });
  }, [navigation, offset, distance]);
}
