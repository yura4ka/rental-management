import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { TrueSheet } from "@lodev09/react-native-true-sheet";
import { BottomSheet } from "@/components/BottomSheet";
import { SelectableList } from "@/components/SelectableList/SelectableList";
import { Button, CheckBox, Text } from "@/components/ui";
import { getAddressDisplayName } from "@/features/address/utils";
import { useApplications } from "../hooks";
import {
  applicationStatuses,
  defaultApplicationFilters,
  statusLabel,
  toApplicationParams,
  type ApplicationFilters,
} from "../presentation";

export function ApplicationsFiltersSheet({
  filters,
  manager,
  onApply,
  onClose,
}: {
  filters: ApplicationFilters;
  manager: boolean;
  onApply: (filters: ApplicationFilters) => void;
  onClose: () => void;
}) {
  const sheet = useRef<TrueSheet>(null);
  const [draft, setDraft] = useState(filters);
  // Discover options independently of the currently applied status/property filter.
  // The application list is authorized for both applicants and non-owning managers.
  const query = useApplications(
    toApplicationParams(
      { ...defaultApplicationFilters, showArchived: draft.showArchived },
      "createdDesc",
      manager,
    ),
  );
  const pages = query.data?.pages;
  const properties = useMemo(
    () => [
      ...new Map(
        (pages ?? [])
          .flatMap((page) => page.data.rows)
          .map((item) => [
            item.propertyId,
            { value: item.propertyId, label: getAddressDisplayName(item.propertyAddress) },
          ]),
      ).values(),
    ],
    [pages],
  );
  useEffect(() => {
    void sheet.current?.present();
  }, []);

  return (
    <BottomSheet.Root ref={sheet}>
      <BottomSheet.Content scrollable onDidDismiss={onClose}>
        <BottomSheet.Header title="Filter applications" border={true} />
        <ScrollView>
          <BottomSheet.Body>
            {manager && (
              <CheckBox
                title={"Show archived"}
                checked={draft.showArchived}
                onCheckedChange={(checked) =>
                  setDraft({
                    ...draft,
                    showArchived: checked,
                    propertyId: draft.showArchived ? "" : draft.propertyId,
                  })
                }
              />
            )}
            <Text variant="sectionHeading">Status</Text>
            <SelectableList
              items={[
                { label: "All statuses", value: "" },
                ...applicationStatuses.map((value) => ({ value, label: statusLabel(value) })),
              ]}
              value={draft.status}
              onChange={(status) => setDraft({ ...draft, status })}
            />
            <Text variant="sectionHeading">Property</Text>
            <Text color="textSecondary">
              Properties with applications are listed here. Load more to discover additional
              properties.
            </Text>
            <SelectableList
              items={[{ label: "All properties", value: "" }, ...properties]}
              value={draft.propertyId}
              onChange={(propertyId) => setDraft({ ...draft, propertyId })}
            />
            {query.isPending && <ActivityIndicator accessibilityLabel="Loading property options" />}
            {pages?.some((page) => page.source === "device") && (
              <Text color="textSecondary">Only downloaded applications are available offline.</Text>
            )}
            {(query.isError || pages?.some((page) => page.fallbackError != null)) && (
              <Button
                title="Retry property options"
                variant="textPrimary"
                onPress={() =>
                  void (query.isFetchNextPageError ? query.fetchNextPage() : query.refetch())
                }
              />
            )}
            {query.hasNextPage && (
              <Button
                title="Load more properties"
                variant="textPrimary"
                isLoadingLeft={query.isFetchingNextPage}
                disabled={query.isFetching}
                onPress={() => void query.fetchNextPage()}
              />
            )}
          </BottomSheet.Body>
        </ScrollView>
        <BottomSheet.Footer>
          <Button
            title="Reset"
            variant="textPrimary"
            onPress={() => setDraft(defaultApplicationFilters)}
          />
          <Button
            title="Apply"
            onPress={() => {
              onApply(draft);
              void sheet.current?.dismiss();
            }}
          />
        </BottomSheet.Footer>
      </BottomSheet.Content>
    </BottomSheet.Root>
  );
}
