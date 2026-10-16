import { useState, type ComponentProps } from "react";
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
  const [hasFocus, setHasFocus] = useState(false);

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
      }}
      isFocused={!disabled && (isFocused || hasFocus)}
      hasValue={!!value?.length}
    >
      {({ textStyles, viewStyles }) => (
        <TouchableOpacity
          accessibilityRole="button"
          {...props}
          disabled={disabled}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityValue={{ text: value, ...props.accessibilityValue }}
          accessibilityState={{ ...props.accessibilityState, disabled }}
          onFocus={(event) => {
            setHasFocus(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setHasFocus(false);
            onBlur?.(event);
          }}
          style={[viewStyles, style]}
        >
          <Text style={textStyles}>{value || " "}</Text>
        </TouchableOpacity>
      )}
    </InputBase>
  );
}
