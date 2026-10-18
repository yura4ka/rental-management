import { fireEvent, render, screen } from "@testing-library/react-native";
import { Routes } from "@/app/navigation/routes";
import type { BottomTabsScreenProps } from "@/app/navigation/types";
import { applicationDetail } from "@/features/applications/testing/fixtures";
import { HomeScreen } from "./HomeScreen";

let mockManager = false;
const mockRefetch = jest.fn();
const mockQuery = {
  data: { items: [applicationDetail.application], offline: false, fallback: false },
  isPending: false,
  isError: false,
  isRefetching: false,
  refetch: mockRefetch,
};
jest.mock("@tanstack/react-query", () => ({ useQuery: () => mockQuery }));
jest.mock("@react-navigation/native", () => ({ useIsFocused: () => true }));
jest.mock("@/services/session", () => ({
  useSession: () => ({}),
  useSessionState: (selector: (state: unknown) => unknown) =>
    selector({ account: { role: mockManager ? "PropertyManager" : "Applicant" } }),
}));
jest.mock("@/features/operations/hooks", () => ({ useOperations: () => ({ data: [] }) }));
jest.mock("react-native-unistyles", () => ({ StyleSheet: { create: () => ({}) } }));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/layout", () => {
  const { ScrollView, View } = jest.requireActual("react-native");
  return {
    ScrollViewLayout: ({
      beforeScroll,
      children,
    }: {
      beforeScroll: React.ReactNode;
      children: React.ReactNode;
    }) => (
      <View>
        {beforeScroll}
        <ScrollView>{children}</ScrollView>
      </View>
    ),
  };
});
jest.mock("@/features/auth/components/LogoutButton", () => {
  const { Text } = jest.requireActual("react-native");
  return { LogoutButton: () => <Text>Logout</Text> };
});
jest.mock("@/features/applications/components/ApplicationCard", () => {
  const { Text, TouchableOpacity } = jest.requireActual("react-native");
  return {
    ApplicationCard: ({ item, onPress }: { item: { id: string }; onPress: () => void }) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{item.id}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock("@/components/ui", () => {
  const { Text, TouchableOpacity } = jest.requireActual("react-native");
  return {
    Text,
    Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{title}</Text>
      </TouchableOpacity>
    ),
  };
});

const navigate = jest.fn();
const props = { navigation: { navigate } } as unknown as BottomTabsScreenProps<Routes.Home>;

beforeEach(() => {
  jest.clearAllMocks();
  mockManager = false;
  mockQuery.data = { items: [applicationDetail.application], offline: false, fallback: false };
  mockQuery.isPending = false;
  mockQuery.isError = false;
});

it("shows applicant actions and opens Profile, pending operations, and application details", async () => {
  await render(<HomeScreen {...props} />);
  expect(screen.getByText("Rental")).toBeTruthy();
  expect(screen.queryByText("Logout")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Profile" }));
  expect(navigate).toHaveBeenLastCalledWith(Routes.Profile);
  await fireEvent.press(screen.getByRole("button", { name: "Pending operations" }));
  expect(navigate).toHaveBeenLastCalledWith(Routes.PendingOperations);
  await fireEvent.press(screen.getByText(applicationDetail.application.id));
  expect(navigate).toHaveBeenLastCalledWith(Routes.ApplicationDetails, {
    applicationId: applicationDetail.application.id,
  });
});

it("shows manager actions and a role-specific empty message", async () => {
  mockManager = true;
  mockQuery.data.items = [];
  await render(<HomeScreen {...props} />);
  expect(screen.getByText("Logout")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Profile" })).toBeNull();
  expect(screen.getByRole("button", { name: "Pending actions" })).toBeTruthy();
  expect(screen.getByText("No applications for your properties yet.")).toBeTruthy();
});

it("shows applicant and offline empty states without presenting a failed read as empty", async () => {
  mockQuery.data.items = [];
  const view = await render(<HomeScreen {...props} />);
  expect(screen.getByText("You have no applications yet.")).toBeTruthy();
  mockQuery.data.offline = true;
  await view.rerender(<HomeScreen {...props} />);
  expect(screen.getByText("No matching downloaded applications.")).toBeTruthy();
  mockQuery.isError = true;
  await view.rerender(<HomeScreen {...props} />);
  await fireEvent.press(screen.getByText("Retry"));
  expect(mockRefetch).toHaveBeenCalled();
});

it("shows loading feedback", async () => {
  mockQuery.isPending = true;
  await render(<HomeScreen {...props} />);
  expect(screen.getByLabelText("Loading recent applications")).toBeTruthy();
});
