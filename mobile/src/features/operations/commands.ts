import type { ApplicantProfileCommands } from "../applicantProfile/operations/types";
import type { PropertyCommands } from "../properties/operations/types";
import type { UnitCommands } from "../units/operations/types";

/** Application-wide command contracts. Intersect additional feature command dictionaries here. */
export type Commands = ApplicantProfileCommands & PropertyCommands & UnitCommands;
