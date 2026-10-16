import type { ComponentProps } from "react";
import { ActivityIndicator } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { ColorVariantKey } from "@/app/theme";

export type StyledActivityIndicatorProps = ComponentProps<typeof ActivityIndicator> & {
  color: ColorVariantKey;
};

export function StyledActivityIndicator({
  color = "primary",
  ...props
}: StyledActivityIndicatorProps) {
  const { theme } = useUnistyles();
  return <ActivityIndicator {...props} color={theme.colorVariants[color].color} />;
}
