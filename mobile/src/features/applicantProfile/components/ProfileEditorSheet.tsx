import { useEffect, type ReactNode, type RefObject } from "react";
import { ScrollView } from "react-native";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { BottomSheet } from "@/components/BottomSheet";

type Props = {
  sheetRef: RefObject<TrueSheet | null>;
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
};

export function ProfileEditorSheet({ sheetRef, title, busy, onClose, children, footer }: Props) {
  useEffect(() => {
    void sheetRef.current?.present();
  }, [sheetRef]);

  return (
    <BottomSheet.Root ref={sheetRef}>
      <BottomSheet.Content scrollable dismissible={!busy} draggable={!busy} onDidDismiss={onClose}>
        <BottomSheet.Header title={title} noCloseButton={busy} border={true} />
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <BottomSheet.Body>{children}</BottomSheet.Body>
        </ScrollView>
        <BottomSheet.Footer>{footer}</BottomSheet.Footer>
      </BottomSheet.Content>
    </BottomSheet.Root>
  );
}
