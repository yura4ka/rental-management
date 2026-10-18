import { Text } from "@/components/ui";
import { LabelValue } from "@/components/LabelValue";
import { getAddressDisplayName } from "@/features/address/utils";
import {
  applicationInformationSchema,
  applicationResidencesSchema,
} from "../applicationValidation";
import type { ApplicationsService } from "../applicationsService";
import { applicationDate } from "../presentation";

export function ApplicationSummarySection({
  summary,
}: {
  summary: Awaited<ReturnType<ApplicationsService["getSummary"]>>;
}) {
  // Decode stored snapshots rather than reading unfinished values from the form.
  const information = applicationInformationSchema.safeParse(summary.applicantInformation);
  const residences = applicationResidencesSchema.safeParse(summary.residenceHistory);
  return (
    <>
      <Text variant="sectionHeading">Summary</Text>
      <Text color="textSecondary">Showing the latest saved Continue snapshots.</Text>
      {summary.hasUnfinishedEdits && (
        <Text accessibilityRole="alert">
          Unfinished edits differ from this summary. Continue the edited sections before submitting.
        </Text>
      )}
      {!summary.sectionsAccepted && (
        <Text color="info.foreground">
          Sections are not yet confirmed by the server. Sync pending saves before submitting online.
        </Text>
      )}
      <Text variant="sectionHeading">Applicant information</Text>
      {information.success ? (
        <LabelValue
          items={[
            { label: "Name", value: information.data.name },
            { label: "Phone", value: information.data.phone },
            { label: "Email", value: information.data.contactEmail },
            {
              label: "Current address",
              value: getAddressDisplayName(information.data.currentAddress),
            },
          ]}
        />
      ) : (
        <Text>Applicant information has not been saved.</Text>
      )}
      <Text variant="sectionHeading">Residence history</Text>
      {!residences.success ? (
        <Text>Residence history has not been saved.</Text>
      ) : !residences.data.length ? (
        <Text>No past residences.</Text>
      ) : (
        residences.data.map((residence, index) => (
          <LabelValue
            key={index}
            items={[
              { label: "Address", value: getAddressDisplayName(residence.address) },
              { label: "Landlord", value: residence.landlordName },
              { label: "Landlord phone", value: residence.landlordPhone },
              { label: "Move-in date", value: applicationDate(residence.moveInDate, true) },
              { label: "Move-out date", value: applicationDate(residence.moveOutDate, true) },
            ]}
          />
        ))
      )}
    </>
  );
}
