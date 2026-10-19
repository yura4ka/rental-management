import { ComponentPropsWithRef, useImperativeHandle } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScrollLayout, type ScrollLayoutProps } from "../useScrollLayout";

export type FlatListLayoutProps<T> = ComponentPropsWithRef<typeof Animated.FlatList<T>> &
  ScrollLayoutProps;

export function FlatListLayout<T>({
  ref,
  beforeScroll,
  containerStyle,
  headerTransitionDistance,
  style,
  scrollEventThrottle = 16,
  edges,
  ...props
}: FlatListLayoutProps<T>) {
  const scrollRef = useAnimatedRef<typeof Animated.FlatList<T>>();
  const offset = useScrollOffset(scrollRef);
  useScrollLayout(offset, headerTransitionDistance);
  useImperativeHandle(ref, () => scrollRef.current!);

  return (
    <SafeAreaView edges={edges} style={[styles.container, containerStyle]}>
      {beforeScroll}
      <Animated.FlatList
        contentInsetAdjustmentBehavior="never"
        {...props}
        ref={scrollRef}
        scrollEventThrottle={scrollEventThrottle}
        style={[styles.container, style]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1 } });
