import { uuidv7 } from "uuidv7";
import type { IDatabaseQueries, ITransactionalDatabase } from "@/services/database/types";
import type { JournalOperation } from "../operations/types";
import type { GetApplicantProfileResponse, ResidenceDto } from "./types";

export type ProfileSection = "ApplicantInformation" | "ResidenceHistory";

type ProfileRow = {
  applicantId: string;
  name: string | null;
  phone: string | null;
  contactEmail: string | null;
  hasCurrentAddress: number;
  addressDisplayName: string | null;
  addressStreetAddress: string | null;
  addressLine2: string | null;
  version: string;
};

type ResidenceRow = Omit<ResidenceDto, "address"> & {
  addressDisplayName: string | null;
  addressStreetAddress: string | null;
  addressLine2: string | null;
};

export class ApplicantProfileRepository {
  constructor(private readonly db: ITransactionalDatabase) {}

  async get(): Promise<GetApplicantProfileResponse | null> {
    return this.db.withTransactionAsync(async (tx) => {
      const row = await tx.getFirstAsync<ProfileRow>(
        `SELECT p.* FROM applicant_profiles p JOIN session_account a ON a.id = p.applicantId WHERE a.singleton = 1`,
      );
      if (!row) return null;
      const residences = await tx.getAllAsync<ResidenceRow>(
        "SELECT * FROM applicant_profile_residences WHERE applicantId = ? ORDER BY position",
        [row.applicantId],
      );
      return {
        version: row.version,
        applicantInformation: {
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
        },
        residenceHistory: residences.map((residence) => ({
          position: residence.position,
          address: {
            displayName: residence.addressDisplayName,
            streetAddress: residence.addressStreetAddress,
            line2: residence.addressLine2,
          },
          landlordName: residence.landlordName,
          landlordPhone: residence.landlordPhone,
          moveInDate: residence.moveInDate,
          moveOutDate: residence.moveOutDate,
        })),
      };
    });
  }

  async save(profile: GetApplicantProfileResponse, tx?: IDatabaseQueries): Promise<void> {
    if (!tx) return this.db.withTransactionAsync((transaction) => this.save(profile, transaction));
    const applicantId = await this.getApplicantId(tx);
    const previous = await tx.getFirstAsync<{ version: string }>(
      "SELECT version FROM applicant_profiles WHERE applicantId = ?",
      [applicantId],
    );
    // Receipt replay returns the original snapshot, which may predate a newer GET.
    if (!/^[1-9]\d*$/.test(profile.version)) throw new Error("Invalid profile version.");
    if (previous && BigInt(previous.version) > BigInt(profile.version)) return;
    const information = profile.applicantInformation;
    const address = information.currentAddress;
    await tx.runAsync(
      `INSERT INTO applicant_profiles
       (applicantId, name, phone, contactEmail, hasCurrentAddress,
        addressDisplayName, addressStreetAddress, addressLine2, version, fetchedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(applicantId) DO UPDATE SET
        name = excluded.name, phone = excluded.phone, contactEmail = excluded.contactEmail,
        hasCurrentAddress = excluded.hasCurrentAddress, addressDisplayName = excluded.addressDisplayName,
        addressStreetAddress = excluded.addressStreetAddress, addressLine2 = excluded.addressLine2,
        version = excluded.version, fetchedAt = excluded.fetchedAt`,
      [
        applicantId,
        information.name,
        information.phone,
        information.contactEmail,
        address ? 1 : 0,
        address?.displayName ?? null,
        address?.streetAddress ?? null,
        address?.line2 ?? null,
        profile.version,
        new Date().toISOString(),
      ],
    );
    await tx.runAsync("DELETE FROM applicant_profile_residences WHERE applicantId = ?", [
      applicantId,
    ]);
    for (const residence of profile.residenceHistory) {
      await tx.runAsync(
        `INSERT INTO applicant_profile_residences
         (applicantId, position, addressDisplayName, addressStreetAddress, addressLine2,
          landlordName, landlordPhone, moveInDate, moveOutDate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          applicantId,
          residence.position,
          residence.address.displayName,
          residence.address.streetAddress,
          residence.address.line2,
          residence.landlordName,
          residence.landlordPhone,
          residence.moveInDate,
          residence.moveOutDate,
        ],
      );
    }
  }

  async getDraft(section: ProfileSection): Promise<Record<string, unknown> | null> {
    const applicantId = await this.getApplicantId(this.db);
    const row = await this.db.getFirstAsync<{ inputJson: string }>(
      "SELECT inputJson FROM local_forms WHERE id = ?",
      [this.formId(applicantId, section)],
    );
    return row ? JSON.parse(row.inputJson) : null;
  }

  async saveDraft(
    section: ProfileSection,
    input: Record<string, unknown>,
    baseVersion: string | null = null,
  ): Promise<void> {
    await this.db.withTransactionAsync(async (tx) => {
      const applicantId = await this.getApplicantId(tx);
      await this.upsertForm(applicantId, section, input, baseVersion, tx);
    });
  }

  /** Called in the journal insertion transaction, never as a separate write. */
  async saveIntent(
    operation: JournalOperation,
    section: ProfileSection,
    tx: IDatabaseQueries,
  ): Promise<void> {
    const intent = JSON.parse(operation.intentJson) as Record<string, unknown>;
    const formId = await this.upsertForm(
      operation.resourceId,
      section,
      intent,
      intent.expectedVersion as string,
      tx,
    );
    const snapshotId = uuidv7();
    await tx.runAsync(
      `INSERT INTO form_snapshots (id, formId, section, revision, payloadJson, createdAt)
       SELECT ?, ?, ?, COALESCE(MAX(revision), 0) + 1, ?, ? FROM form_snapshots WHERE formId = ? AND section = ?`,
      [
        snapshotId,
        formId,
        section,
        JSON.stringify(intent),
        new Date().toISOString(),
        formId,
        section,
      ],
    );
    await tx.runAsync("INSERT INTO operation_snapshots (operationId, snapshotId) VALUES (?, ?)", [
      operation.id,
      snapshotId,
    ]);
  }

  async getApplicantId(tx: IDatabaseQueries = this.db): Promise<string> {
    const account = await tx.getFirstAsync<{ id: string }>(
      "SELECT id FROM session_account WHERE singleton = 1",
    );
    if (!account) throw new Error("No active account is available.");
    return account.id;
  }

  private formId(applicantId: string, section: ProfileSection): string {
    return `profile:${applicantId}:${section}`;
  }

  private async upsertForm(
    applicantId: string,
    section: ProfileSection,
    input: Record<string, unknown>,
    baseVersion: string | null,
    tx: IDatabaseQueries,
  ): Promise<string> {
    const formId = this.formId(applicantId, section);
    const now = new Date().toISOString();
    await tx.runAsync(
      `INSERT INTO local_forms
       (id, formType, resourceType, resourceId, baseVersion, inputJson, createdAt, updatedAt)
       VALUES (?, ?, 'Profile', ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET inputJson = excluded.inputJson,
        baseVersion = excluded.baseVersion, updatedAt = excluded.updatedAt`,
      [formId, `Profile${section}`, applicantId, baseVersion, JSON.stringify(input), now, now],
    );
    return formId;
  }
}
