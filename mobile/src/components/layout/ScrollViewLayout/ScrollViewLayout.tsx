import { useImperativeHandle, type Ref } from "react";
import { StyleSheet, type ScrollView, type ScrollViewProps } from "react-native";
import Animated, { useAnimatedRef, useScrollOffset } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useScrollLayout, type ScrollLayoutProps } from "../useScrollLayout";

export type ScrollViewLayoutProps = ScrollViewProps & ScrollLayoutProps & { ref?: Ref<ScrollView> };

export function ScrollViewLayout({
  ref,
  beforeScroll,
  containerStyle,
  headerTransitionDistance,
  style,
  scrollEventThrottle = 16,
  edges,
  ...props
}: ScrollViewLayoutProps) {
  const scrollRef = useAnimatedRef<ScrollView>();
  const offset = useScrollOffset(scrollRef);
  useScrollLayout(offset, headerTransitionDistance);
  useImperativeHandle(ref, () => scrollRef.current!);

  return (
    <SafeAreaView edges={edges} style={[styles.container, containerStyle]}>
      {beforeScroll}
      <Animated.ScrollView
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
