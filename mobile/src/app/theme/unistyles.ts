import { StyleSheet } from "react-native-unistyles";
import { lightTheme } from "./theme";

const appThemes = {
  light: lightTheme,
};

type AppThemes = typeof appThemes;

declare module "react-native-unistyles" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  settings: {
    initialTheme: "light",
  },
  themes: appThemes,
});
