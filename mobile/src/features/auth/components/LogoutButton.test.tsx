import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { LogoutButton } from "./LogoutButton";

const mockSignOut = jest.fn().mockResolvedValue(undefined);
jest.mock("@/services/session", () => ({
  useSession: () => ({ signOut: mockSignOut }),
  useSessionState: () => false,
}));
jest.mock("react-native-unistyles", () => ({ StyleSheet: { create: () => ({}) } }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/ConfirmationBottomSheet", () => {
  const { Text, TouchableOpacity, View } = jest.requireActual("react-native");
  return {
    ConfirmationBottomSheet: ({
      message,
      onConfirm,
      onClose,
    }: {
      message: string;
      onConfirm: () => void;
      onClose: () => void;
    }) => (
      <View>
        <Text>{message}</Text>
        <TouchableOpacity onPress={onConfirm}>
          <Text>Confirm logout</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose}>
          <Text>Cancel</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

beforeEach(() => jest.clearAllMocks());

it("warns about all local work and only signs out after explicit confirmation", async () => {
  await render(<LogoutButton />);
  await fireEvent.press(screen.getByRole("button", { name: "Logout" }));
  expect(screen.getByText(/pending operations, and local edits/)).toBeTruthy();
  expect(screen.getByText(/does not revoke your server session/)).toBeTruthy();
  expect(mockSignOut).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Confirm logout"));
  await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1));
});

it("cancels the confirmation without signing out", async () => {
  await render(<LogoutButton />);
  await fireEvent.press(screen.getByRole("button", { name: "Logout" }));
  await fireEvent.press(screen.getByText("Cancel"));
  expect(screen.queryByText("Confirm logout")).toBeNull();
  expect(mockSignOut).not.toHaveBeenCalled();
});
