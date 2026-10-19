import type { IDatabaseQueries, ITransactionalDatabase, SqlValue } from "@/services/database/types";
import type { ApplicantInformationDto, ResidenceDto } from "@/features/applicantProfile/types";
import type {
  ApplicationDto,
  GetApplicationResponse,
  GetApplicationsRequestParams,
  GetApplicationsResponse,
  ManagerNoteDto,
} from "./types";
import { applicationDetailSchema } from "./operations/schemas";

type HeaderRow = Omit<ApplicationDto, "propertyAddress" | "isArchived"> & {
  propertyAddressDisplayName: string | null;
  propertyAddressStreetAddress: string | null;
  propertyAddressLine2: string | null;
  isArchived: number;
};

type DetailRow = HeaderRow & {
  applicationId: string;
  name: string | null;
  phone: string | null;
  contactEmail: string | null;
  hasCurrentAddress: number;
  addressDisplayName: string | null;
  addressStreetAddress: string | null;
  addressLine2: string | null;
  applicantInformationSavedAt: string;
  residenceHistorySavedAt: string | null;
};

type ResidenceRow = Omit<ResidenceDto, "address"> & {
  addressDisplayName: string | null;
  addressStreetAddress: string | null;
  addressLine2: string | null;
};

export type ApplicationDetailRead = GetApplicationResponse & { isOutdated: boolean };

export function applicationsQuery(
  params: GetApplicationsRequestParams,
  manager: boolean,
  accountId: string,
) {
  const clauses = manager ? [] : ["applicantId = ?"];
  const values: SqlValue[] = manager ? [] : [accountId];
  if (manager && !params.showArchived) clauses.push("isArchived = 0");
  if (params.status) {
    clauses.push("status = ?");
    values.push(params.status);
  }
  if (params.propertyId) {
    clauses.push("propertyId = ?");
    values.push(params.propertyId);
  }
  const column = params.sortBy === "statusChangedAt" ? "statusChangedAt" : "createdAt";
  const direction = params.sortDirection === "asc" ? "ASC" : "DESC";
  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    values,
    order: `${column} ${direction}, id ASC`,
  };
}

export class ApplicationsRepository {
  constructor(private readonly db: ITransactionalDatabase) {}

  async account(tx: IDatabaseQueries = this.db) {
    const account = await tx.getFirstAsync<{
      id: string;
      email: string;
      role: "Applicant" | "PropertyManager";
    }>("SELECT id, email, role FROM session_account WHERE singleton = 1");
    if (!account) throw new Error("No active account is available.");
    return account;
  }

  async assertNoPendingAction(
    id: string,
    unitId: string,
    excludedId: string,
    allowStartReview: boolean,
    tx: IDatabaseQueries,
  ): Promise<void> {
    const lock = await tx.getFirstAsync<{ id: string }>(
      `SELECT id FROM operations WHERE id <> ? AND dismissedAt IS NULL
      AND state IN ('Queued', 'Dispatched', 'Rejected') AND (
        (resourceType = 'Application' AND resourceId = ? AND command IN ('SubmitApplication', 'WithdrawApplication', 'StartReview', 'ReleaseApplication', 'ReturnApplication', 'DenyApplication', 'ApproveApplication'))
        OR (command = 'RejectAllApplications' AND resourceId = ?))
      ${allowStartReview ? "AND command <> 'StartReview'" : ""} LIMIT 1`,
      [excludedId, id, unitId],
    );
    if (lock) throw new Error("Resolve the pending application action first.");
  }

  async getApplications(
    params: GetApplicationsRequestParams = {},
  ): Promise<GetApplicationsResponse> {
    return this.db.withTransactionAsync(async (tx) => {
      const account = await this.account(tx);
      const { where, values, order } = applicationsQuery(
        params,
        account.role === "PropertyManager",
        account.id,
      );
      const page = params.page ?? 1;
      const count = await tx.getFirstAsync<{ total: number }>(
        `SELECT COUNT(*) AS total FROM applications ${where}`,
        values,
      );
      const rows = await tx.getAllAsync<HeaderRow>(
        `SELECT * FROM applications ${where} ORDER BY ${order} LIMIT 20 OFFSET ?`,
        [...values, (page - 1) * 20],
      );
      return { rows: rows.map(toApplication), total: count?.total ?? 0, page, pageSize: 20 };
    });
  }

