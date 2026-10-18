import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { HTTPError } from "@/services/api";
import { ProfileScreen } from "./ProfileScreen";

const mockUpdateInformation = jest.fn();
const mockUpdateResidences = jest.fn();
const mockError = jest.fn();
const mockProfile = {
  version: "9007199254740993",
  applicantInformation: {
    name: "Jane",
    phone: null,
    contactEmail: "contact@example.com",
    currentAddress: { displayName: "Home", streetAddress: "12 Main St", line2: null },
  },
  residenceHistory: [
    {
      position: 0,
      address: { displayName: "Old home", streetAddress: "1 First St", line2: null },
      landlordName: "Owner",
      landlordPhone: "123-456-7890",
      moveInDate: "2020-01-01T00:00:00Z",
      moveOutDate: "2021-01-01T00:00:00Z",
    },
  ],
};

jest.mock("@/features/applicantProfile/hooks", () => ({
  useApplicantProfile: () => ({ data: mockProfile, isPending: false, isError: false }),
  useUpdateApplicantInformation: () => ({ mutateAsync: mockUpdateInformation, isPending: false }),
  useUpdateResidenceHistory: () => ({ mutateAsync: mockUpdateResidences, isPending: false }),
}));
jest.mock("@/features/auth/hooks", () => ({
  useGetAccount: () => ({ data: { email: "login@example.com" } }),
}));
jest.mock("@/app/toast", () => ({
  toast: { success: jest.fn(), error: (value: string) => mockError(value) },
}));
jest.mock("react-native-unistyles", () => ({
  StyleSheet: { create: () => ({ useVariants: jest.fn() }) },
  useUnistyles: () => ({ theme: { colors: { surface: "white" }, radius: { card: 16 } } }),
}));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
jest.mock("@/components/ui/Input", () => {
  const { TextInput, Text, View, TouchableOpacity } = jest.requireActual("react-native");
  return {
    Input: ({ label, description, ...props }: { label: string; description?: string }) => (
      <View>
        <TextInput accessibilityLabel={label} {...props} />
        <Text>{description}</Text>
      </View>
    ),
    InputPressable: ({
      label,
      value,
      description,
      ...props
    }: {
      label: string;
      value: string;
      description?: string;
    }) => (
      <View>
        <TouchableOpacity accessibilityLabel={label} {...props}>
          <Text>{value}</Text>
        </TouchableOpacity>
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
      accessibilityLabel,
    }: {
      title: string;
      disabled?: boolean;
      onPress: () => void;
      accessibilityLabel?: string;
    }) => (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        disabled={disabled}
        onPress={onPress}
      >
        <Text>{title}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock("@/components/ui", () => ({
  Text: jest.requireActual("react-native").Text,
  Button: jest.requireMock("@/components/ui/Button/Button").Button,
}));
jest.mock("@lodev09/react-native-true-sheet", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    TrueSheet: ({
      ref,
      children,
      header,
      footer,
      onDidDismiss,
    }: {
      ref: React.Ref<unknown>;
      children: React.ReactNode;
      header: React.ReactNode;
      footer: React.ReactNode;
      onDidDismiss?: () => void;
    }) => {
      React.useImperativeHandle(ref, () => ({
        present: async () => {},
        dismiss: async () => {
          onDidDismiss?.();
        },
      }));
      return (
        <View>
          {header}
          {children}
          {footer}
        </View>
      );
    },
  };
});
jest.mock("react-native-date-picker", () => {
  const { TouchableOpacity, Text, View } = jest.requireActual("react-native");
  return function MockDatePicker({ onDateChange }: { onDateChange: (value: Date) => void }) {
    return (
      <View testID="native-date-picker">
        <TouchableOpacity
          accessibilityLabel="Select test date"
          onPress={() => onDateChange(new Date("2020-06-15T00:00:00Z"))}
        >
          <Text>Select test date</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Select later test date"
          onPress={() => onDateChange(new Date("2021-08-20T00:00:00Z"))}
        >
          <Text>Select later test date</Text>
        </TouchableOpacity>
      </View>
    );
  };
});

describe("ProfileScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateInformation.mockResolvedValue({ status: "Accepted" });
    mockUpdateResidences.mockResolvedValue({ status: "Accepted" });
  });

  it("shows profile values and formatted past residences", async () => {
    await render(<ProfileScreen />);
    expect(screen.getByText("login@example.com")).toBeTruthy();
    expect(screen.getByText("contact@example.com")).toBeTruthy();
    expect(screen.getByText("Home, 12 Main St")).toBeTruthy();
    expect(screen.getByText("Old home, 1 First St")).toBeTruthy();
    expect(screen.queryByTestId("native-date-picker")).toBeNull();
  });

  it("saves profile edits with the original exact version and nullable blanks", async () => {
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Edit profile"));
    await fireEvent.changeText(screen.getByLabelText("Name"), "  Updated  ");
    await fireEvent.changeText(screen.getByLabelText("Contact email"), "");
    await fireEvent.press(screen.getByLabelText("Save profile"));
    await waitFor(() =>
      expect(mockUpdateInformation).toHaveBeenCalledWith({
        input: {
          expectedVersion: mockProfile.version,
          applicantInformation: {
            ...mockProfile.applicantInformation,
            name: "Updated",
            contactEmail: null,
          },
        },
      }),
    );
  });

  it("keeps rejected profile input and shows the server field error", async () => {
    const body = {
      code: "ValidationFailed",
      title: "Invalid profile",
      validation: { fields: { "applicantInformation.name": "Name is not allowed." } },
    };
    mockUpdateInformation.mockRejectedValue(
      new HTTPError(422, body, new Response(JSON.stringify(body), { status: 422 })),
    );
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Edit profile"));
    await fireEvent.changeText(screen.getByLabelText("Name"), "Rejected name");
    await fireEvent.press(screen.getByLabelText("Save profile"));
    await waitFor(() => expect(screen.getByText("Name is not allowed.")).toBeTruthy());
    expect(screen.getByLabelText("Name").props.value).toBe("Rejected name");
  });

  it("labels pending saves without changing accepted profile values", async () => {
    mockUpdateInformation.mockResolvedValue({ status: "Pending", operationId: "operation" });
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Edit profile"));
    await fireEvent.changeText(screen.getByLabelText("Name"), "Pending name");
    await fireEvent.press(screen.getByLabelText("Save profile"));
    await waitFor(() => expect(screen.getByText(/Pending sync/)).toBeTruthy());
    expect(screen.getByText("Jane")).toBeTruthy();
    expect(screen.queryByLabelText("Save profile")).toBeNull();
  });

  it("can delete every residence and save an empty list", async () => {
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Edit past residences"));
    await fireEvent.press(screen.getByLabelText("Delete residence 1"));
    await fireEvent.press(screen.getByLabelText("Save residences"));
    await waitFor(() =>
      expect(mockUpdateResidences).toHaveBeenCalledWith({
        input: {
          expectedVersion: mockProfile.version,
          residenceHistory: [],
        },
      }),
    );
  });

  it("reuses one date picker for all dates and cancels without changing a field", async () => {
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Edit past residences"));
    await fireEvent.press(screen.getByLabelText("Move-in date"));
    await fireEvent.press(screen.getByLabelText("Select test date"));
    await fireEvent.press(screen.getByLabelText("Cancel"));
    expect(screen.getByText("2020-01-01")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Move-out date"));
    await fireEvent.press(screen.getByLabelText("Select test date"));
    await fireEvent.press(screen.getByLabelText("Confirm date"));
    expect(screen.getByText("2020-06-15")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Add residence"));
    expect(screen.getAllByTestId("native-date-picker")).toHaveLength(1);
    expect(screen.getAllByLabelText("Move-in date")).toHaveLength(2);
    expect(screen.getAllByLabelText("Move-out date")).toHaveLength(2);
  });

  it("adds a valid residence and preserves its fields when the earlier row is deleted", async () => {
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByLabelText("Edit past residences"));
    await fireEvent.press(screen.getByLabelText("Add residence"));
    await fireEvent.changeText(screen.getAllByLabelText("Address name")[1], "New residence");
    await fireEvent.changeText(
      screen.getAllByLabelText("Street address (required)")[1],
      "22 New St",
    );
    await fireEvent.changeText(screen.getAllByLabelText("Landlord name")[1], "New owner");
    await fireEvent.changeText(screen.getAllByLabelText("Landlord phone")[1], "987-654-3210");
    await fireEvent.press(screen.getAllByLabelText("Move-in date")[1]);
    await fireEvent.press(screen.getByLabelText("Select test date"));
    await fireEvent.press(screen.getByLabelText("Confirm date"));
    await fireEvent.press(screen.getAllByLabelText("Move-out date")[1]);
    await fireEvent.press(screen.getByLabelText("Select later test date"));
    await fireEvent.press(screen.getByLabelText("Confirm date"));
    await fireEvent.press(screen.getByLabelText("Delete residence 1"));
    await fireEvent.press(screen.getByLabelText("Save residences"));
    await waitFor(() =>
      expect(mockUpdateResidences).toHaveBeenCalledWith({
        input: {
          expectedVersion: mockProfile.version,
          residenceHistory: [
            {
              address: { displayName: "New residence", streetAddress: "22 New St", line2: null },
              landlordName: "New owner",
              landlordPhone: "987-654-3210",
              moveInDate: "2020-06-15T00:00:00Z",
              moveOutDate: "2021-08-20T00:00:00Z",
            },
          ],
        },
      }),
    );
  });
});
