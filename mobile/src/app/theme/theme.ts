import type { TextStyle, ViewStyle } from "react-native";

const fontFamily = {
  regular: "Inter-Regular",
  medium: "Inter-Medium",
  semibold: "Inter-SemiBold",
  bold: "Inter-Bold",
} as const;

const fontFamilyVariants = Object.fromEntries(
  Object.entries(fontFamily).map(([key, fontFamily]) => [key, { fontFamily }]),
) as { [Key in keyof typeof fontFamily]: { fontFamily: (typeof fontFamily)[Key] } };

const fontSize = {
  xs: { fontSize: 11, lineHeight: 16 },
  sm: { fontSize: 12, lineHeight: 18 },
  base: { fontSize: 14, lineHeight: 20 },
  lg: { fontSize: 16, lineHeight: 22 },
  xl: { fontSize: 18, lineHeight: 24 },
  "2xl": { fontSize: 22, lineHeight: 28 },
  "3xl": { fontSize: 24, lineHeight: 32 },
} as const satisfies Record<string, TextStyle>;

const typography = {
  screenTitle: {
    fontFamily: fontFamily.semibold,
    ...fontSize["3xl"],
  },
  sectionHeading: {
    fontFamily: fontFamily.semibold,
    ...fontSize.xl,
  },
  cardTitle: {
    fontFamily: fontFamily.semibold,
    ...fontSize.lg,
  },
  body: {
    fontFamily: fontFamily.regular,
    ...fontSize.base,
  },
  label: {
    fontFamily: fontFamily.medium,
    ...fontSize.base,
  },
  button: {
    fontFamily: fontFamily.semibold,
    ...fontSize.base,
  },
  supporting: {
    fontFamily: fontFamily.regular,
    ...fontSize.sm,
  },
  caption: {
    fontFamily: fontFamily.medium,
    ...fontSize.xs,
  },
  badge: {
    fontFamily: fontFamily.semibold,
    ...fontSize.xs,
  },
  featuredRent: {
    fontFamily: fontFamily.semibold,
    ...fontSize["2xl"],
    fontVariant: ["tabular-nums"],
  },
} satisfies Record<string, TextStyle>;

const baseColors = {
  background: "rgba(244, 246, 248, 1)",
  surface: "rgba(255, 255, 255, 1)",
  surfaceSubtle: "rgba(248, 250, 252, 1)",
  surfacePressed: "rgba(241, 245, 249, 1)",
  primary: "rgba(15, 118, 110, 1)",
  primaryPressed: "rgba(17, 94, 89, 1)",
  primarySubtle: "rgba(240, 253, 250, 1)",
  primaryBorder: "rgba(153, 246, 228, 1)",
  secondary: "rgba(51, 65, 85, 1)",
  text: "rgba(15, 23, 42, 1)",
  textSecondary: "rgba(71, 85, 105, 1)",
  textMuted: "rgba(100, 116, 139, 1)",
  textOnPrimary: "rgba(255, 255, 255, 1)",
  textOnDanger: "rgba(255, 255, 255, 1)",
  border: "rgba(226, 232, 240, 1)",
  borderStrong: "rgba(203, 213, 225, 1)",
  inputBorder: "rgba(148, 163, 184, 1)",
  disabledBackground: "rgba(241, 245, 249, 1)",
  disabledText: "rgba(100, 116, 139, 1)",
  scrim: "rgba(15, 23, 42, 0.4)",
  transparent: "rgba(0, 0, 0, 0)",
  shadow: "rgba(15, 23, 42, 1)",
  dangerPressed: "rgba(153, 27, 27, 1)",
};

const semantic = {
  info: {
    foreground: "rgba(29, 78, 216, 1)",
    background: "rgba(239, 246, 255, 1)",
    border: "rgba(191, 219, 254, 1)",
  },
  success: {
    foreground: "rgba(22, 101, 52, 1)",
    background: "rgba(240, 253, 244, 1)",
    border: "rgba(187, 247, 208, 1)",
  },
  warning: {
    foreground: "rgba(146, 64, 14, 1)",
    background: "rgba(255, 251, 235, 1)",
    border: "rgba(253, 230, 138, 1)",
  },
  danger: {
    foreground: "rgba(185, 28, 28, 1)",
    background: "rgba(254, 242, 242, 1)",
    border: "rgba(254, 202, 202, 1)",
  },
  neutral: {
    foreground: "rgba(71, 85, 105, 1)",
    background: "rgba(241, 245, 249, 1)",
    border: "rgba(203, 213, 225, 1)",
  },
  review: {
    foreground: "rgba(109, 40, 217, 1)",
    background: "rgba(245, 243, 255, 1)",
    border: "rgba(221, 214, 254, 1)",
  },
} as const;

export type ColorVariantKey =
  | keyof typeof baseColors
  | {
      [Tone in keyof typeof semantic]: `${Tone}.${Extract<keyof (typeof semantic)[Tone], string>}`;
    }[keyof typeof semantic];

const colorVariants = Object.fromEntries([
  ...Object.entries(baseColors).map(([key, color]) => [key, { color }]),
  ...Object.entries(semantic).flatMap(([tone, colors]) =>
    Object.entries(colors).map(([role, color]) => [`${tone}.${role}`, { color }]),
  ),
]) as Record<ColorVariantKey, { color: string }>;

const colors = {
  ...baseColors,
  semantic,
  applicationStatus: {
    draft: semantic.neutral,
    submitted: semantic.info,
    inReview: semantic.review,
    returned: semantic.warning,
    approved: semantic.success,
    denied: semantic.danger,
    withdrawn: semantic.neutral,
  },
  inventoryStatus: {
    archived: semantic.neutral,
    inactiveType: semantic.neutral,
  },
  syncStatus: {
    onDevice: semantic.neutral,
    pending: semantic.info,
    saved: semantic.neutral,
    waiting: semantic.neutral,
    failed: semantic.danger,
  },
} as const;

export const lightTheme = {
  colors,
  colorVariants,
  fontFamily,
  fontFamilyVariants,
  fontSize,
  typography,
  spacing: {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 40,
    massive: 48,
  },
  radius: {
    badge: 6,
    control: 10,
    card: 16,
    modal: 24,
    pill: 999,
  },
  borderWidth: { default: 1, focused: 2 },
  sizing: {
    touchTarget: 48,
    buttonMinHeight: 48,
    inputMinHeight: 52,
    inputSizes: {
      sm: { minHeight: 48, paddingHorizontal: 12, adornmentPadding: 8 },
      base: { minHeight: 56, paddingHorizontal: 16, adornmentPadding: 12 },
      lg: { minHeight: 64, paddingHorizontal: 20, adornmentPadding: 16 },
    },
    iconSmall: 16,
    icon: 20,
    iconLarge: 24,
  },
  shadows: {
    none: {
      boxShadow: "0px 0px 0px 0px rgba(0, 0, 0, 0)",
    },
    card: {
      boxShadow: "0px 2px 8px 0px rgba(15, 23, 42, 0.05)",
    },
    raised: {
      boxShadow: "0px 4px 12px 0px rgba(15, 23, 42, 0.08)",
    },
    modal: {
      boxShadow: "0px 12px 32px 0px rgba(15, 23, 42, 0.16)",
    },
  } satisfies Record<string, ViewStyle>,
} as const;
