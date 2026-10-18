import { Body } from "./Body";
import { Content } from "./Content";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { Root } from "./Root";

export const BottomSheet = { Root, Content, Header, Body, Footer };

export { useRootContext } from "./context";
export type { BottomSheetRootProps } from "./Root";
export type { BottomSheetContentProps } from "./Content";
export type { BottomSheetHeaderProps } from "./Header";
export type { BottomSheetBodyProps } from "./Body";
export type { BottomSheetFooterProps } from "./Footer";
