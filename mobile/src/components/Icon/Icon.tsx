import {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import type { SvgProps } from "react-native-svg";
import { useAnimatedTheme } from "react-native-unistyles/reanimated";
import { type IconName, icons } from "@/app/assets/icons";
import type { ColorVariantKey } from "@/app/theme";

type IconProps = {
  name: IconName;
  size?: number | null;
  color?: ColorVariantKey | (string & {}) | SharedValue<string>;
  transitionDuration?: number;
};

export function Icon({ name, size = 24, color = "text", transitionDuration = 0 }: IconProps) {
  const theme = useAnimatedTheme();

  const animatedColor = useDerivedValue(() => {
    const colorValue =
      typeof color === "string"
        ? (theme.value.colorVariants[color as ColorVariantKey]?.color ?? color)
        : color.value;

    return transitionDuration === 0
      ? colorValue
      : withTiming(colorValue, {
          duration: transitionDuration,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
  });

  const animatedProps = useAnimatedProps<SvgProps>(() => ({
    color: animatedColor.value,
  }));

  const IconComponent = icons[name];

  return (
    <IconComponent
      width={size ?? undefined}
      height={size ?? undefined}
      animatedProps={animatedProps}
    />
  );
}
