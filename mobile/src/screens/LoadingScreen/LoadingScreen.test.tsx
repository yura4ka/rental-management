import { render, waitFor } from "@testing-library/react-native";
import { Routes } from "@/app/navigation/routes";
import type { AuthenticatedStackScreenProps } from "@/app/navigation/types";
import { LoadingScreen } from "./LoadingScreen";

const mockProcess = jest.fn();
const mockError = jest.fn();
jest.mock("@/features/operations/hooks", () => ({
  useProcessOperations: () => ({ mutateAsync: mockProcess }),
}));
jest.mock("sonner-native", () => ({
  toast: { error: (...args: unknown[]) => mockError(...args) },
}));
jest.mock("react-native-unistyles", () => ({ StyleSheet: { create: () => ({}) } }));
jest.mock("@/components", () => ({ StyledActivityIndicator: () => null }));

it("starts processing without waiting for the queue before navigating Home", async () => {
  mockProcess.mockReturnValue(new Promise(() => {}));
  const replace = jest.fn();
  await render(
    <LoadingScreen
      {...({ navigation: { replace } } as unknown as AuthenticatedStackScreenProps<Routes.Loading>)}
    />,
  );
  expect(mockProcess).toHaveBeenCalled();
  expect(replace).toHaveBeenCalledWith(Routes.BottomTabs, { screen: Routes.Home });
});

it("handles startup processing failure even after the loading screen unmounts", async () => {
  let reject: (error: Error) => void = () => {};
  mockProcess.mockReturnValue(
    new Promise((_, fail) => {
      reject = fail;
    }),
  );
  const replace = jest.fn();
  const view = await render(
    <LoadingScreen
      {...({ navigation: { replace } } as unknown as AuthenticatedStackScreenProps<Routes.Loading>)}
    />,
  );
  await view.unmount();
  reject(new Error("disk failure"));
  await waitFor(() =>
    expect(mockError).toHaveBeenCalledWith(
      expect.stringContaining("Could not sync pending operations"),
    ),
  );
});