  async savePage(response: GetApplicationsResponse, tx?: IDatabaseQueries): Promise<void> {
    if (!tx)
      return this.db.withTransactionAsync((transaction) => this.savePage(response, transaction));
    for (const row of response.rows) await this.saveHeader(row, tx);
  }

  async getDetail(id: string): Promise<ApplicationDetailRead | null> {
    return this.db.withTransactionAsync(async (tx) => {
      const row = await tx.getFirstAsync<DetailRow>(
        "SELECT *, applicationId AS id FROM application_details WHERE applicationId = ?",
        [id],
      );
      if (!row) return null;
      const residences = await tx.getAllAsync<ResidenceRow>(
        "SELECT * FROM application_residences WHERE applicationId = ? ORDER BY position",
        [id],
      );
      const history = await tx.getAllAsync<GetApplicationResponse["history"][number]>(
        "SELECT id, sequence, actorUserId, action, fromStatus, toStatus, comment, occurredAt FROM application_history WHERE applicationId = ? ORDER BY sequence",
        [id],
      );
      const lease = await tx.getFirstAsync<NonNullable<GetApplicationResponse["lease"]>>(
        "SELECT id, startDate, endDateExclusive, approvedAt FROM application_leases WHERE applicationId = ?",
        [id],
      );
      const account = await this.account(tx);
      const myNote =
        account.role === "PropertyManager"
          ? await tx.getFirstAsync<ManagerNoteDto>(
              "SELECT body, createdAt, updatedAt, version FROM application_manager_notes WHERE applicationId = ? AND managerId = ?",
              [id, account.id],
            )
          : null;
      const summary = await tx.getFirstAsync<{ version: string; isArchived: number }>(
        "SELECT version, isArchived FROM applications WHERE id = ?",
        [id],
      );
      const effects = await tx.getAllAsync<{ version: string }>(
        "SELECT version FROM operation_affected_resources WHERE resourceType = 'Application' AND resourceId = ? AND version IS NOT NULL",
        [id],
      );
      const information: ApplicantInformationDto = {
        name: row.name,
        phone: row.phone,
        contactEmail: row.contactEmail,
        currentAddress: row.hasCurrentAddress
          ? {
              displayName: row.addressDisplayName,
              streetAddress: row.addressStreetAddress,
              line2: row.addressLine2,
            }
          : null,
      };
      return {
        application: toApplication(row),
        applicantInformation: information,
        applicantInformationSavedAt: row.applicantInformationSavedAt,
        residenceHistorySavedAt: row.residenceHistorySavedAt,
        residenceHistory: residences.map((r) => ({
          position: r.position,
          address: {
            displayName: r.addressDisplayName,
            streetAddress: r.addressStreetAddress,
            line2: r.addressLine2,
          },
          landlordName: r.landlordName,
          landlordPhone: r.landlordPhone,
          moveInDate: r.moveInDate,
          moveOutDate: r.moveOutDate,
        })),
        history,
        lease,
        myNote,
        isOutdated:
          Boolean(
            summary &&
            (BigInt(summary.version) > BigInt(row.version) ||
              summary.isArchived !== row.isArchived),
          ) || effects.some((effect) => BigInt(effect.version) > BigInt(row.version)),
      };
    });
  }

