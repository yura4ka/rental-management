import type { PropertiesService } from "@/features/properties/propertiesService";
import type { ApplicationsService } from "./applicationsService";
import type { ApplicationDto } from "./types";

/** Each property's first sorted page contains all candidates for the global top three. */
export async function getRecentApplications(
  applications: Pick<ApplicationsService, "getApplications">,
  properties: Pick<PropertiesService, "getProperties"> | null,
  signal?: AbortSignal,
) {
  let offline = false;
  let fallback = false;
  const items: ApplicationDto[] = [];
  const read = async (propertyId?: string) => {
    const result = await applications.getApplications(
      {
        sortBy: "statusChangedAt",
        sortDirection: "desc",
        ...(propertyId ? { propertyId, showArchived: true } : {}),
      },
      signal,
    );
    offline ||= result.source === "device";
    fallback ||= result.fallbackError != null;
    items.push(...result.data.rows.slice(0, 3));
  };

  if (!properties) {
    await read();
  } else {
    // The manager application list includes other managers' properties. Resolve ownership
    // through the owned property list rather than slicing the unfiltered application list.
    let page = 1;
    while (true) {
      const result = await properties.getProperties(
        { includeArchived: true, page, pageSize: 100 },
        signal,
      );
      offline ||= result.source === "device";
      fallback ||= result.fallbackError != null;
      for (const property of result.data.items) await read(property.id);
      if (page * result.data.pageSize >= result.data.totalCount) break;
      page++;
    }
  }

  return {
    items: [...new Map(items.map((item) => [item.id, item])).values()]
      .sort(
        (a, b) =>
          Date.parse(b.statusChangedAt) - Date.parse(a.statusChangedAt) || a.id.localeCompare(b.id),
      )
      .slice(0, 3),
    offline,
    fallback,
  };
}
