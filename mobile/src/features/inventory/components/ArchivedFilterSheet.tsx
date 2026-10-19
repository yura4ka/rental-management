import { useEffect, useRef, useState } from "react";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { BottomSheet } from "@/components/BottomSheet";
import { Button, CheckBox } from "@/components/ui";

export function ArchivedFilterSheet({
  includeArchived,
  onApply,
  onClose,
}: {
  includeArchived: boolean;
  onApply: (value: boolean) => void;
  onClose: () => void;
}) {
  const sheet = useRef<TrueSheet>(null);
  const [checked, setChecked] = useState(includeArchived);
  useEffect(() => {
    void sheet.current?.present();
  }, []);

  return (
    <BottomSheet.Root ref={sheet}>
      <BottomSheet.Content onDidDismiss={onClose}>
        <BottomSheet.Header title="Filters" />
        <BottomSheet.Body>
          <CheckBox title="Show archived" checked={checked} onCheckedChange={setChecked} />
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <Button title="Reset" variant="textPrimary" onPress={() => setChecked(false)} />
          <Button
            title="Apply"
            onPress={() => {
              onApply(checked);
              void sheet.current?.dismiss();
            }}
          />
        </BottomSheet.Footer>
      </BottomSheet.Content>
    </BottomSheet.Root>
  );
}
