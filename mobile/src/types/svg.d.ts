declare module "*.svg" {
  import type { ForwardRefExoticComponent, RefAttributes } from "react";
  import type Svg from "react-native-svg";
  import type { SvgProps } from "react-native-svg";

  const component: ForwardRefExoticComponent<SvgProps & RefAttributes<Svg>>;
  export default component;
}