  async saveDetail(
    raw: GetApplicationResponse & { operationId?: string },
    tx?: IDatabaseQueries,
  ): Promise<void> {
    if (!tx)
      return this.db.withTransactionAsync((transaction) => this.saveDetail(raw, transaction));
    const detail = applicationDetailSchema.parse(raw);
    const id = detail.application.id;
    await this.saveHeader(detail.application, tx);
    // Notes have their own version; an older application receipt may carry a newer note, or vice versa.
    if (detail.myNote) await this.saveNote(id, detail.myNote, tx);
    const previous = await tx.getFirstAsync<{ version: string }>(
      "SELECT version FROM application_details WHERE applicationId = ?",
      [id],
    );
    if (!previous || BigInt(previous.version) <= BigInt(detail.application.version)) {
      const { id: applicationId, ...header } = headerRecord(detail.application);
      const info = detail.applicantInformation;
      await this.upsert(
        "application_details",
        "applicationId",
        {
          applicationId,
          ...header,
          name: info.name,
          phone: info.phone,
          contactEmail: info.contactEmail,
          hasCurrentAddress: info.currentAddress ? 1 : 0,
          addressDisplayName: info.currentAddress?.displayName ?? null,
          addressStreetAddress: info.currentAddress?.streetAddress ?? null,
          addressLine2: info.currentAddress?.line2 ?? null,
          applicantInformationSavedAt: detail.applicantInformationSavedAt,
          residenceHistorySavedAt: detail.residenceHistorySavedAt,
        },
        tx,
      );
      for (const table of ["application_residences", "application_history", "application_leases"])
        await tx.runAsync(`DELETE FROM ${table} WHERE applicationId = ?`, [id]);
      for (const r of detail.residenceHistory) {
        await tx.runAsync(
          "INSERT INTO application_residences (applicationId, position, addressDisplayName, addressStreetAddress, addressLine2, landlordName, landlordPhone, moveInDate, moveOutDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            id,
            r.position,
            r.address.displayName,
            r.address.streetAddress,
            r.address.line2,
            r.landlordName,
            r.landlordPhone,
            r.moveInDate,
            r.moveOutDate,
          ],
        );
      }
      for (const h of detail.history)
        await tx.runAsync(
          "INSERT INTO application_history (id, applicationId, sequence, actorUserId, action, fromStatus, toStatus, comment, occurredAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            h.id,
            id,
            h.sequence,
            h.actorUserId,
            h.action,
            h.fromStatus,
            h.toStatus,
            h.comment,
            h.occurredAt,
          ],
        );
      if (detail.lease) {
        const l = detail.lease;
        await tx.runAsync(
          "INSERT INTO application_leases (applicationId, id, startDate, endDateExclusive, approvedAt) VALUES (?, ?, ?, ?, ?)",
          [id, l.id, l.startDate, l.endDateExclusive, l.approvedAt],
        );
        if (l.endDateExclusive.slice(0, 10) > new Date().toISOString().slice(0, 10))
          await tx.runAsync("DELETE FROM available_units WHERE unitId = ?", [
            detail.application.unitId,
          ]);
      }
    }
    await tx.runAsync(
      "UPDATE application_editors SET lifecycle = 'ServerLinked' WHERE applicationId = ?",
      [id],
    );
    if (raw.operationId) {
      await tx.runAsync(
        `UPDATE application_editor_sections SET acceptedSnapshotId = (
        SELECT s.id FROM operation_snapshots os JOIN form_snapshots s ON s.id = os.snapshotId
        WHERE os.operationId = ? AND s.formId = application_editor_sections.formId AND s.section = application_editor_sections.section
      ), acceptedOperationId = ? WHERE formId IN (SELECT formId FROM application_editors WHERE applicationId = ?)
        AND EXISTS (SELECT 1 FROM operation_snapshots os JOIN form_snapshots s ON s.id = os.snapshotId
          WHERE os.operationId = ? AND s.formId = application_editor_sections.formId AND s.section = application_editor_sections.section
          AND s.revision >= COALESCE((SELECT revision FROM form_snapshots WHERE id = application_editor_sections.acceptedSnapshotId), 0))`,
        [raw.operationId, raw.operationId, id, raw.operationId],
      );
      const localSnapshot = await tx.getFirstAsync<{
        section: string;
        baseVersion: string | null;
        formId: string;
      }>(
        `SELECT s.section, f.baseVersion, f.id AS formId FROM operation_snapshots os
        JOIN form_snapshots s ON s.id = os.snapshotId JOIN local_forms f ON f.id = s.formId
        JOIN application_editor_sections e ON e.formId = s.formId AND e.section = s.section
        WHERE os.operationId = ? AND e.latestContinueSnapshotId = s.id`,
        [raw.operationId],
      );
      if (
        localSnapshot &&
        (!localSnapshot.baseVersion ||
          BigInt(localSnapshot.baseVersion) <= BigInt(detail.application.version))
      ) {
        await tx.runAsync("UPDATE local_forms SET baseVersion = ? WHERE id = ?", [
          detail.application.version,
          localSnapshot.formId,
        ]);
        await tx.runAsync("UPDATE application_editors SET currentStep = ? WHERE formId = ?", [
          localSnapshot.section === "ApplicantInformation" ? "ResidenceHistory" : "Summary",
          localSnapshot.formId,
        ]);
      }
    }
  }

  async saveNote(id: string, note: ManagerNoteDto, tx?: IDatabaseQueries): Promise<void> {
    if (!tx)
      return this.db.withTransactionAsync((transaction) => this.saveNote(id, note, transaction));
    const account = await this.account(tx);
    if (account.role !== "PropertyManager") return;
    const previous = await tx.getFirstAsync<{ version: string }>(
      "SELECT version FROM application_manager_notes WHERE applicationId = ? AND managerId = ?",
      [id, account.id],
    );
    if (previous && BigInt(previous.version) > BigInt(note.version)) return;
    await tx.runAsync(
      `INSERT INTO application_manager_notes (applicationId, managerId, body, createdAt, updatedAt, version, fetchedAt) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(applicationId, managerId) DO UPDATE SET body = excluded.body, createdAt = excluded.createdAt, updatedAt = excluded.updatedAt, version = excluded.version, fetchedAt = excluded.fetchedAt`,
      [
        id,
        account.id,
        note.body,
        note.createdAt,
        note.updatedAt,
        note.version,
        new Date().toISOString(),
      ],
    );
  }

  private async saveHeader(row: ApplicationDto, tx: IDatabaseQueries) {
    const previous = await tx.getFirstAsync<{ version: string }>(
      "SELECT version FROM applications WHERE id = ?",
      [row.id],
    );
    if (!/^[1-9]\d*$/.test(row.version)) throw new Error("Invalid application version.");
    if (previous && BigInt(previous.version) > BigInt(row.version)) return;
    await this.upsert("applications", "id", headerRecord(row), tx);
  }

  private async upsert(
    table: "applications" | "application_details",
    key: "id" | "applicationId",
    record: Record<string, SqlValue>,
    tx: IDatabaseQueries,
  ) {
    const data = { ...record, fetchedAt: new Date().toISOString() };
    const keys = Object.keys(data);
    await tx.runAsync(
      `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map(() => "?").join(", ")}) ON CONFLICT(${key}) DO UPDATE SET ${keys
        .filter((k) => k !== key)
        .map((k) => `${k} = excluded.${k}`)
        .join(", ")}`,
      Object.values(data),
    );
  }
}

