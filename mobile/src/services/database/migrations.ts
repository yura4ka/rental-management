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
];

export const currentVersion = migrations.length;
