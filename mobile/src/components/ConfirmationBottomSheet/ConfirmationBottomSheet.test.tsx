import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ConfirmationBottomSheet } from "./ConfirmationBottomSheet";

const mockDismiss = jest.fn().mockResolvedValue(undefined);
jest.mock("sonner-native", () => ({ toast: { success: jest.fn() } }));
jest.mock("@lodev09/react-native-true-sheet", () => ({ TrueSheet: () => null }));
jest.mock("@/components/BottomSheet", () => {
  const React = jest.requireActual("react");
  const { View, Text } = jest.requireActual("react-native");
  return {
    BottomSheet: {
      Root: ({ ref, children }: { ref: React.Ref<unknown>; children: React.ReactNode }) => {
        React.useImperativeHandle(ref, () => ({ present: async () => {}, dismiss: mockDismiss }));
        return <View>{children}</View>;
      },
      Content: View,
      Body: View,
      Footer: View,
      Header: ({ title }: { title: string }) => <Text>{title}</Text>,
    },
  };
});
jest.mock("@/components/ui", () => {
  const { Text, TouchableOpacity } = jest.requireActual("react-native");
  return {
    Text,
    Button: ({
      title,
      onPress,
      disabled,
    }: {
      title: string;
      onPress: () => void;
      disabled?: boolean;
    }) => (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{title}</Text>
      </TouchableOpacity>
    ),
  };
});

beforeEach(() => jest.clearAllMocks());

it("only dismisses after a server-accepted archive", async () => {
  const onConfirm = jest
    .fn()
    .mockResolvedValue({ status: "Accepted", operationId: "operation", data: {} });
  await render(
    <ConfirmationBottomSheet
      title="Archive property?"
      message="Are you sure?"
      onConfirm={onConfirm}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Archive" }));
  await waitFor(() => expect(mockDismiss).toHaveBeenCalledTimes(1));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

it("keeps pending work unconfirmed and prevents duplicate archive submission", async () => {
  const onConfirm = jest.fn().mockResolvedValue({ status: "Pending", operationId: "operation" });
  await render(
    <ConfirmationBottomSheet
      title="Archive property?"
      message="Are you sure?"
      onConfirm={onConfirm}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Archive" }));
  await waitFor(() => expect(screen.getByText(/Pending sync/)).toBeTruthy());
  expect(mockDismiss).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

it("keeps the sheet open and allows retry after a rejected action", async () => {
  const onConfirm = jest.fn().mockRejectedValue(new Error("failure"));
  await render(
    <ConfirmationBottomSheet
      title="Archive unit?"
      message="Are you sure?"
      onConfirm={onConfirm}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Archive" }));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(mockDismiss).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Archive" }));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(2));
});
