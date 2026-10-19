import { useState, type ComponentPropsWithRef } from "react";
import { TextInput } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { InputBase, type InputBaseProps } from "./InputBase";

export type InputProps = Omit<InputBaseProps, "children" | "isFocused" | "hasValue"> &
  Omit<ComponentPropsWithRef<typeof TextInput>, "children">;

export function Input({
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
  value,
  defaultValue,
  onChangeText,
  onFocus,
  onBlur,
  editable = true,
  readOnly,
  placeholder,
  style,
  accessibilityLabel = label,
  accessibilityHint = description,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = !!(value || defaultValue)?.length;

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
        hasValue,
        isRequired,
      }}
      isFocused={isFocused && !disabled}
    >
      {({ textStyles, viewStyles }) => (
        <TextInput
          placeholderTextColor={styles.placeholder.color}
          underlineColorAndroid={styles.input.backgroundColor}
          {...props}
          value={value}
          defaultValue={defaultValue}
          editable={!disabled && editable}
          readOnly={readOnly}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ ...props.accessibilityState, disabled }}
          placeholder={!label || isFocused ? placeholder : undefined}
          onChangeText={onChangeText}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          style={[viewStyles, textStyles, styles.input, style]}
        />
      )}
    </InputBase>
  );
}

const styles = StyleSheet.create((theme) => ({
  placeholder: { color: theme.colors.textMuted },
  input: {
    backgroundColor: theme.colors.transparent,
  },
}));
