export const migrations: readonly (readonly string[])[] = [
  [
    `CREATE TABLE session_account (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Applicant', 'PropertyManager')),
      environmentGeneration TEXT NOT NULL
    );`,
  ],
  [
    `CREATE TABLE properties (
      id TEXT PRIMARY KEY NOT NULL,
      addressDisplayName TEXT, addressStreetAddress TEXT, addressLine2 TEXT,
      displayAddress TEXT NOT NULL, archivedAt TEXT,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, version TEXT NOT NULL,
      fetchedAt TEXT NOT NULL
    );`,
    `CREATE TABLE unit_types (
      id TEXT PRIMARY KEY NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL,
      isActive INTEGER NOT NULL CHECK (isActive IN (0, 1)),
      version TEXT NOT NULL, fetchedAt TEXT NOT NULL
    );`,
    `CREATE TABLE units (
      id TEXT PRIMARY KEY NOT NULL, propertyId TEXT NOT NULL, unitTypeId TEXT NOT NULL,
      number TEXT NOT NULL, bedrooms INTEGER NOT NULL, monthlyRentCents INTEGER NOT NULL,
      archivedAt TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
      version TEXT NOT NULL, fetchedAt TEXT NOT NULL
    );`,
    `CREATE INDEX units_property ON units(propertyId, archivedAt);`,
    `CREATE TABLE available_units (
      unitId TEXT PRIMARY KEY NOT NULL REFERENCES units(id) ON DELETE CASCADE,
      fetchedAt TEXT NOT NULL
    );`,
    `CREATE TABLE applicant_profiles (
      applicantId TEXT PRIMARY KEY NOT NULL,
      name TEXT, phone TEXT, contactEmail TEXT,
      hasCurrentAddress INTEGER NOT NULL CHECK (hasCurrentAddress IN (0, 1)),
      addressDisplayName TEXT, addressStreetAddress TEXT, addressLine2 TEXT,
      version TEXT NOT NULL, fetchedAt TEXT NOT NULL
    );`,
    `CREATE TABLE applicant_profile_residences (
      applicantId TEXT NOT NULL REFERENCES applicant_profiles(applicantId) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position >= 0),
      addressDisplayName TEXT, addressStreetAddress TEXT, addressLine2 TEXT,
      landlordName TEXT NOT NULL, landlordPhone TEXT NOT NULL,
      moveInDate TEXT NOT NULL, moveOutDate TEXT NOT NULL,
      PRIMARY KEY(applicantId, position)
    );`,
    `CREATE TABLE applications (
      id TEXT PRIMARY KEY NOT NULL, applicantId TEXT NOT NULL, unitId TEXT NOT NULL,
      propertyId TEXT NOT NULL, unitNumber TEXT NOT NULL,
      propertyAddressDisplayName TEXT, propertyAddressStreetAddress TEXT, propertyAddressLine2 TEXT,
      isArchived INTEGER NOT NULL CHECK (isArchived IN (0, 1)), applicantName TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Draft', 'Submitted', 'InReview', 'Returned', 'Approved', 'Denied', 'Withdrawn')),
      createdAt TEXT NOT NULL, statusChangedAt TEXT NOT NULL, version TEXT NOT NULL,
      fetchedAt TEXT NOT NULL
    );`,
    `CREATE UNIQUE INDEX applications_one_open_per_unit ON applications(applicantId, unitId)
      WHERE status IN ('Draft', 'Submitted', 'InReview', 'Returned');`,
    `CREATE INDEX applications_list ON applications(status, propertyId, createdAt, id);`,
    // Complete detail headers are independent from newer list projections.
    `CREATE TABLE application_details (
      applicationId TEXT PRIMARY KEY NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      applicantId TEXT NOT NULL, unitId TEXT NOT NULL, propertyId TEXT NOT NULL,
      unitNumber TEXT NOT NULL,
      propertyAddressDisplayName TEXT, propertyAddressStreetAddress TEXT, propertyAddressLine2 TEXT,
      isArchived INTEGER NOT NULL CHECK (isArchived IN (0, 1)), applicantName TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Draft', 'Submitted', 'InReview', 'Returned', 'Approved', 'Denied', 'Withdrawn')),
      createdAt TEXT NOT NULL, statusChangedAt TEXT NOT NULL, version TEXT NOT NULL,
      name TEXT, phone TEXT, contactEmail TEXT,
      hasCurrentAddress INTEGER NOT NULL CHECK (hasCurrentAddress IN (0, 1)),
      addressDisplayName TEXT, addressStreetAddress TEXT, addressLine2 TEXT,
      applicantInformationSavedAt TEXT NOT NULL, residenceHistorySavedAt TEXT,
      fetchedAt TEXT NOT NULL
    );`,
    `CREATE TABLE application_residences (
      applicationId TEXT NOT NULL REFERENCES application_details(applicationId) ON DELETE CASCADE,
      position INTEGER NOT NULL CHECK (position >= 0),
      addressDisplayName TEXT, addressStreetAddress TEXT, addressLine2 TEXT,
      landlordName TEXT NOT NULL, landlordPhone TEXT NOT NULL,
      moveInDate TEXT NOT NULL, moveOutDate TEXT NOT NULL,
      PRIMARY KEY(applicationId, position)
    );`,
    `CREATE TABLE application_history (
      id TEXT PRIMARY KEY NOT NULL,
      applicationId TEXT NOT NULL REFERENCES application_details(applicationId) ON DELETE CASCADE,
      sequence INTEGER NOT NULL, actorUserId TEXT NOT NULL, action TEXT NOT NULL,
      fromStatus TEXT, toStatus TEXT NOT NULL, comment TEXT, occurredAt TEXT NOT NULL,
      UNIQUE(applicationId, sequence)
    );`,
    `CREATE TABLE application_leases (
      applicationId TEXT PRIMARY KEY NOT NULL REFERENCES application_details(applicationId) ON DELETE CASCADE,
      id TEXT NOT NULL UNIQUE, startDate TEXT NOT NULL, endDateExclusive TEXT NOT NULL,
      approvedAt TEXT NOT NULL
    );`,
    `CREATE TABLE application_manager_notes (
      applicationId TEXT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      managerId TEXT NOT NULL, body TEXT NOT NULL, createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL, version TEXT NOT NULL, fetchedAt TEXT NOT NULL,
      PRIMARY KEY(applicationId, managerId)
    );`,
  ],
  [
    `CREATE TABLE operations (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE,
      environmentGeneration TEXT NOT NULL, command TEXT NOT NULL,
      resourceType TEXT NOT NULL, resourceId TEXT NOT NULL,
      executionMode TEXT NOT NULL CHECK (executionMode IN ('Immediate', 'Queued')),
      intentJson TEXT NOT NULL, payloadSchemaVersion INTEGER NOT NULL DEFAULT 1,
      frozenRequestJson TEXT,
      state TEXT NOT NULL DEFAULT 'Queued'
        CHECK (state IN ('Queued', 'Dispatched', 'Accepted', 'Rejected', 'Cancelled')),
      attemptCount INTEGER NOT NULL DEFAULT 0, nextAttemptAt TEXT,
      firstDispatchedAt TEXT, lastAttemptAt TEXT, replayBlockCode TEXT,
      errorCategory TEXT, errorCode TEXT, errorMessage TEXT, errorDetailsJson TEXT,
      httpStatus INTEGER, responseJson TEXT, responseSchemaVersion INTEGER,
      replacesOperationId TEXT REFERENCES operations(id), dismissedAt TEXT,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );`,
    `CREATE INDEX operations_schedule ON operations(state, nextAttemptAt, sequence);`,
    `CREATE INDEX operations_resource ON operations(resourceType, resourceId, sequence);`,
    `CREATE TABLE operation_dependencies (
      operationId TEXT NOT NULL REFERENCES operations(id),
      dependsOnOperationId TEXT NOT NULL REFERENCES operations(id),
      PRIMARY KEY(operationId, dependsOnOperationId),
      CHECK (operationId <> dependsOnOperationId)
    );`,
    `CREATE INDEX operation_dependencies_reverse ON operation_dependencies(dependsOnOperationId);`,
    `CREATE TRIGGER operation_dependencies_order BEFORE INSERT ON operation_dependencies
      WHEN (SELECT sequence FROM operations WHERE id = NEW.dependsOnOperationId)
        >= (SELECT sequence FROM operations WHERE id = NEW.operationId)
      BEGIN SELECT RAISE(ABORT, 'Dependencies must precede their operations'); END;`,
    `CREATE TABLE operation_resources (
      operationId TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      resourceType TEXT NOT NULL, resourceId TEXT NOT NULL,
      accessMode TEXT NOT NULL CHECK (accessMode IN ('Read', 'Write')),
      PRIMARY KEY(operationId, resourceType, resourceId)
    );`,
    `CREATE INDEX operation_resources_resource ON operation_resources(resourceType, resourceId);`,
    `CREATE TABLE operation_affected_resources (
      operationId TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      resourceType TEXT NOT NULL, resourceId TEXT NOT NULL, version TEXT,
      repairedAt TEXT,
      PRIMARY KEY(operationId, resourceType, resourceId)
    );`,
  ],
  [
    `CREATE TABLE local_forms (
      id TEXT PRIMARY KEY NOT NULL, formType TEXT NOT NULL,
      resourceType TEXT NOT NULL, resourceId TEXT NOT NULL, baseVersion TEXT,
      inputJson TEXT NOT NULL, inputSchemaVersion INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    );`,
    `CREATE INDEX local_forms_resource ON local_forms(resourceType, resourceId);`,
    `CREATE TABLE form_snapshots (
      id TEXT PRIMARY KEY NOT NULL, formId TEXT NOT NULL REFERENCES local_forms(id),
      section TEXT NOT NULL, revision INTEGER NOT NULL CHECK (revision > 0),
      payloadJson TEXT NOT NULL, createdAt TEXT NOT NULL,
      UNIQUE(formId, section, revision)
    );`,
    `CREATE TABLE operation_snapshots (
      operationId TEXT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
      snapshotId TEXT NOT NULL REFERENCES form_snapshots(id),
      PRIMARY KEY(operationId, snapshotId)
    );`,
    `CREATE TABLE application_editors (
      formId TEXT PRIMARY KEY NOT NULL REFERENCES local_forms(id),
      applicationId TEXT NOT NULL UNIQUE, applicantId TEXT NOT NULL, unitId TEXT NOT NULL,
      lifecycle TEXT NOT NULL CHECK (lifecycle IN ('LocalOnly', 'CreationPending', 'ServerLinked')),
      currentStep TEXT NOT NULL CHECK (currentStep IN ('ApplicantInformation', 'ResidenceHistory', 'Summary')),
      UNIQUE(applicantId, unitId)
    );`,
    `CREATE TABLE application_editor_sections (
      formId TEXT NOT NULL REFERENCES application_editors(formId) ON DELETE CASCADE,
      section TEXT NOT NULL CHECK (section IN ('ApplicantInformation', 'ResidenceHistory')),
      latestContinueSnapshotId TEXT REFERENCES form_snapshots(id),
      acceptedSnapshotId TEXT REFERENCES form_snapshots(id),
      acceptedOperationId TEXT REFERENCES operations(id),
      PRIMARY KEY(formId, section)
    );`,
  ],
  [
    `CREATE TABLE owned_properties (
      propertyId TEXT PRIMARY KEY NOT NULL REFERENCES properties(id) ON DELETE CASCADE
    );`,
  ],
  [
    // A partial cache cannot enforce a server-wide uniqueness invariant: a newer open row
    // may arrive before the cached predecessor's terminal status is downloaded.
    `DROP INDEX applications_one_open_per_unit;`,
    `CREATE INDEX applications_applicant_unit ON applications(applicantId, unitId);`,
  ],
];

export const currentVersion = migrations.length;
