"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Description,
  FieldError,
  Input,
  Label,
  Spinner,
  TextField,
  toast,
} from "@heroui/react";
import {
  GraduationCap,
  FileCheck2,
  UserCheck,
  Building2,
} from "lucide-react";

import { OPEN_POSITION } from "@/config/content";
import { ButtonLink } from "@/components/ui/button-link";
import { ApiClientError, apiFetch } from "@/lib/api/client";
import {
  applicationFormSchema,
  getFieldErrors,
} from "@/lib/validation/application";
import type { ApplicationSubmissionResult } from "@/types/recruitment";
import { FileUploadField } from "@/components/forms/file-upload-field";

const NIGERIAN_STATES = [
  "Abia",
  "Abuja (FCT)",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

const QUALIFICATIONS = [
  "Senior Secondary School Certificate (SSCE / WAEC / NECO)",
  "Ordinary National Diploma (OND)",
  "National Certificate in Education (NCE)",
  "Higher National Diploma (HND)",
  "Bachelor's Degree (B.Sc / B.A / B.Tech / B.Ed)",
  "Master's Degree (M.Sc / M.A / MBA)",
  "Doctorate (Ph.D)",
  "Other Professional Certificate",
];

function scrollToFirstError(errors: Record<string, string>) {
  const fieldOrder = [
    "fullName",
    "email",
    "phone",
    "residentialAddress",
    "city",
    "state",
    "highestQualification",
    "institution",
    "courseOfStudy",
    "graduationYear",
    "cvUrl",
    "passportPhotoUrl",
    "idCardUrl",
    "consent",
  ];

  const firstKey = fieldOrder.find((k) => errors[k]) || Object.keys(errors)[0];
  if (!firstKey) return;

  let targetEl: HTMLElement | null = null;
  if (firstKey === "state") {
    targetEl = document.getElementById("state-select");
  } else if (firstKey === "highestQualification") {
    targetEl = document.getElementById("qualification-select");
  } else if (firstKey === "cvUrl") {
    targetEl =
      document.getElementById("upload-cv")?.parentElement ||
      document.getElementById("upload-cv");
  } else if (firstKey === "passportPhotoUrl") {
    targetEl =
      document.getElementById("upload-passport")?.parentElement ||
      document.getElementById("upload-passport");
  } else if (firstKey === "idCardUrl") {
    targetEl =
      document.getElementById("upload-id-card")?.parentElement ||
      document.getElementById("upload-id-card");
  } else if (firstKey === "consent") {
    targetEl =
      document.getElementById("consent-checkbox") ||
      document.querySelector('input[name="consent"]');
  } else {
    targetEl = document.querySelector(`[name="${firstKey}"]`);
  }

  if (targetEl) {
    targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    targetEl.focus?.();
  }
}

export function ApplyForm() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApplicationSubmissionResult | null>(null);

  // Form state for custom uploads and selections
  const [cvUrl, setCvUrl] = useState<string>("");
  const [passportPhotoUrl, setPassportPhotoUrl] = useState<string>("");
  const [idCardUrl, setIdCardUrl] = useState<string>("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);

    const formData = new FormData(event.currentTarget);
    const candidate = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      residentialAddress: String(formData.get("residentialAddress") ?? "") || undefined,
      city: String(formData.get("city") ?? "") || undefined,
      state: String(formData.get("state") ?? "") || undefined,
      highestQualification: String(formData.get("highestQualification") ?? "") || undefined,
      institution: String(formData.get("institution") ?? "") || undefined,
      courseOfStudy: String(formData.get("courseOfStudy") ?? "") || undefined,
      graduationYear: String(formData.get("graduationYear") ?? "") || undefined,
      cvUrl: cvUrl || undefined,
      passportPhotoUrl: passportPhotoUrl || undefined,
      idCardUrl: idCardUrl || undefined,
      roleTitle: String(formData.get("roleTitle") ?? ""),
      consent: formData.get("consent") === "on",
    };

    // Client-side validation
    const errors: Record<string, string> = {};
    if (!candidate.fullName.trim()) errors.fullName = "Enter your full name";
    if (!candidate.email.trim()) errors.email = "Enter your email address";
    if (!candidate.phone.trim()) errors.phone = "Enter your phone number";
    if (!candidate.residentialAddress?.trim()) errors.residentialAddress = "Enter your contact/residential address";
    if (!candidate.city?.trim()) errors.city = "Enter your city";
    if (!candidate.state?.trim()) errors.state = "Select or enter your state of residence";
    if (!candidate.highestQualification?.trim()) errors.highestQualification = "Select your highest educational qualification";
    if (!candidate.institution?.trim()) errors.institution = "Enter institution / school attended";
    if (!candidate.courseOfStudy?.trim()) errors.courseOfStudy = "Enter your course or field of study";
    if (!candidate.graduationYear?.trim()) errors.graduationYear = "Enter your graduation year";
    if (!cvUrl) errors.cvUrl = "Please upload your Curriculum Vitae (CV / Resume)";
    if (!passportPhotoUrl) errors.passportPhotoUrl = "Please upload a clear passport photograph";
    if (!idCardUrl) errors.idCardUrl = "Please upload your National Means of Identification";
    if (!candidate.consent) errors.consent = "Please confirm the accuracy of your details before submitting";

    const parsed = applicationFormSchema.safeParse(candidate);
    if (!parsed.success) {
      Object.assign(errors, getFieldErrors(parsed.error));
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      const firstErrorMessage =
        Object.values(errors)[0] ||
        "Please fill in all required fields and upload your credentials.";
      setFormError(firstErrorMessage);
      toast("Please complete all required fields", {
        description: firstErrorMessage,
        variant: "danger",
      });
      setTimeout(() => {
        scrollToFirstError(errors);
      }, 50);
      return;
    }

    setFieldErrors({});

    setSubmitting(true);
    try {
      const data = await apiFetch<ApplicationSubmissionResult>(
        "/api/applications",
        { method: "POST", body: JSON.stringify(parsed.data) },
      );
      setResult(data);
      toast("Application submitted successfully", {
        description:
          "Save your reference number — you'll use it to continue your recruitment journey.",
        variant: "success",
      });
    } catch (error) {
      if (error instanceof ApiClientError && error.fields) {
        setFieldErrors(error.fields);
        const firstErrorMessage =
          Object.values(error.fields)[0] ||
          "Please check the highlighted fields.";
        setFormError(firstErrorMessage);
        toast("Application check required", {
          description: firstErrorMessage,
          variant: "danger",
        });
        setTimeout(() => {
          scrollToFirstError(error.fields!);
        }, 50);
      } else {
        const message =
          error instanceof ApiClientError
            ? error.message
            : "We couldn't submit your application. Please check your connection and try again.";
        setFormError(message);
        toast("Submission failed", {
          description: message,
          variant: "danger",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return <SubmissionConfirmation result={result} />;
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-8">
      <input type="hidden" name="roleTitle" value={OPEN_POSITION.title} />

      {formError && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Submission check required</Alert.Title>
            <Alert.Description>{formError}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {/* ── SECTION 1: BIO DATA & CONTACT DETAILS ── */}
      <section className="rounded-lg border border-border bg-surface/50 p-5 sm:p-6">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border">
          <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
            <UserCheck className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Bio Data &amp; Contact Details
            </h2>
            <p className="text-xs text-muted-foreground">
              Your official personal and contact information.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField name="fullName" isInvalid={Boolean(fieldErrors.fullName)}>
              <Label>
                Full name <span aria-hidden className="text-danger">*</span>
              </Label>
              <Input
                name="fullName"
                placeholder="Surname Firstname Middlename"
                autoComplete="name"
              />
              <Description>As it appears on your official documents.</Description>
              <FieldError>{fieldErrors.fullName}</FieldError>
            </TextField>
          </div>

          <TextField name="email" isInvalid={Boolean(fieldErrors.email)}>
            <Label>
              Email address <span aria-hidden className="text-danger">*</span>
            </Label>
            <Input
              type="email"
              name="email"
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
            />
            <Description>
              For application updates and appointment correspondence.
            </Description>
            <FieldError>{fieldErrors.email}</FieldError>
          </TextField>

          <TextField name="phone" isInvalid={Boolean(fieldErrors.phone)}>
            <Label>
              Phone number <span aria-hidden className="text-danger">*</span>
            </Label>
            <Input
              type="tel"
              name="phone"
              placeholder="0803 000 0000"
              autoComplete="tel"
              inputMode="tel"
            />
            <Description>
              WhatsApp-enabled phone number preferred.
            </Description>
            <FieldError>{fieldErrors.phone}</FieldError>
          </TextField>

          <div className="sm:col-span-2">
            <TextField
              name="residentialAddress"
              isInvalid={Boolean(fieldErrors.residentialAddress)}
            >
              <Label>
                Contact / Residential Address{" "}
                <span aria-hidden className="text-danger">*</span>
              </Label>
              <Input
                name="residentialAddress"
                placeholder="Street address, area, landmark"
                autoComplete="street-address"
              />
              <Description>Where you are currently residing.</Description>
              <FieldError>{fieldErrors.residentialAddress}</FieldError>
            </TextField>
          </div>

          <TextField name="city" isInvalid={Boolean(fieldErrors.city)}>
            <Label>
              City / Town <span aria-hidden className="text-danger">*</span>
            </Label>
            <Input
              name="city"
              placeholder="e.g. Ikeja, Port Harcourt, Ibadan"
              autoComplete="address-level2"
            />
            <FieldError>{fieldErrors.city}</FieldError>
          </TextField>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="state-select"
              className="text-sm font-semibold text-foreground"
            >
              State of Residence{" "}
              <span aria-hidden className="text-danger">*</span>
            </label>
            <select
              id="state-select"
              name="state"
              defaultValue=""
              className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="" disabled>
                Select state of residence
              </option>
              {NIGERIAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
            {fieldErrors.state && (
              <p className="text-xs text-danger">{fieldErrors.state}</p>
            )}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: EDUCATIONAL DETAILS ── */}
      <section className="rounded-lg border border-border bg-surface/50 p-5 sm:p-6">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border">
          <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
            <GraduationCap className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Educational Details
            </h2>
            <p className="text-xs text-muted-foreground">
              Your highest academic qualification and background.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label
              htmlFor="qualification-select"
              className="text-sm font-semibold text-foreground"
            >
              Highest Educational Qualification{" "}
              <span aria-hidden className="text-danger">*</span>
            </label>
            <select
              id="qualification-select"
              name="highestQualification"
              defaultValue=""
              className="min-h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="" disabled>
                Select your highest qualification
              </option>
              {QUALIFICATIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
            {fieldErrors.highestQualification && (
              <p className="text-xs text-danger">
                {fieldErrors.highestQualification}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <TextField
              name="institution"
              isInvalid={Boolean(fieldErrors.institution)}
            >
              <Label>
                Institution / School Attended{" "}
                <span aria-hidden className="text-danger">*</span>
              </Label>
              <Input
                name="institution"
                placeholder="e.g. University of Lagos, Yaba College of Technology"
              />
              <FieldError>{fieldErrors.institution}</FieldError>
            </TextField>
          </div>

          <TextField
            name="courseOfStudy"
            isInvalid={Boolean(fieldErrors.courseOfStudy)}
          >
            <Label>
              Course of Study / Major{" "}
              <span aria-hidden className="text-danger">*</span>
            </Label>
            <Input
              name="courseOfStudy"
              placeholder="e.g. Business Administration, Economics, Computer Science"
            />
            <FieldError>{fieldErrors.courseOfStudy}</FieldError>
          </TextField>

          <TextField
            name="graduationYear"
            isInvalid={Boolean(fieldErrors.graduationYear)}
          >
            <Label>
              Year of Graduation / Completion{" "}
              <span aria-hidden className="text-danger">*</span>
            </Label>
            <Input
              name="graduationYear"
              placeholder="e.g. 2023"
              maxLength={4}
            />
            <FieldError>{fieldErrors.graduationYear}</FieldError>
          </TextField>
        </div>
      </section>

      {/* ── SECTION 3: CREDENTIALS & DOCUMENTS (CLOUDINARY) ── */}
      <section className="rounded-lg border border-border bg-surface/50 p-5 sm:p-6">
        <div className="flex items-center gap-2.5 pb-2 border-b border-border">
          <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
            <FileCheck2 className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Upload Credentials &amp; Documents
            </h2>
            <p className="text-xs text-muted-foreground">
              Securely uploaded to Cloudinary for verification.
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          <FileUploadField
            label="Curriculum Vitae (CV / Resume)"
            description="Upload your latest CV in PDF, DOC, or DOCX format."
            accept=".pdf,.doc,.docx"
            documentType="cv"
            value={cvUrl}
            onChange={(url) => {
              setCvUrl(url);
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.cvUrl;
                return next;
              });
            }}
            error={fieldErrors.cvUrl}
          />

          <FileUploadField
            label="Passport Photograph"
            description="Clear front-facing passport photograph with a plain background (JPG, PNG, or WEBP)."
            accept="image/jpeg,image/png,image/webp"
            documentType="passport"
            value={passportPhotoUrl}
            onChange={(url) => {
              setPassportPhotoUrl(url);
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.passportPhotoUrl;
                return next;
              });
            }}
            error={fieldErrors.passportPhotoUrl}
          />

          <FileUploadField
            label="National Means of Identification"
            description="NIN Slip, Permanent Voter's Card, Driver's License, or International Passport."
            accept=".pdf,image/jpeg,image/png,image/webp"
            documentType="id_card"
            value={idCardUrl}
            onChange={(url) => {
              setIdCardUrl(url);
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.idCardUrl;
                return next;
              });
            }}
            error={fieldErrors.idCardUrl}
          />
        </div>
      </section>

      {/* ── CONSENT & SUBMISSION ── */}
      <div className="pt-2">
        <Checkbox id="consent-checkbox" name="consent" isInvalid={Boolean(fieldErrors.consent)}>
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <span className="text-sm leading-6">
              I confirm that the bio data, educational details, and uploaded credentials provided are authentic and accurate.
              <span aria-hidden className="text-danger"> *</span>
            </span>
          </Checkbox.Content>
          <FieldError>{fieldErrors.consent}</FieldError>
        </Checkbox>
      </div>

      <Button
        type="submit"
        isPending={submitting}
        size="lg"
        fullWidth
        className="sm:w-auto sm:self-start"
      >
        {({ isPending }) => (
          <>
            {isPending && <Spinner color="current" size="sm" />}
            {isPending ? "Submitting application…" : "Submit application"}
          </>
        )}
      </Button>
    </form>
  );
}

function SubmissionConfirmation({
  result,
}: {
  result: ApplicationSubmissionResult;
}) {
  const [copied, setCopied] = useState(false);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(result.referenceNumber);
      setCopied(true);
      toast("Reference number copied");
    } catch {
      // Clipboard unavailable
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Application received
        </h2>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          Thank you — your application for the Marketing &amp; Customer Care Executive
          role has been submitted successfully with your bio data, educational
          details, and uploaded credentials. Save your reference number
          somewhere safe; it identifies your whole application journey and you&apos;ll
          use it every time you return.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted-foreground">Your reference number</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <span className="font-mono text-xl font-bold tracking-widest text-foreground">
            {result.referenceNumber}
          </span>
          <Button size="sm" variant="outline" onPress={copyReference}>
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>

      <Alert status="accent">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>What happens next</Alert.Title>
          <Alert.Description>
            Your orientation is ready now. It covers how FinFam works, your
            role, and the standards expected from every team member. You can
            start it straight away — your progress is saved as you go.
          </Alert.Description>
        </Alert.Content>
      </Alert>

      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href={`/orientation/${result.referenceNumber}`}>
          Continue to orientation
        </ButtonLink>
        <ButtonLink
          href={`/application/${result.referenceNumber}`}
          variant="outline"
        >
          View your application journey
        </ButtonLink>
      </div>
    </div>
  );
}
