import { useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Routes } from "@/app/navigation/routes";
import { availablePage, availableUnit } from "@/features/inventory/testing/fixtures";
import { AvailableUnitsScreen } from "./AvailableUnitsScreen";

const mockQuery = jest.fn();
const mockTypes = jest.fn();
const mockRefetch = jest.fn();
const mockFetchNext = jest.fn();
const mockNavigate = jest.fn();

jest.mock("@/components/layout", () => ({
  FlatListLayout: jest.requireActual("react-native").FlatList,
}));

jest.mock("@/features/inventory/hooks", () => ({
  useAvailableUnits: (params: unknown) => mockQuery(params),
  useUnitTypes: () => mockTypes(),
}));
jest.mock("react-native-unistyles", () => ({
  StyleSheet: { create: () => ({ useVariants: jest.fn() }) },
  useUnistyles: () => ({ theme: { colors: { surface: "white" }, radius: { card: 16 } } }),
}));
jest.mock("@/components/Icon", () => ({ Icon: () => null }));
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
      accessibilityLabel,
      ...props
    }: {
      title: string;
      accessibilityLabel?: string;
    }) => (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        {...props}
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
        <View testID="bottom-sheet">
          {header}
          {children}
          {footer}
        </View>
      );
    },
  };
});

function Harness() {
  const [header, setHeader] = useState<ReactNode>(null);
  const navigation = useMemo(
    () => ({
      setOptions: ({ headerRight }: { headerRight: () => ReactNode }) => setHeader(headerRight()),
      navigate: mockNavigate,
    }),
    [],
  );
  const props = { navigation } as unknown as Parameters<typeof AvailableUnitsScreen>[0];
  return (
    <View>
      {header}
      <AvailableUnitsScreen {...props} />
    </View>
  );
}

describe("AvailableUnitsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockReturnValue({
      data: { pages: [{ data: availablePage, source: "server" }] },
      isPending: false,
      isError: false,
      isFetching: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      refetch: mockRefetch,
      fetchNextPage: mockFetchNext,
    });
    mockTypes.mockReturnValue({
      data: { data: [availableUnit.unitType], source: "server" },
      refetch: jest.fn(),
    });
  });

  it("dismisses the details sheet before Apply opens the application form", async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByText("Garden, 12 Main St"));
    expect(screen.getAllByTestId("bottom-sheet")).toHaveLength(1);
    expect(screen.getByText("Bedrooms")).toBeTruthy();
    expect(screen.getByLabelText("Sort units").props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByLabelText("Apply"));
    await waitFor(() => expect(screen.queryByTestId("bottom-sheet")).toBeNull());
    expect(mockRefetch).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(Routes.ApplicationForm, {
      unitId: availableUnit.unit.id,
    });
  });

  it("sorts through the reusable radio list and marks the header button active", async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Sort units"));
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    await fireEvent.press(screen.getByText("Price: high to low"));
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "Price: high to low" }).props.accessibilityState.checked,
    ).toBe(true);
    expect(mockQuery.mock.calls.at(-1)?.[0].sortBy).toBeUndefined();
    await fireEvent.press(screen.getByLabelText("Apply"));
    await waitFor(() =>
      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: "price", sortDirection: "desc" }),
      ),
    );
    expect(screen.queryByTestId("bottom-sheet")).toBeNull();
    expect(screen.getByLabelText("Sort units").props.accessibilityState.selected).toBe(true);
  });

  it("discards cancelled sorting and applies reset only after confirmation", async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Sort units"));
    await fireEvent.press(screen.getByText("Newest first"));
    await fireEvent.press(screen.getByLabelText("Close bottom sheet"));
    expect(screen.getByLabelText("Sort units").props.accessibilityState.selected).toBe(false);
    await fireEvent.press(screen.getByLabelText("Sort units"));
    expect(
      screen.getByRole("radio", { name: "Default order" }).props.accessibilityState.checked,
    ).toBe(true);
    await fireEvent.press(screen.getByText("Newest first"));
    await fireEvent.press(screen.getByLabelText("Apply"));
    await waitFor(() => expect(screen.queryByTestId("bottom-sheet")).toBeNull());
    await fireEvent.press(screen.getByLabelText("Sort units"));
    await fireEvent.press(screen.getByLabelText("Reset"));
    expect(screen.getByTestId("bottom-sheet")).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "Default order" }).props.accessibilityState.checked,
    ).toBe(true);
    expect(mockQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: "createdAt", sortDirection: "desc" }),
    );
    await fireEvent.press(screen.getByLabelText("Apply"));
    await waitFor(() =>
      expect(screen.getByLabelText("Sort units").props.accessibilityState.selected).toBe(false),
    );
  });

  it("validates and commits chips, exact bedrooms and prices only on confirmation", async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Filter units"));
    await fireEvent.press(screen.getByRole("checkbox"));
    await fireEvent.press(screen.getByLabelText("Increase bedrooms"));
    expect(screen.getByLabelText("Decrease bedrooms")).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Price from (USD)"), "100.29");
    await fireEvent.changeText(screen.getByLabelText("Price to (USD)"), "1");
    await waitFor(() =>
      expect(screen.getByText("Must be at least the minimum price.")).toBeTruthy(),
    );
    expect(mockQuery).toHaveBeenLastCalledWith(expect.objectContaining({ bedrooms: undefined }));
    await fireEvent.changeText(screen.getByLabelText("Price to (USD)"), "200");
    await fireEvent.press(screen.getByLabelText("Show units"));
    await waitFor(() =>
      expect(mockQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({
          unitTypeIds: ["type"],
          bedrooms: 1,
          priceFrom: 10029,
          priceTo: 20000,
        }),
      ),
    );
    expect(screen.queryByTestId("bottom-sheet")).toBeNull();
  });

  it("discards cancelled filter edits and reset clears applied restrictions", async () => {
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText("Filter units"));
    await fireEvent.press(screen.getByLabelText("Increase bedrooms"));
    await fireEvent.press(screen.getByLabelText("Close bottom sheet"));
    expect(mockQuery).toHaveBeenLastCalledWith(expect.objectContaining({ bedrooms: undefined }));
    await fireEvent.press(screen.getByLabelText("Filter units"));
    expect(screen.getAllByText("Any")).toHaveLength(2);
    await fireEvent.press(screen.getByLabelText("Increase bedrooms"));
    await fireEvent.press(screen.getByLabelText("Show units"));
    await waitFor(() => expect(screen.queryByTestId("bottom-sheet")).toBeNull());
    await fireEvent.press(screen.getByLabelText("Filter units"));
    await fireEvent.press(screen.getByLabelText("Reset"));
    await fireEvent.press(screen.getByLabelText("Show units"));
    await waitFor(() =>
      expect(screen.getByLabelText("Filter units").props.accessibilityState.selected).toBe(false),
    );
  });

  it("labels downloaded empty results and retries transport fallback", async () => {
    mockQuery.mockReturnValue({
      data: {
        pages: [
          {
            data: { ...availablePage, items: [] },
            source: "device",
            fallbackError: new Error("offline"),
          },
        ],
      },
      isRefetching: false,
      isFetchingNextPage: false,
      refetch: mockRefetch,
    });
    await render(<Harness />);
    expect(screen.getByText("No matching downloaded records")).toBeTruthy();
    expect(screen.getByText(/Only previously downloaded/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Retry"));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
