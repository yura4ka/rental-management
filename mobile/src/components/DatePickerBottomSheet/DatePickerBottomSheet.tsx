import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { View } from "react-native";
import DatePicker from "react-native-date-picker";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { BottomSheet } from "@/components/BottomSheet";
import { Button } from "@/components/ui";
import { getTodayCalendarDate, toCalendarDate } from "@/shared/utils/calendarDate";

type DatePickerRequest = {
  title: string;
  value: string;
  maximumDate?: string;
  onConfirm: (value: string) => void;
};

export type DatePickerBottomSheetRef = {
  open: (request: DatePickerRequest) => void;
};

/** Mount once inside the parent sheet and reuse it for every date field. */
export function DatePickerBottomSheet({ ref }: { ref: Ref<DatePickerBottomSheetRef> }) {
  const sheet = useRef<TrueSheet>(null);
  const [request, setRequest] = useState<DatePickerRequest | null>(null);
  const [date, setDate] = useState(() => new Date(getTodayCalendarDate()));
  const [spinning, setSpinning] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      open: (next) => {
        const maximum = next.maximumDate ?? getTodayCalendarDate();
        setDate(new Date(next.value && next.value <= maximum ? next.value : maximum));
        setSpinning(false);
        setRequest(next);
      },
    }),
    [],
  );

  useEffect(() => {
    if (request) void sheet.current?.present();
  }, [request]);

  return (
    <BottomSheet.Root ref={sheet}>
      <BottomSheet.Content onDidDismiss={() => setRequest(null)}>
        <BottomSheet.Header title={request?.title ?? "Select date"} />
        <BottomSheet.Body>
          <View style={{ alignItems: "center" }}>
            <DatePicker
              date={date}
              mode="date"
              timeZoneOffsetInMinutes={0}
              maximumDate={new Date(request?.maximumDate ?? getTodayCalendarDate())}
              onDateChange={setDate}
              onStateChange={(state) => setSpinning(state === "spinning")}
            />
          </View>
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <Button title="Cancel" variant="text" onPress={() => void sheet.current?.dismiss()} />
          <Button
            title="Confirm date"
            disabled={spinning || !request}
            onPress={() => {
              request?.onConfirm(toCalendarDate(date));
              void sheet.current?.dismiss();
            }}
          />
        </BottomSheet.Footer>
      </BottomSheet.Content>
    </BottomSheet.Root>
  );
}
