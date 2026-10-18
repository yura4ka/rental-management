import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Routes } from "@/app/navigation/routes";
import type { AuthenticatedStackScreenProps } from "@/app/navigation/types";
import type { ApplicationEditor } from "@/features/applications/applicationEditorRepository";
import { editorDefaults } from "@/features/applications/forms";
import { applicationDetail, information } from "@/features/applications/testing/fixtures";
import { toProfileFormInput } from "@/features/applicantProfile/forms/utils";
import { HTTPError } from "@/services/api";
import { ApplicationFormScreen } from "./ApplicationFormScreen";

let mockInitial: ApplicationEditor;
let mockEditor: ApplicationEditor;
let mockSummary: Record<string, unknown>;
let mockDetail: (typeof applicationDetail & { isOutdated: boolean }) | undefined;
let mockOperations: {
  id: string;
  resourceType: string;
  resourceId: string;
  command: string;
  state: string;
  dismissedAt: null;
}[];
const mockSave = jest.fn();
const mockInformation = jest.fn();
const mockResidences = jest.fn();
const mockSubmit = jest.fn();
const mockCopy = jest.fn();
const mockDispatch = jest.fn();
const mockError = jest.fn();
const mockProfile = { version: "1", applicantInformation: information, residenceHistory: [] };

jest.mock("@/features/applications/hooks", () => ({
  useInitializeApplicationEditor: () => ({ data: mockInitial }),
  useApplicationEditor: () => ({ data: mockEditor, refetch: async () => ({ data: mockEditor }) }),
  useApplication: () => ({ data: mockDetail ? { data: mockDetail } : undefined }),
  useApplicationSummary: () => ({
    data: mockSummary,
    refetch: async () => ({ data: mockSummary }),
  }),
  useApplicationOperations: () => ({ data: mockOperations, refetch: jest.fn() }),
  useContinueApplicantInformation: () => ({ mutateAsync: mockInformation }),
  useContinueResidenceHistory: () => ({ mutateAsync: mockResidences }),
  useSubmitApplication: () => ({ mutateAsync: mockSubmit }),
  useSaveApplicationDraft: () => ({ mutateAsync: mockSave }),
  useCopyProfileSection: () => ({ mutateAsync: mockCopy }),
  useSyncApplications: () => ({ mutate: jest.fn() }),
}));
jest.mock("@/features/applicantProfile/hooks", () => ({
  useApplicantProfile: () => ({ refetch: async () => ({ data: mockProfile }) }),
}));
jest.mock("@/services/network/network", () => ({
  network: { subscribe: () => () => {}, getSnapshot: () => true },
}));
jest.mock("@react-navigation/native", () => ({
  usePreventRemove: jest.fn(),
  StackActions: { replace: (name: string, params: unknown) => ({ type: "REPLACE", name, params }) },
}));
jest.mock("@/app/toast", () => ({
  toast: { success: jest.fn(), error: (value: string) => mockError(value) },
}));
jest.mock("sonner-native", () => ({ toast: jest.fn() }));
jest.mock("react-native-unistyles", () => ({ StyleSheet: { create: () => ({}) } }));
jest.mock("react-native-keyboard-controller", () => ({
  KeyboardAwareScrollView: jest.requireActual("react-native").ScrollView,
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
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
    InputPressable: () => null,
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
jest.mock("@/components/LabelValue", () => {
  const { Text } = jest.requireActual("react-native");
  return {
    LabelValue: ({ items }: { items: { label: string; value: string | null }[] }) => (
      <>
        {items.map((item) => (
          <Text key={item.label}>{item.value}</Text>
        ))}
      </>
    ),
  };
});
jest.mock("@/components/DatePickerBottomSheet", () => ({ DatePickerBottomSheet: () => null }));
jest.mock("@/components/ConfirmationBottomSheet", () => {
  const { Button } = jest.requireMock("@/components/ui/Button/Button");
  return {
    ConfirmationBottomSheet: ({
      onConfirm,
      onClose,
    }: {
      onConfirm: () => Promise<void>;
      onClose: () => void;
    }) => (
      <>
        <Button
          title="Confirm copy"
          onPress={async () => {
            await onConfirm();
            onClose();
          }}
        />
        <Button title="Cancel copy" onPress={onClose} />
      </>
    ),
  };
});

function props(): AuthenticatedStackScreenProps<Routes.ApplicationForm> {
  return {
    route: { key: "form", name: Routes.ApplicationForm, params: { unitId: "unit" } },
    navigation: { dispatch: mockDispatch },
  } as unknown as AuthenticatedStackScreenProps<Routes.ApplicationForm>;
}

describe("ApplicationFormScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOperations = [];
    mockDetail = undefined;
    mockInitial = {
      formId: "form",
      applicationId: "application",
      applicantId: "applicant",
      unitId: "unit",
      lifecycle: "LocalOnly",
      currentStep: "ApplicantInformation",
      baseVersion: "9007199254740993",
      input: editorDefaults(information),
    };
    mockEditor = { ...mockInitial };
    mockSummary = {
      snapshots: {},
      hasUnfinishedEdits: false,
      sectionsAccepted: false,
      applicantInformation: null,
      residenceHistory: null,
    };
    mockSave.mockImplementation(async ({ input, step }) => {
      mockEditor = { ...mockEditor, input, currentStep: step ?? mockEditor.currentStep };
    });
    mockInformation.mockImplementation(async () => {
      mockEditor = { ...mockEditor, currentStep: "ResidenceHistory" };
      return { status: "Accepted" };
    });
    mockResidences.mockImplementation(async () => {
      mockEditor = { ...mockEditor, currentStep: "Summary" };
      return { status: "Accepted" };
    });
    mockSubmit.mockResolvedValue({ status: "Accepted" });
    mockCopy.mockImplementation(async ([, section]) => {
      mockEditor = {
        ...mockEditor,
        input: {
          ...mockEditor.input,
          ...(section === "ApplicantInformation"
            ? { applicantInformation: toProfileFormInput(information) }
            : { residenceHistory: [] }),
        },
      };
    });
  });

  it("renders only the current section and creates nothing while typing", async () => {
    mockInitial.input = editorDefaults(undefined, [], "login@example.com");
    await render(<ApplicationFormScreen {...props()} />);
    expect(screen.getByLabelText("Contact email").props.value).toBe("login@example.com");
    expect(screen.queryByText("Add residence")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Name"), "Unfinished");
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockInformation).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Continue"));
    expect(mockInformation).not.toHaveBeenCalled();
  });

  it("saves input before Continue, advances, and explicitly saves empty residence history", async () => {
    await render(<ApplicationFormScreen {...props()} />);
    await fireEvent.changeText(screen.getByLabelText("Name"), "Changed");
    await fireEvent.press(screen.getByLabelText("Continue"));
    await waitFor(() => expect(screen.getByText("Residence history")).toBeTruthy());
    expect(mockEditor.input.applicantInformation.name).toBe("Changed");
    expect(mockSave.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mockInformation.mock.invocationCallOrder[0],
    );
    expect(screen.queryByLabelText("Name")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Continue"));
    await waitFor(() =>
      expect(mockResidences).toHaveBeenCalledWith({
        id: "application",
        replacesOperationId: undefined,
      }),
    );
    expect(mockEditor.input.residenceHistory).toEqual([]);
  });

  it("does not advance an uncertain Pending save unless the repository advanced", async () => {
    mockInformation.mockResolvedValue({ status: "Pending" });
    await render(<ApplicationFormScreen {...props()} />);
    await fireEvent.press(screen.getByLabelText("Continue"));
    await waitFor(() => expect(mockInformation).toHaveBeenCalled());
    expect(screen.getByLabelText("Name")).toBeTruthy();
    expect(screen.queryByText("Add residence")).toBeNull();
  });

  it("advances after a durably queued Continue", async () => {
    mockInformation.mockImplementation(async () => {
      mockEditor = { ...mockEditor, currentStep: "ResidenceHistory" };
      return { status: "Pending" };
    });
    await render(<ApplicationFormScreen {...props()} />);
    await fireEvent.press(screen.getByLabelText("Continue"));
    await waitFor(() => expect(screen.getByText("Residence history")).toBeTruthy());
    expect(screen.queryByLabelText("Name")).toBeNull();
  });

  it("locks editing while a Submit action is unresolved", async () => {
    mockOperations = [
      {
        id: "operation",
        resourceType: "Application",
        resourceId: "application",
        command: "SubmitApplication",
        state: "Queued",
        dismissedAt: null,
      },
    ];
    await render(<ApplicationFormScreen {...props()} />);
    expect(screen.getByLabelText("Name").props.editable).toBe(false);
    await fireEvent.press(screen.getByLabelText("Continue"));
    expect(mockInformation).not.toHaveBeenCalled();
  });

  it("does not edit a resumed application that has become terminal", async () => {
    mockInitial.lifecycle = "ServerLinked";
    mockEditor = { ...mockInitial };
    mockDetail = {
      ...applicationDetail,
      isOutdated: false,
      application: { ...applicationDetail.application, status: "Denied" },
    };
    await render(<ApplicationFormScreen {...props()} />);
    expect(screen.getByLabelText("Name").props.editable).toBe(false);
    await fireEvent.press(screen.getByLabelText("Continue"));
    expect(mockInformation).not.toHaveBeenCalled();
  });

  it("preserves input and maps server errors on a rejected Continue", async () => {
    const body = {
      code: "ValidationFailed",
      validation: { fields: { "applicantInformation.name": "Name is not allowed." } },
    };
    mockInformation.mockRejectedValue(
      new HTTPError(422, body, new Response(JSON.stringify(body), { status: 422 })),
    );
    await render(<ApplicationFormScreen {...props()} />);
    await fireEvent.changeText(screen.getByLabelText("Name"), "Rejected name");
    await fireEvent.press(screen.getByLabelText("Continue"));
    await waitFor(() => expect(screen.getByText("Name is not allowed.")).toBeTruthy());
    expect(screen.getByLabelText("Name").props.value).toBe("Rejected name");
  });

  it("copies profile information only after explicit confirmation", async () => {
    await render(<ApplicationFormScreen {...props()} />);
    await fireEvent.changeText(screen.getByLabelText("Name"), "Local name");
    await fireEvent.press(screen.getByLabelText("Copy from profile"));
    expect(mockCopy).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Cancel copy"));
    expect(screen.getByLabelText("Name").props.value).toBe("Local name");
    await fireEvent.press(screen.getByLabelText("Copy from profile"));
    await fireEvent.press(screen.getByLabelText("Confirm copy"));
    await waitFor(() => expect(screen.getByLabelText("Name").props.value).toBe(information.name));
    expect(mockCopy).toHaveBeenCalledWith([
      "application",
      "ApplicantInformation",
      mockProfile,
      true,
    ]);
    expect(mockInformation).not.toHaveBeenCalled();
  });

  it("submits snapshots with the exact editor version and shows a read-only Summary", async () => {
    mockInitial.currentStep = "Summary";
    mockSummary = {
      snapshots: { ApplicantInformation: { id: "info" }, ResidenceHistory: { id: "residences" } },
      hasUnfinishedEdits: false,
      sectionsAccepted: true,
      applicantInformation: information,
      residenceHistory: [],
    };
    await render(<ApplicationFormScreen {...props()} />);
    expect(screen.queryByLabelText("Name")).toBeNull();
    expect(screen.getByText(information.name!)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Submit application"));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith({
        input: { id: "application", expectedVersion: "9007199254740993" },
      }),
    );
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
  });

  it("copies an empty profile residence history locally without saving a section", async () => {
    mockInitial.currentStep = "ResidenceHistory";
    await render(<ApplicationFormScreen {...props()} />);
    await fireEvent.press(screen.getByLabelText("Add residence"));
    expect(screen.getByText("Residence 1")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Copy from profile"));
    await fireEvent.press(screen.getByLabelText("Confirm copy"));
    await waitFor(() => expect(screen.queryByText("Residence 1")).toBeNull());
    expect(mockCopy).toHaveBeenCalledWith(["application", "ResidenceHistory", mockProfile, true]);
    expect(mockResidences).not.toHaveBeenCalled();
  });

  it("preserves a later residence's fields when deleting the first row", async () => {
    mockInitial.currentStep = "ResidenceHistory";
    await render(<ApplicationFormScreen {...props()} />);
    await fireEvent.press(screen.getByLabelText("Add residence"));
    await fireEvent.changeText(screen.getByLabelText("Landlord name"), "First owner");
    await fireEvent.press(screen.getByLabelText("Add residence"));
    await fireEvent.changeText(screen.getAllByLabelText("Landlord name")[1], "Second owner");
    await fireEvent.press(screen.getByLabelText("Delete residence 1"));
    expect(screen.getByLabelText("Landlord name").props.value).toBe("Second owner");
    await waitFor(() => expect(mockEditor.input.residenceHistory).toHaveLength(1));
    expect(mockEditor.input.residenceHistory[0].landlordName).toBe("Second owner");
  });

  it("Back saves invalid residence input locally and does not block information Continue", async () => {
    mockInitial.currentStep = "ResidenceHistory";
    await render(<ApplicationFormScreen {...props()} />);
    await fireEvent.press(screen.getByLabelText("Add residence"));
    await fireEvent.press(screen.getByLabelText("Back"));
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeTruthy());
    expect(mockEditor.input.residenceHistory).toHaveLength(1);
    await fireEvent.press(screen.getByLabelText("Continue"));
    await waitFor(() => expect(mockInformation).toHaveBeenCalled());
    expect(mockResidences).not.toHaveBeenCalled();
  });

  it.each(["unfinished", "unaccepted"])("blocks Submit for %s sections", async (reason) => {
    mockInitial.currentStep = "Summary";
    mockSummary = {
      snapshots: { ApplicantInformation: { id: "info" }, ResidenceHistory: { id: "residences" } },
      hasUnfinishedEdits: reason === "unfinished",
      sectionsAccepted: reason !== "unaccepted",
      applicantInformation: information,
      residenceHistory: [],
    };
    await render(<ApplicationFormScreen {...props()} />);
    await fireEvent.press(screen.getByLabelText("Submit application"));
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
