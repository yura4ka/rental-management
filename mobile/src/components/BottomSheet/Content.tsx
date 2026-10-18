import { Children, Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { useWindowDimensions } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { TrueSheet, type TrueSheetProps } from "@lodev09/react-native-true-sheet";
import { useRootContext } from "./context";
import { Footer } from "./Footer";
import { Header } from "./Header";

export type BottomSheetContentProps = Omit<TrueSheetProps, "header" | "footer">;

const MAX_HEIGHT_RATIO = 0.9;

function extractContent(children: ReactNode) {
  const headers: ReactElement[] = [];
  const footers: ReactElement[] = [];

  // Children.map handles arrays and conditional children; recurse into fragments too.
  const mapChildren = (nodes: ReactNode): ReactNode =>
    Children.map(nodes, (child) => {
      if (!isValidElement<{ children?: ReactNode }>(child)) return child;
      if (child.type === Fragment) return mapChildren(child.props.children);

      if (child.type === Header) {
        headers.push(child);
        return null;
      }

      if (child.type === Footer) {
        footers.push(child);
        return null;
      }

      return child;
    });

  const content = mapChildren(children);

  if (headers.length > 1 || footers.length > 1) {
    throw new Error("BottomSheet.Content accepts only one Header and one Footer.");
  }

  return { content, header: headers[0], footer: footers[0] };
}

export function Content({
  children,
  detents,
  scrollable = false,
  maxContentHeight,
  ...props
}: BottomSheetContentProps) {
  const { ref } = useRootContext();
  const { height } = useWindowDimensions();
  const { theme } = useUnistyles();
  const { content, header, footer } = extractContent(children);
  const sheetDetents = detents ?? (scrollable ? [MAX_HEIGHT_RATIO] : ["auto"]);

  if (scrollable && sheetDetents.includes("auto")) {
    throw new Error("TrueSheet v3 does not support 'auto' detents with scrollable content.");
  }

  return (
    <TrueSheet
      backgroundColor={theme.colors.surface}
      cornerRadius={theme.radius.card}
      {...props}
      ref={ref}
      scrollable={scrollable}
      detents={sheetDetents.map((detent) =>
        typeof detent === "number" ? Math.min(detent, MAX_HEIGHT_RATIO) : detent,
      )}
      maxContentHeight={Math.min(
        maxContentHeight ?? height * MAX_HEIGHT_RATIO,
        height * MAX_HEIGHT_RATIO,
      )}
      header={header}
      footer={footer}
    >
      {content}
    </TrueSheet>
  );
}
