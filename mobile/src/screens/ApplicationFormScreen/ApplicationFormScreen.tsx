import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { StyleSheet } from "react-native-unistyles";
import { StackActions, usePreventRemove, type NavigationAction } from "@react-navigation/native";
import { useAppForm } from "@/app/form";
import { Routes } from "@/app/navigation/routes";
import type { AuthenticatedStackScreenProps } from "@/app/navigation/types";
import { toast } from "@/app/toast";
import { Button, Text } from "@/components/ui";
import type { ApplicationEditor } from "@/features/applications/applicationEditorRepository";
import { ApplicationInformationSection } from "@/features/applications/components/ApplicationInformationSection";
import { ApplicationResidenceHistorySection } from "@/features/applications/components/ApplicationResidenceHistorySection";
import { ApplicationSummarySection } from "@/features/applications/components/ApplicationSummarySection";
import { ApplicationEditorStatus } from "@/features/applications/components/ApplicationEditorStatus";
import { ApplicationFormFooter } from "@/features/applications/components/ApplicationFormFooter";
import { CopyApplicationProfileSection } from "@/features/applications/components/CopyApplicationProfileSection";
import {
  applicationStepFormSchema,
  type ApplicationSection,
  type ApplicationStep,
} from "@/features/applications/forms";
import {
  useContinueApplicantInformation,
  useContinueResidenceHistory,
  useInitializeApplicationEditor,
  useSubmitApplication,
} from "@/features/applications/hooks";
import { useApplicationFormState } from "@/features/applications/useApplicationFormState";
import { applicationFormFieldErrors } from "@/features/applications/formErrors";
import { useApplicationDraftPersistence } from "@/features/applications/useApplicationDraftPersistence";
import { getOperationErrorMessage } from "@/features/operations/operationErrorMessage";
import { ScrollViewLayout } from "@/components/layout";

type Props = AuthenticatedStackScreenProps<Routes.ApplicationForm>;

export function ApplicationFormScreen(props: Props) {
  const query = useInitializeApplicationEditor(props.route.params);
  if (!query.data)
    return (
      <View style={styles.content}>
        {query.isPending ? (
          <ActivityIndicator accessibilityLabel="Loading application form" />
        ) : (
          <>
            <Text accessibilityRole="alert">{getOperationErrorMessage(query.error)}</Text>
            <Button title="Retry" onPress={() => void query.refetch()} />
          </>
        )}
      </View>
    );
  return <ApplicationForm key={query.data.applicationId} {...props} initialEditor={query.data} />;
}

