import { ConfirmationBottomSheet } from "@/components/ConfirmationBottomSheet";
import { useApplicantProfile } from "@/features/applicantProfile/hooks";
import type { ApplicationEditorInput, ApplicationSection } from "../forms";
import { useApplicationEditor, useCopyProfileSection } from "../hooks";

export function CopyApplicationProfileSection({
  id,
  section,
  beforeCopy,
  onCopied,
  onClose,
  onBusyChange,
}: {
  id: string;
  section: ApplicationSection;
  beforeCopy: () => Promise<void>;
  onCopied: (input: ApplicationEditorInput) => void;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const profile = useApplicantProfile();
  const editor = useApplicationEditor(id);
  const copy = useCopyProfileSection();
  return (
    <ConfirmationBottomSheet
      title="Copy from profile?"
      message="This replaces the current section's local input. Your profile and saved application sections are not changed until you Continue."
      confirmTitle="Replace section"
      successMessage="Profile section copied locally."
      onClose={onClose}
      onConfirm={async () => {
        onBusyChange(true);
        try {
          await beforeCopy();
          const currentProfile = await profile.refetch();
          if (!currentProfile.data || currentProfile.isError)
            throw (
              currentProfile.error ??
              new Error("Profile unavailable. Download it before copying offline.")
            );
          await copy.mutateAsync([id, section, currentProfile.data, true]);
          const current = await editor.refetch();
          if (!current.data) throw new Error("Could not reload the copied section.");
          onCopied(current.data.input);
        } finally {
          onBusyChange(false);
        }
      }}
    />
  );
}
