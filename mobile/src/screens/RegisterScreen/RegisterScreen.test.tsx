import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { HTTPError } from "@/services/api";
import { Routes } from "@/app/navigation/routes";
import type { UnauthenticatedStackScreenProps } from "@/app/navigation/types";
import { RegisterScreen } from "./RegisterScreen";

const mockRegister = jest.fn();
const mockLogin = jest.fn();
const mockErrorToast = jest.fn();
const mockSuccessToast = jest.fn();

jest.mock("@/features/auth/hooks", () => ({
  useRegister: () => ({ mutateAsync: mockRegister, isPending: false }),
  useLogin: () => ({ mutateAsync: mockLogin, isPending: false }),
}));
jest.mock("@/app/toast", () => ({
  toast: {
    error: (message: string) => mockErrorToast(message),
    success: (message: string) => mockSuccessToast(message),
  },
}));
jest.mock("react-native-unistyles", () => ({
  StyleSheet: { create: () => ({ useVariants: jest.fn() }) },
}));
jest.mock("@/components/layout", () => ({
  AuthCard: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/components/ui/Input", () => {
  const { TextInput, Text, View } = jest.requireActual("react-native");
  return {
    Input: ({ label, description, ...props }: { label: string; description?: string }) => (
      <View>
        <TextInput accessibilityLabel={label} {...props} />
        <Text>{description}</Text>
      </View>
    ),
  };
});
jest.mock("@/components/ui/Button/Button", () => {
  const { TouchableOpacity, Text } = jest.requireActual("react-native");
  return {
    Button: ({
      title,
      disabled,
      onPress,
    }: {
      title: string;
      disabled?: boolean;
      onPress: () => void;
    }) => (
      <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress}>
        <Text>{title}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock("@/components/ui", () => {
  const { Text } = jest.requireActual("react-native");
  const { Button } = jest.requireMock("@/components/ui/Button/Button");
  return {
    Text,
    Button,
    Chip: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <Button title={title} onPress={onPress} />
    ),
  };
});

async function fillForm() {
  await render(
    <RegisterScreen
      {...({
        navigation: { navigate: jest.fn() },
      } as unknown as UnauthenticatedStackScreenProps<Routes.Register>)}
    />,
  );
  await fireEvent.changeText(screen.getByLabelText("Email"), "person@example.com");
  await fireEvent.changeText(screen.getByLabelText("Password"), "safe password");
}

describe("registration flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockResolvedValue({ id: "account-id" });
    mockLogin.mockResolvedValue("authenticated");
  });

  it("registers the selected role and then logs in directly", async () => {
    await fillForm();
    await fireEvent.press(screen.getByText("Property Manager"));
    await fireEvent.press(screen.getByText("Register"));
    await waitFor(() =>
      expect(mockLogin).toHaveBeenCalledWith({
        email: "person@example.com",
        password: "safe password",
      }),
    );
    expect(mockRegister).toHaveBeenCalledWith({
      email: "person@example.com",
      password: "safe password",
      role: "PropertyManager",
    });
    expect(mockRegister.mock.invocationCallOrder[0]).toBeLessThan(
      mockLogin.mock.invocationCallOrder[0],
    );
    expect(mockSuccessToast).toHaveBeenCalled();
  });

  it("retries login without creating the account again", async () => {
    mockLogin.mockRejectedValueOnce(new Error("Offline"));
    await fillForm();
    await fireEvent.press(screen.getByText("Register"));
    await waitFor(() => expect(mockErrorToast).toHaveBeenCalledWith("Unknown error"));
    await fireEvent.press(screen.getByText("Retry login"));
    await waitFor(() => expect(mockLogin).toHaveBeenCalledTimes(2));
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it("shows server field errors and allows correction before resubmission", async () => {
    mockRegister.mockRejectedValueOnce(
      new HTTPError(
        422,
        {
          code: "ValidationFailed",
          title: "Validation failed.",
          validation: { fields: { email: "Email already registered" } },
        },
        { statusText: "" } as Response,
      ),
    );
    await fillForm();
    await fireEvent.press(screen.getByText("Register"));
    await waitFor(() => expect(screen.getByText("Email already registered")).toBeTruthy());
    expect(mockLogin).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText("Email"), "another@example.com");
    await fireEvent.press(screen.getByText("Register"));
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(2));
    expect(mockErrorToast).toHaveBeenCalledWith("Validation failed.");
  });
});