function headerRecord(row: ApplicationDto): Record<string, SqlValue> {
  return {
    id: row.id,
    applicantId: row.applicantId,
    unitId: row.unitId,
    propertyId: row.propertyId,
    unitNumber: row.unitNumber,
    propertyAddressDisplayName: row.propertyAddress.displayName,
    propertyAddressStreetAddress: row.propertyAddress.streetAddress,
    propertyAddressLine2: row.propertyAddress.line2,
    isArchived: row.isArchived ? 1 : 0,
    applicantName: row.applicantName,
    status: row.status,
    createdAt: row.createdAt,
    statusChangedAt: row.statusChangedAt,
    version: row.version,
  };
}

function toApplication(row: HeaderRow): ApplicationDto {
  return {
    id: row.id,
    applicantId: row.applicantId,
    unitId: row.unitId,
    propertyId: row.propertyId,
    unitNumber: row.unitNumber,
    propertyAddress: {
      displayName: row.propertyAddressDisplayName,
      streetAddress: row.propertyAddressStreetAddress,
      line2: row.propertyAddressLine2,
    },
    isArchived: Boolean(row.isArchived),
    applicantName: row.applicantName,
    status: row.status,
    createdAt: row.createdAt,
    statusChangedAt: row.statusChangedAt,
    version: row.version,
  };
}
