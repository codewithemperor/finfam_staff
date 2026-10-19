"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, RefreshCw, Loader2, CreditCard } from "lucide-react";
import { Button, Alert } from "@heroui/react";

import { StaffIdCard, StaffIdCardBack } from "@/components/id-card/staff-id-card";
import { PrintButton } from "@/components/appointment/print-button";
import { ButtonLink } from "@/components/ui/button-link";
import { FileUploadField } from "@/components/forms/file-upload-field";
import {
  STAFF_ID_CARD_ABOUT_IS,
  STAFF_ID_CARD_ABOUT_IS_NOT,
  STAFF_ID_CARD_DISCLAIMER,
} from "@/config/staff-id-card";

interface StaffIdCardViewProps {
  fullName: string;
  staffId: string;
  role: string;
  workArrangement: string;
  activatedAtLabel: string;
  initialPassportUrl?: string | null;
}

export function StaffIdCardView({
  fullName,
  staffId,
  role,
  workArrangement,
  activatedAtLabel,
  initialPassportUrl,
}: StaffIdCardViewProps) {
  const router = useRouter();
  const [passportUrl, setPassportUrl] = useState<string>(initialPassportUrl || "");
  const [pendingUploadUrl, setPendingUploadUrl] = useState<string>("");
  const [cardSideView, setCardSideView] = useState<"BOTH" | "FRONT" | "BACK">("BOTH");
  const [isEditingPhoto, setIsEditingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSavePassport(urlToSave: string) {
    if (!urlToSave) {
      setErrorMessage("Please select and upload a passport photo first.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/staff/passport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passportPhotoUrl: urlToSave }),
      });

      const json = await response.json();
      if (!response.ok || !json.ok) {
        throw new Error(json.error?.message || "Failed to save passport photo.");
      }

      setPassportUrl(urlToSave);
      setPendingUploadUrl("");
      setIsEditingPhoto(false);
      setSuccessMessage("Passport photo saved successfully.");
      router.refresh();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save passport photo.");
    } finally {
      setIsSaving(false);
    }
  }

  // Gate: If staff does not have a passport photo yet, require upload first
  if (!passportUrl) {
    return (
      <div className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-xs sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Camera className="size-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Passport Photograph Required
            </h2>
            <p className="text-sm text-muted-foreground">
              Upload your passport photograph to view and print your official FinFam Staff Identity Card.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-4">
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Upload Error</Alert.Title>
                <Alert.Description>{errorMessage}</Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        )}

        <div className="mt-6">
          <FileUploadField
            label="Passport Photograph"
            description="Clear portrait, plain background, max 5MB (JPG, PNG)"
            accept=".jpg,.jpeg,.png,.webp"
            documentType="passport"
            value={pendingUploadUrl}
            onChange={(url) => {
              setPendingUploadUrl(url);
              setErrorMessage(null);
            }}
            required
          />
        </div>

        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 space-y-1">
          <p className="font-semibold text-foreground">Photo Guidelines:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Ensure a clear, forward-facing view of your face.</li>
            <li>Use a plain white or light-coloured background.</li>
            <li>Ensure good lighting without heavy shadows or glare.</li>
            <li>Maximum file size is 5MB.</li>
          </ul>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <ButtonLink href="/staff/profile" variant="ghost" size="sm">
            Back to Profile
          </ButtonLink>
          <Button
            variant="primary"
            isDisabled={!pendingUploadUrl || isSaving}
            onPress={() => handleSavePassport(pendingUploadUrl)}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save & View ID Card"
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Alert notices in non-print mode */}
      <div className="print:hidden">
        {successMessage && (
          <div className="mb-4">
            <Alert status="success">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{successMessage}</Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        )}
        {errorMessage && (
          <div className="mb-4">
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Error</Alert.Title>
                <Alert.Description>{errorMessage}</Alert.Description>
              </Alert.Content>
            </Alert>
          </div>
        )}
      </div>

      {/* Side Switcher (Front / Back / Both) */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-1">
          <button
            type="button"
            onClick={() => setCardSideView("BOTH")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              cardSideView === "BOTH"
                ? "bg-white text-zinc-900 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <CreditCard className="mr-1.5 inline-block size-3.5" />
            Both Sides
          </button>
          <button
            type="button"
            onClick={() => setCardSideView("FRONT")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              cardSideView === "FRONT"
                ? "bg-white text-zinc-900 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Front Side
          </button>
          <button
            type="button"
            onClick={() => setCardSideView("BACK")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              cardSideView === "BACK"
                ? "bg-white text-zinc-900 shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Back Side
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onPress={() => {
              setIsEditingPhoto(!isEditingPhoto);
              setPendingUploadUrl("");
              setErrorMessage(null);
            }}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            {isEditingPhoto ? "Close Photo Editor" : "Change Passport Photo"}
          </Button>
          <PrintButton />
        </div>
      </div>

      {/* Change Photo Section */}
      {isEditingPhoto && (
        <div className="mt-6 rounded-lg border border-border bg-surface p-5 shadow-xs print:hidden">
          <h3 className="text-sm font-semibold text-foreground">
            Update Passport Photograph
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Select a new passport photo. Your ID card will update immediately.
          </p>
          <div className="mt-4">
            <FileUploadField
              label="New Passport Photograph"
              description="Max 5MB (JPG, PNG)"
              accept=".jpg,.jpeg,.png,.webp"
              documentType="passport"
              value={pendingUploadUrl}
              onChange={(url) => {
                setPendingUploadUrl(url);
                setErrorMessage(null);
              }}
              required
            />
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onPress={() => {
                setIsEditingPhoto(false);
                setPendingUploadUrl("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              isDisabled={!pendingUploadUrl || isSaving}
              onPress={() => handleSavePassport(pendingUploadUrl)}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save New Photo"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* The ID Card Display Area */}
      <div className="mt-6 print:mt-0">
        {cardSideView === "BOTH" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 print:grid-cols-1 print:gap-4">
            {/* Front */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground print:hidden">
                Front Side
              </p>
              <StaffIdCard
                fullName={fullName}
                staffId={staffId}
                role={role}
                workArrangement={workArrangement}
                activatedAtLabel={activatedAtLabel}
                passportPhotoUrl={passportUrl}
              />
            </div>

            {/* Back */}
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground print:hidden">
                Back Side
              </p>
              <StaffIdCardBack staffId={staffId} />
            </div>
          </div>
        ) : cardSideView === "FRONT" ? (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground print:hidden">
              Front Side
            </p>
            <StaffIdCard
              fullName={fullName}
              staffId={staffId}
              role={role}
              workArrangement={workArrangement}
              activatedAtLabel={activatedAtLabel}
              passportPhotoUrl={passportUrl}
            />
          </div>
        ) : (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground print:hidden">
              Back Side
            </p>
            <StaffIdCardBack staffId={staffId} />
          </div>
        )}
      </div>

      {/* Supporting details and disclaimer (hidden during print) */}
      <div className="mt-8 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/staff/profile" variant="ghost" size="sm">
            Back to Profile
          </ButtonLink>
        </div>

        <p className="mt-6 max-w-[60ch] text-sm leading-6 text-muted-foreground">
          {STAFF_ID_CARD_DISCLAIMER}
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <section aria-labelledby="id-card-about-is">
            <h2 id="id-card-about-is" className="text-sm font-semibold text-foreground">
              What this card is
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
              {STAFF_ID_CARD_ABOUT_IS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-1 size-3.5 shrink-0 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="id-card-about-is-not">
            <h2 id="id-card-about-is-not" className="text-sm font-semibold text-foreground">
              What it is not
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm leading-6 text-muted-foreground">
              {STAFF_ID_CARD_ABOUT_IS_NOT.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-2.5 size-1.5 shrink-0 rounded-full bg-zinc-300"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
