import { type ComponentProps } from "react";
import { TouchableOpacity } from "react-native";
import { Text } from "../Text";
import { InputBase, type InputBaseProps } from "./InputBase";

export type InputPressableProps = Omit<InputBaseProps, "children" | "hasValue"> &
  Omit<ComponentProps<typeof TouchableOpacity>, "children"> & {
    value?: string;
  };

export function InputPressable({
  label,
  description,
  isError,
  disabled = false,
  size,
  isLoadingLeft,
  isLoadingRight,
  iconLeft,
  iconRight,
  onIconLeftPress,
  onIconRightPress,
  isRequired,
  iconLeftAccessibilityLabel,
  iconRightAccessibilityLabel,
  containerStyle,
  isFocused = false,
  value,
  onFocus,
  onBlur,
  style,
  accessibilityLabel = label,
  accessibilityHint = description,
  ...props
}: InputPressableProps) {
  return (
    <InputBase
      {...{
        label,
        description,
        isError,
        disabled,
        size,
        isLoadingLeft,
        isLoadingRight,
        iconLeft,
        iconRight,
        onIconLeftPress,
        onIconRightPress,
        iconLeftAccessibilityLabel,
        iconRightAccessibilityLabel,
        containerStyle,
        isRequired,
      }}
      hasValue={!!value?.length}
      isFocused={isFocused}
    >
      {({ textStyles, viewStyles }) => (
        <TouchableOpacity
          activeOpacity={0.8}
          accessibilityRole="button"
          {...props}
          disabled={disabled}
          onFocus={onFocus}
          onBlur={onBlur}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityValue={{ text: value, ...props.accessibilityValue }}
          accessibilityState={{ ...props.accessibilityState, disabled }}
          style={[viewStyles, style]}
        >
          <Text style={textStyles}>{value || " "}</Text>
        </TouchableOpacity>
      )}
    </InputBase>
  );
}
