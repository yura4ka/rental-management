import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Routes } from "@/app/navigation/routes";
import type { AuthenticatedStackScreenProps } from "@/app/navigation/types";
import type { OperationListItem } from "@/features/operations/types";
import { PendingOperationsScreen } from "./PendingOperationsScreen";

const mockDismiss = jest.fn();
const mockDismissAsync = jest.fn().mockResolvedValue(undefined);
const mockSync = jest.fn();
const mockQuery = {
  data: [] as OperationListItem[],
  isPending: false,
  isRefetching: false,
  isError: false,
  refetch: jest.fn(),
};
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("@/features/operations/hooks", () => ({
  useOperations: () => mockQuery,
  useProcessOperations: () => ({ mutate: mockSync, isPending: false }),
  useDismissOperation: () => ({
    mutate: mockDismiss,
    mutateAsync: mockDismissAsync,
    isPending: false,
  }),
}));
jest.mock("react-native-unistyles", () => ({ StyleSheet: { create: () => ({}) } }));
jest.mock("@/components/layout", () => ({
  FlatListLayout: jest.requireActual("react-native").FlatList,
}));
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
        onPress={onPress}
        disabled={disabled}
      >
        <Text>{title}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock("@/components/ConfirmationBottomSheet", () => {
  const { Text, TouchableOpacity, View } = jest.requireActual("react-native");
  return {
    ConfirmationBottomSheet: ({
      message,
      onConfirm,
    }: {
      message: string;
      onConfirm: () => void;
    }) => (
      <View>
        <Text>{message}</Text>
        <TouchableOpacity onPress={onConfirm}>
          <Text>Confirm clearing</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

function operation(state: OperationListItem["state"], overrides: Partial<OperationListItem> = {}) {
  return {
    id: state,
    command: "SubmitApplication",
    resourceType: "Application",
    resourceId: "application",
    state,
    firstDispatchedAt: null,
    ...overrides,
  } as OperationListItem;
}
const navigate = jest.fn();
const props = {
  navigation: { navigate },
} as unknown as AuthenticatedStackScreenProps<Routes.PendingOperations>;

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.data = [];
  mockQuery.isError = false;
  mockQuery.isPending = false;
});

it("lists every retained lifecycle status, hides dismissed entries, and syncs on request", async () => {
  mockQuery.data = [
    operation("Queued"),
    operation("Dispatched"),
    operation("Accepted"),
    operation("Rejected"),
    operation("Cancelled"),
    operation("Accepted", { id: "hidden", command: "HiddenOperation", dismissedAt: "2026-01-01" }),
  ];
  await render(<PendingOperationsScreen {...props} />);
  for (const label of [
    "Queued (Queued)",
    "Dispatched — awaiting confirmation (Dispatched)",
    "Success (Accepted)",
    "Failed (Rejected)",
    "Cancelled (Cancelled)",
  ]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  expect(screen.queryByText("Hidden Operation")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Sync pending operations" }));
  expect(mockSync).toHaveBeenCalled();
});

it("opens a failed item's destination and confirms clearing while preserving input", async () => {
  mockQuery.data = [operation("Rejected", { errorMessage: "Stale version" })];
  await render(<PendingOperationsScreen {...props} />);
  expect(screen.getByText("Stale version")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Open related item" }));
  expect(navigate).toHaveBeenCalledWith(Routes.ApplicationDetails, {
    applicationId: "application",
  });
  await fireEvent.press(screen.getByRole("button", { name: "Clear failed operation" }));
  expect(mockDismissAsync).not.toHaveBeenCalled();
  expect(screen.getByText(/Local form input is preserved/)).toBeTruthy();
  await fireEvent.press(screen.getByText("Confirm clearing"));
  await waitFor(() => expect(mockDismissAsync).toHaveBeenCalledWith("Rejected"));
});

it("discards accepted results from the list without cancelling them", async () => {
  mockQuery.data = [operation("Accepted")];
  await render(<PendingOperationsScreen {...props} />);
  await fireEvent.press(screen.getByRole("button", { name: "Discard from list" }));
  expect(mockDismiss).toHaveBeenCalledWith("Accepted");
  expect(screen.queryByRole("button", { name: "Cancel operation" })).toBeNull();
});

it("does not offer cancellation for uncertain requests and identifies blocked queued work", async () => {
  mockQuery.data = [
    operation("Dispatched", { errorMessage: "Connection lost", resourceType: "Unknown" }),
    operation("Queued", { firstDispatchedAt: "2026-01-01", blockedByOperationId: "predecessor" }),
  ];
  await render(<PendingOperationsScreen {...props} />);
  expect(screen.queryByRole("button", { name: "Cancel operation" })).toBeNull();
  expect(screen.getByText(/cannot be cancelled. Sync to reconcile/)).toBeTruthy();
  expect(screen.getByText("Blocked by operation predecessor.")).toBeTruthy();
});

it("shows an empty state and load errors distinctly", async () => {
  const view = await render(<PendingOperationsScreen {...props} />);
  expect(screen.getByText("No pending operations or retained results.")).toBeTruthy();
  mockQuery.isError = true;
  await view.rerender(<PendingOperationsScreen {...props} />);
  expect(screen.getByText("Could not load operations.")).toBeTruthy();
  expect(screen.queryByText("No pending operations or retained results.")).toBeNull();
});
