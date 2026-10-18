---
name: mobile-forms
description: Create, refactor, or review React Native forms in rental-management. Use for TanStack Form hooks, Zod input schemas and inferred types, reusable field groups, array fields, validation errors, keyboard navigation, bottom-sheet editors, and date or other picker fields.
---

# Mobile forms

Follow the application's form abstractions rather than creating a parallel form system.
All repository paths below are relative to the repository root, which is `../../..`
from this skill's directory.

## Read before changing code

1. Read `mobile/AGENTS.md` and applicable instructions. Follow its versioned Expo
   documentation requirements before changing React Native or Expo API usage.
2. Read `mobile/src/app/form/README.md` and the implementations of the shared
   components you will use. The current implementations are the API source of truth.
3. Inspect the feature's specification, schemas, DTOs, and mutation hooks.
4. Use these reference patterns as appropriate:
   - Basic form: `mobile/src/screens/LoginScreen/LoginScreen.tsx`.
   - Schema-inferred inputs: `mobile/src/features/auth/schemas.ts`.
   - Reusable fields: `mobile/src/features/address/components/AddressFields.tsx`.
   - Form schemas and conversions: `mobile/src/features/applicantProfile/forms/`.
   - Sheet editors: `mobile/src/features/applicantProfile/components/`.
   - Shared date picker: `mobile/src/components/DatePickerBottomSheet/`.
   - Calendar dates: `mobile/src/shared/utils/calendarDate.ts`.
5. Load `mobile-operations` when adding or changing journal-backed mutations,
   operation results, replay, dependencies, or cache invalidation. This skill does
   not replace the operation workflow.

## Ownership and structure

- Keep feature-specific schemas, defaults, input/DTO conversion utilities, and
  editor components in the owning feature. Follow its existing organization;
  use a `forms/` directory when several related forms justify it.
- Screens compose data queries, display components, and editors. Avoid putting
  a large form, transport logic, and reusable field definitions in one screen.
- Cross-feature field groups belong to their domain feature. For example,
  address schemas, types, conversions, and grouped inputs belong to
  `features/address`, not to the profile screen.
- Generic controls and picker sheets belong in `src/components`. Shared form
  bindings belong in `src/app/form`.
- Reuse existing components, hooks, and dependencies. Do not introduce a second
  form library, directly call an API from an editor, or copy server data into a
  new persisted UI store.
- Treat existing examples as patterns, not instructions to migrate unrelated
  screens. New requirements below take precedence over legacy patterns.

## Schemas define actual form input types

Define a Zod schema for editable input and derive its type with `z.infer`.
Do not hand-maintain a duplicate interface or use a nullable API DTO as the
text-input model.

```tsx
import { z } from "zod";
import { useAppForm, useFormInputs } from "@/app/form";

const contactFormSchema = z.object({
  name: z.string().trim().max(100),
  contactEmail: z.union([z.literal(""), z.email().max(254)]),
});
type ContactFormInput = z.infer<typeof contactFormSchema>;

const defaultValues: ContactFormInput = { name: "", contactEmail: "" };
```

- `FormInput` and `FormInputPressable` bind **string** values. Represent blank
  editable text as `""`, not `null` or `undefined`.
- Keep schema-inferred values compatible with the fields used at runtime. Do
  not use a transform from strings to numbers, dates, or nullable DTO values as
  the text-input schema and then hide the mismatch with assertions.
- Give optional text fields explicit blank-string semantics. Validate supplied
  values using the feature's business rules.
- Keep DTO schemas distinct from editable form schemas. Map nullable DTO values
  to strings on initialization, then normalize blanks to `null` on submission
  only where the API requires it.
- Normalize deliberately: trim appropriate contact/address fields, but never
  indiscriminately trim passwords or other whitespace-sensitive values.
- Zod's parsed output may differ from raw form state even when both have the
  same TypeScript shape. Parse or explicitly normalize before building a DTO;
  do not assume validators rewrite form values.
- Initialize an editor from its snapshot. Do not reset dirty input whenever a
  query refetches. Preserve the original edited version as an exact string;
  never silently replace it with a newer query version.

## Compose with the application form hook

Import `useAppForm`, `useFormInputs`, `withForm`, and `withFieldGroup` from
`@/app/form`, not from a separate locally created form-hook instance.