function ApplicationForm({
  initialEditor,
  navigation,
}: Props & { initialEditor: ApplicationEditor }) {
  const id = initialEditor.applicationId;
  const information = useContinueApplicantInformation();
  const residences = useContinueResidenceHistory();
  const submit = useSubmitApplication();
  const { persist, error: persistenceError } = useApplicationDraftPersistence(id);
  const [step, setStep] = useState(initialEditor.currentStep);
  const { editor, summary, pending, locked, rejected, summaryBlocked, refresh } =
    useApplicationFormState(initialEditor, step);
  const [busy, setBusy] = useState(false);
  const [copySection, setCopySection] = useState<ApplicationSection | null>(null);
  const [residenceRevision, setResidenceRevision] = useState(0);
  const [exitAction, setExitAction] = useState<NavigationAction | null>(null);
  const [replacement, setReplacement] = useState<string | undefined>();
  const disabled = busy || locked;
  const schema = applicationStepFormSchema(step);
  const form = useAppForm({
    defaultValues: initialEditor.input,
    validators: { onBlur: schema },
    listeners: {
      onBlur: ({ formApi }) => {
        void persist(formApi.state.values).catch(() => {});
      },
    },
    onSubmit: async ({ value, formApi }) => {
      if (disabled) return;
      setBusy(true);
      try {
        await persist(value, step);
        if (step === "Summary") {
          const current = await editor.refetch();
          const result = await submit.mutateAsync({
            input: { id, expectedVersion: current.data?.baseVersion ?? "1" },
          });
          if (result.status === "Accepted") {
            toast.success("Application submitted.");
            setExitAction(StackActions.replace(Routes.ApplicationDetails, { applicationId: id }));
          } else toast.info("Submission pending — not yet confirmed by the server.");
        } else {
          const result = await (
            step === "ApplicantInformation" ? information : residences
          ).mutateAsync({ id, replacesOperationId: replacement });
          setReplacement(undefined);
          // Pending alone does not prove a queued save. The repository advances only
          // after acceptance or a durable offline Continue.
          const current = await editor.refetch();
          if (current.data) setStep(current.data.currentStep);
          if (result.status === "Pending")
            toast.info("Saved on this device. Server confirmation is pending.");
          await summary.refetch();
        }
      } catch (error) {
        formApi.setErrorMap({
          onSubmit: { fields: applicationFormFieldErrors(error, value, step) },
        });
        toast.error(getOperationErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
  });
  usePreventRemove(!exitAction, ({ data }) => {
    if (busy || copySection) return;
    if (locked) {
      setExitAction(data.action);
      return;
    }
    void persist(form.state.values, step)
      .then(() => setExitAction(data.action))
      .catch((error) => toast.error(getOperationErrorMessage(error)));
  });
  useEffect(() => {
    if (exitAction) navigation.dispatch(exitAction);
  }, [exitAction, navigation]);
  useEffect(() => {
    void form.validate("change");
  }, [form, step]);

  const back = async () => {
    if (disabled) return;
    const previous: ApplicationStep =
      step === "Summary" ? "ResidenceHistory" : "ApplicantInformation";
    setBusy(true);
    try {
      await persist(form.state.values, previous);
      setReplacement(undefined);
      setStep(previous);
    } catch (error) {
      toast.error(getOperationErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form.AppForm>
      <KeyboardAvoidingView style={styles.screen}>
        <ScrollViewLayout
          edges={["bottom", "left", "right"]}
          contentContainerStyle={styles.content}
        >
          <Text color="textSecondary">
            {step === "ApplicantInformation"
              ? "Step 1 of 3"
              : step === "ResidenceHistory"
                ? "Step 2 of 3"
                : "Step 3 of 3"}
          </Text>
          <ApplicationEditorStatus
            operations={pending}
            locked={locked}
            disabled={busy}
            onRefresh={refresh}
            savedToServer={Boolean(
              summary.data?.sectionsAccepted && !summary.data.hasUnfinishedEdits,
            )}
          />
          {!!persistenceError && (
            <Text accessibilityRole="alert">Could not save local input: {persistenceError}</Text>
          )}
          {step === "ApplicantInformation" ? (
            <ApplicationInformationSection
              form={form}
              disabled={disabled}
              onCopyProfile={() => setCopySection("ApplicantInformation")}
            />
          ) : step === "ResidenceHistory" ? (
            <ApplicationResidenceHistorySection
              key={residenceRevision}
              form={form}
              disabled={disabled}
              onCopyProfile={() => setCopySection("ResidenceHistory")}
            />
          ) : summary.data ? (
            <ApplicationSummarySection summary={summary.data} />
          ) : (
            <Button title="Load summary" onPress={() => void summary.refetch()} />
          )}
          <ApplicationFormFooter
            form={form}
            step={step}
            disabled={disabled}
            submitBlocked={summaryBlocked}
            needsCorrection={!!rejected && replacement !== rejected.id}
            replacing={!!replacement}
            onCorrect={() => setReplacement(rejected?.id)}
            onBack={() => void back()}
          />
        </ScrollViewLayout>
      </KeyboardAvoidingView>
      {copySection && (
        <CopyApplicationProfileSection
          id={id}
          section={copySection}
          onBusyChange={setBusy}
          onClose={() => setCopySection(null)}
          beforeCopy={async () => {
            await persist(form.state.values, step);
          }}
          onCopied={(input) => {
            if (copySection === "ApplicantInformation")
              form.setFieldValue("applicantInformation", input.applicantInformation);
            else {
              form.setFieldValue("residenceHistory", input.residenceHistory);
              setResidenceRevision((value) => value + 1);
            }
          }}
        />
      )}
    </form.AppForm>
  );
}

const styles = StyleSheet.create((theme) => ({
  screen: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
}));
