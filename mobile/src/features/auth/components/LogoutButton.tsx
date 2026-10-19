import { useState } from "react";
import { ConfirmationBottomSheet } from "@/components/ConfirmationBottomSheet";
import { FilterButton } from "@/components/FilterButton";
import { useSession, useSessionState } from "@/services/session";

export function LogoutButton() {
  const session = useSession();
  const busy = useSessionState((state) => state.isBusy);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <FilterButton
        icon="TIconLogoutOutline"
        accessibilityLabel="Logout"
        isActive={false}
        disabled={busy || confirming}
        onPress={() => setConfirming(true)}
      />
      {confirming && (
        <ConfirmationBottomSheet
          title="Logout?"
          message="Logging out removes all downloaded data, pending operations, and local edits from this device. Unsynced work will be lost. This only signs you out locally; it does not revoke your server session."
          confirmTitle="Discard local data and logout"
          successMessage="Signed out on this device."
          onConfirm={() => session.signOut()}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
