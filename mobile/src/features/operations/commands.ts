import type { ApplicantProfileCommands } from "@/features/applicantProfile/operations/types";
import type { PropertyCommands } from "@/features/properties/operations/types";
import type { UnitCommands } from "@/features/units/operations/types";
import type { ApplicationCommands } from "@/features/applications/operations/types";
import type { ApplicationReviewCommands } from "@/features/applicationReviews/operations/types";

/** Application-wide command contracts. Intersect additional feature command dictionaries here. */
export type Commands = ApplicantProfileCommands &
  PropertyCommands &
  UnitCommands &
  ApplicationCommands &
  ApplicationReviewCommands;
