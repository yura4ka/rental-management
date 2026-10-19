import { act, renderHook } from "@testing-library/react-native";
import { editorDefaults } from "./forms";
import { useApplicationDraftPersistence } from "./useApplicationDraftPersistence";

const mockSave = jest.fn();
jest.mock("./hooks", () => ({ useSaveApplicationDraft: () => ({ mutateAsync: mockSave }) }));

describe("application draft persistence", () => {
  beforeEach(() => jest.resetAllMocks());

  it("serializes immutable keystroke snapshots before an explicit step save", async () => {
    let release!: () => void;
    mockSave
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const { result } = await renderHook(() => useApplicationDraftPersistence("application"));
    const input = editorDefaults();
    input.applicantInformation.name = "First";
    let last!: Promise<void>;
    await act(async () => {
      void result.current.persist(input);
      input.applicantInformation.name = "Second";
      last = result.current.persist(input, "ResidenceHistory");
      await Promise.resolve();
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0].input.applicantInformation.name).toBe("First");
    await act(async () => {
      release();
      await last;
    });
    expect(mockSave.mock.calls[1][0]).toMatchObject({
      step: "ResidenceHistory",
      input: { applicantInformation: { name: "Second" } },
    });
  });

  it("reports disk errors without poisoning retries of the latest input", async () => {
    mockSave.mockRejectedValueOnce(new Error("Disk full")).mockResolvedValue(undefined);
    const { result } = await renderHook(() => useApplicationDraftPersistence("application"));
    await act(async () => {
      await expect(result.current.persist(editorDefaults())).rejects.toThrow("Disk full");
    });
    expect(result.current.error).toBe(
      "Could not complete this action. Your input has been preserved.",
    );
    await act(async () => {
      await result.current.persist(editorDefaults());
    });
    expect(result.current.error).toBe("");
  });
});
