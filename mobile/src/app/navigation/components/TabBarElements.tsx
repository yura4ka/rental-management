import React from "react";
import { Text } from "@/components/ui";
import { IconName } from "@/app/assets/icons";
import { Icon } from "@/components";

type IconProps = {
  color: string;
  size: number;
};

const TabIcon = ({ name, color, size }: IconProps & { name: IconName }) => {
  return <Icon name={name} color={color} size={size} />;
};

const HomeIcon = (props: IconProps) => <TabIcon {...props} name={"TIconHomeOutline"} />;

type LabelProps = {
  focused: boolean;
  color: string;
  children?: React.ReactNode;
};

const TabLabel = ({ focused, children }: LabelProps) => {
  return (
    <Text
      variant="label"
      fontFamily={focused ? "semibold" : "medium"}
      color={focused ? "primary" : "textSecondary"}
      numberOfLines={1}
      adjustsFontSizeToFit={true}
    >
      {children}
    </Text>
  );
};

export const TabBarElements = {
  HomeIcon,
  TabLabel,
};