```tsx
const form = useAppForm({
  defaultValues,
  validators: { onChange: contactFormSchema, onSubmit: contactFormSchema },
  onSubmit: async ({ value, formApi }) => {
    try {
      const input = contactFormSchema.parse(value);
      await mutation.mutateAsync(input); // Adapt input to the actual hook contract.
    } catch (error) {
      // Map known server field paths with getFieldErrors and show API feedback.
      // Keep the user's input in place; do not reset the form on rejection.
    }
  },
});
const { registerInput, focusInput } = useFormInputs<typeof form>();
```

- Wrap the form in `<form.AppForm>`. Render bound fields with
  `<form.AppField name="...">` and its `field.FormInput` or
  `field.FormInputPressable` component.
- Use `<form.SubmitButton title="Save" />`, not a hand-written approximation
  of its submission guards. It blocks known errors, validation in progress,
  duplicate submissions, and explicit disabling; submit validation still runs.
- Await the mutation inside `onSubmit` so the form's submitting state and button
  loading state cover the entire request.
- Disable editing and destructive array actions while a save is in flight.
  Disable sheet dismissal while submitting when losing the editor would hide
  the result or discard input.
- String errors and Standard Schema issue messages are already supported by
  the shared fields. Errors replace helper `description`; do not render a
  second inconsistent error system beside them.
- Use `getFieldErrors` and `getApiErrorMessage` from
  `@/shared/utils/errorUtils`. Explicitly map API field prefixes to form paths
  when they differ. Only accept known paths, including currently mounted array
  paths; never cast arbitrary server keys into the form's field types.

## Inputs and keyboard navigation

- Pass `registerInput` directly to `FormInput`; input refs are removed on unmount.
- Use `returnKeyType="next"` and `onSubmitEditing={() => focusInput("nextPath")}`
  where appropriate. `focusInput` accepts typed nested paths and safely ignores
  unmounted inputs.
- The final appropriate text input can use `returnKeyType="done"` and
  `onSubmitEditing={() => void form.handleSubmit()}`.
- Set keyboard type, capitalization, autocorrection, autocomplete, secure entry,
  and maximum length to match the actual field. Keyboard type is not validation.
- Shared `FormInput` binds change and blur and also invokes supplied handlers.
  Do not override the binding or register the same field twice.

### Inside a bottom sheet

Use the existing `BottomSheet` components with `scrollable` and a React Native
`ScrollView`. **The sheet automatically handles the keyboard and scrolls the
focused input into view.** No additional keyboard-avoidance setup is needed.

```tsx
<BottomSheet.Root ref={sheetRef}>
  <BottomSheet.Content
    scrollable
    scrollableOptions={{ keyboardScrollOffset: 16 }}
  >
    <BottomSheet.Header title="Edit details" />
    <ScrollView keyboardShouldPersistTaps="handled">
      <BottomSheet.Body>{/* Bound form inputs */}</BottomSheet.Body>
    </ScrollView>
    <BottomSheet.Footer>{/* Submit button */}</BottomSheet.Footer>
  </BottomSheet.Content>
</BottomSheet.Root>
```

- `keyboardScrollOffset` is optional extra spacing, not required keyboard setup.
- Do **not** add `KeyboardAvoidingView`, `KeyboardAwareScrollView`, keyboard
  listeners, or manual keyboard-height offsets inside a sheet.
- Scrollable sheets require fractional detents, not `"auto"`. The existing
  `BottomSheet.Content` selects suitable defaults when `detents` is omitted.
- Keep `BottomSheet.Header` and `BottomSheet.Footer` direct children of
  `BottomSheet.Content` (fragments are supported) so it can extract them.
  Place `form.AppForm` outside that structure rather than hiding these slots
  inside another component.
- Do not autofocus before presentation. If needed, focus an input after the
  sheet's `onDidPresent` event.

### Outside a bottom sheet

Use **`KeyboardAwareScrollView` from `react-native-keyboard-controller`** for
scrollable forms outside sheets, instead of combining a plain `ScrollView`
with `KeyboardAvoidingView` or implementing manual avoidance.

```tsx
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

<KeyboardAwareScrollView keyboardShouldPersistTaps="handled">
  {/* Form content */}
</KeyboardAwareScrollView>;
```

Inspect the existing layout and provider setup first. Avoid nesting multiple
keyboard-aware scroll containers, and do not migrate unrelated legacy layouts
merely because an existing example uses a different approach.

