import { TouchableOpacity } from "react-native";
import Animated, { BounceIn, BounceOut } from "react-native-reanimated";
import { StyleSheet } from "react-native-unistyles";
import { Icon } from "@/components/Icon";
import { Text } from "../Text";

export type CheckBoxProps = React.ComponentProps<typeof TouchableOpacity> & {
  title?: string;
  checked?: boolean;
  onCheckedChange?: (isChecked: boolean) => void;
};

export function CheckBox({
  title,
  checked,
  onCheckedChange,
  onPress,
  style,
  ...props
}: CheckBoxProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityLabel="Show archived"
      accessibilityState={{ checked }}
      onPress={(e) => {
        onCheckedChange?.(!checked);
        onPress?.(e);
      }}
      style={[styles.container, style]}
      {...props}
    >
      <Animated.View
        style={[
          styles.box,
          checked && styles.boxChecked,
          { transitionProperty: ["borderColor"], transitionDuration: 150 },
        ]}
      >
        {checked && (
          <Animated.View entering={BounceIn.duration(150)} exiting={BounceOut.duration(150)}>
            <Icon name="TIconCheck" color="primary" size={12} />
          </Animated.View>
        )}
      </Animated.View>
      {!!title && <Text>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flexDirection: "row",
    gap: theme.spacing.md,
    alignItems: "center",
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 1,
    borderWidth: theme.borderWidth.focused,
    borderColor: theme.colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxChecked: {
    borderColor: theme.colors.primary,
  },
}));