## Reuse related fields with withFieldGroup

- Use `withFieldGroup` for cohesive domain fields reused across forms. Use
  `withForm` for components intentionally bound to a particular form shape.
- Supply typed group defaults to define keys and mapping; these defaults do
  not initialize the parent form at runtime. The parent owns its actual values.
- Render fields through `group.AppField`. Pass presentation options such as
  `disabled` or `streetRequired` through the group's declared props.
- Keep validators on the parent form/schema. Field groups must accept unknown
  error types; do not assume every error is a string.
- Reuse the same group at different paths instead of copying fields:

```tsx
<AddressFields form={form} fields="currentAddress" disabled={isSaving} />
<AddressFields
  form={form}
  fields={`residenceHistory[${index}].address`}
  disabled={isSaving}
  streetRequired
/>
```

- For differently named fields, pass an explicit object mapping from the group
  keys to the parent form's paths. Do not force compatibility through `any`.
- Field-group presentation flags do not enforce requiredness. The parent must
  select the correct schema, such as optional current address versus a
  residence address requiring a street.

## Array fields

- Use a bound array field with `mode="array"` and its array helpers to add and
  remove rows. Render child fields with typed paths such as
  `residenceHistory[${index}].landlordName`.
- New rows receive complete defaults for their editable shape, even if invalid
  until the user finishes them.
- Use stable UI keys when rows can be inserted or deleted. Keep temporary keys
  separate from DTOs and positional server identifiers.
- Preserve remaining values and their field associations after deleting an
  earlier row. Do not mutate arrays directly or reuse deleted row identities.
- Apply whole-list submission and empty-list semantics from the API contract;
  do not invent granular residence endpoints.

## Pressable fields and picker sheets

- Use `field.FormInputPressable` for date and other non-text inputs. Open the
  picker from its `onPress` and commit a selected string through
  `field.handleChange(value)`.
- Call `field.handleBlur()` on picker completion/close when native blur does
  not happen. Cancel must leave the value unchanged.
- Use `formatValue` for display-only formatting; preserve the canonical value
  in form state rather than storing a formatted label as the API value.
- Reuse **one** `DatePickerBottomSheet` for all date fields in an editor,
  targeting the active row and field. Do not mount a sheet per date input or
  residence. Render `react-native-date-picker` inside the shared sheet rather
  than adding its separate modal on top.
- Calendar dates use `YYYY-MM-DDT00:00:00Z` on the wire. Use the shared calendar
  helpers and UTC-configured picker; do not round-trip them through local
  timezone formatting or local-midnight conversion.
- Enforce required dates, non-future dates, and date ordering in schemas where
  the feature requires them. Picker restrictions supplement validation, not
  replace it.

## Submission outcomes and preservation

- Keep editable input separate from accepted server data and queued intentions.
  Do not optimistically overwrite accepted cache values with pending form data.
- An operation returning `Pending` is **not** server success and does not prove
  its precise journal state. Show pending/unconfirmed feedback; use the journal
  when showing detailed progress or failure. Never promise automatic replay
  unless that mechanism actually exists.
- Show server-saved feedback and close/reset only after an accepted result, or
  an explicit user decision to close. Prevent accidental duplicate submission
  of the same pending intent.
- Preserve input on validation, API, or conflict errors. Stale versions require
  explicit reload/reapplication, not automatic rebasing of the user's form.
- Follow the feature's draft requirements when persisting unfinished input;
  persisting a draft must not enqueue a business operation.

## Verification checklist

- Schema tests: optional blanks, supplied invalid values, length limits,
  required nested fields, empty arrays, and date constraints as applicable.
- Conversion tests: nullable DTO defaults, normalization, display utilities,
  and calendar dates without timezone shifts.
- Interaction tests: submit payloads, exact original versions, preserved input
  and field errors, pending versus accepted outcomes, array add/delete with
  stable field associations, and picker confirm/cancel with one shared sheet.
- Verify keyboard scrolling, footer reachability, and nested sheet presentation
  on a device/emulator when available. Mocked component tests do not establish
  correct native presentation; report unverified native behavior honestly.
- From `mobile/`, run `npx tsc --noEmit`, `npx expo lint`, and relevant tests
  using `npx jest --runInBand --watchAll=false`. Do not fix unrelated warnings
  or rewrite unrelated files as part of the form change.
