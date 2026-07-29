import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Lock } from "lucide-react";
import { AccountLayout } from "@/components/account/AccountLayout";
import { DocumentUpload } from "@/components/account/DocumentUpload";
import { ActionButton } from "@/components/dashboard/PageHeader";
import { CheckboxField, SelectField, TextAreaField, TextField } from "@/components/dashboard/forms";
import { useKycStatus, useSession, useSubmitKyc } from "@/lib/account/session";
import {
  ID_TYPES,
  ID_TYPE_LABELS,
  KYC_DOC_TYPES,
  type IdType,
  type KycDocType,
} from "../../../../backend/src/types";

/**
 * KYC: personal information plus identity documents.
 *
 * Reachable at the `kyc_required` and `kyc_rejected` gates. A rejected case lands
 * here to resubmit; a pending one cannot reach it at all, because the server
 * refuses to overwrite a case that is under review.
 */

const REQUIRED_DOCS: KycDocType[] = ["id_front", "selfie"];
const OPTIONAL_DOCS = KYC_DOC_TYPES.filter((type) => !REQUIRED_DOCS.includes(type));

export default function VerifyIdentity() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: kyc } = useKycStatus();
  const submitKyc = useSubmitKyc();

  const [idType, setIdType] = useState<IdType>("nin");
  const [idNumber, setIdNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [bvn, setBvn] = useState("");
  const [employerName, setEmployerName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Pre-fill the document type from a previous attempt so a resubmission is not
  // typed from scratch. The identifier itself is NOT pre-filled: the server only
  // returns its last four digits, by design.
  useEffect(() => {
    if (kyc?.idType) setIdType(kyc.idType);
  }, [kyc?.idType]);

  const uploaded = new Map((kyc?.documents ?? []).map((doc) => [doc.docType, doc]));
  const missing = kyc?.missingDocuments ?? REQUIRED_DOCS;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      const result = await submitKyc.mutateAsync({
        idType,
        idNumber,
        dateOfBirth,
        address,
        city,
        state,
        country: "NG",
        bvn: bvn || "",
        employerName: employerName || "",
        occupation: occupation || "",
        declarationAccepted: true,
      });
      if (result.submitted) {
        navigate("/account", { replace: true });
      } else {
        setNotice(result.message ?? "Your details are saved. Upload the remaining documents to submit.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not save your details. Please try again.");
    }
  };

  const isResubmission = kyc?.status === "rejected";

  return (
    <AccountLayout
      eyebrow="Step 2 of 2"
      title={isResubmission ? "Update your identity verification" : "Verify your identity"}
      description="Regulation requires us to confirm who you are before your account can hold or move money. This usually takes one working day."
    >
      {isResubmission && kyc?.rejectionReason ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <p className="text-sm font-semibold text-destructive">Why your last submission was not approved</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{kyc.rejectionReason}</p>
        </div>
      ) : null}

      <form onSubmit={submit} className="space-y-8" noValidate>
        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground">Personal information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Full name"
              value={session?.user?.fullName ?? ""}
              onChange={() => undefined}
              disabled
              hint="Taken from your account. Contact support to change it."
            />
            <TextField
              label="Date of birth"
              type="date"
              value={dateOfBirth}
              onChange={setDateOfBirth}
              hint="You must be 18 or older."
            />
            <SelectField
              label="Identity document"
              value={idType}
              onChange={(value) => setIdType(value as IdType)}
              options={ID_TYPES.map((type) => ({ value: type, label: ID_TYPE_LABELS[type] }))}
            />
            <TextField
              label="Document number"
              value={idNumber}
              onChange={setIdNumber}
              placeholder="As printed on the document"
              hint={kyc?.idNumberLast4 ? `Previously submitted: ending ${kyc.idNumberLast4}` : undefined}
            />
            <TextField
              label="BVN"
              value={bvn}
              onChange={setBvn}
              optional
              inputMode="numeric"
              placeholder="11 digits"
            />
            <TextField label="Occupation" value={occupation} onChange={setOccupation} optional />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg font-extrabold text-foreground">Residential address</h2>
          <TextAreaField
            label="Street address"
            value={address}
            onChange={setAddress}
            rows={2}
            placeholder="House number, street, area"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="City" value={city} onChange={setCity} />
            <TextField label="State" value={state} onChange={setState} />
          </div>
          {session?.user?.accountType === "employee" ? (
            <TextField label="Employer name" value={employerName} onChange={setEmployerName} optional />
          ) : null}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="font-display text-lg font-extrabold text-foreground">Documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Photos must be sharp and uncropped, with all four corners visible.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {REQUIRED_DOCS.map((docType) => (
              <DocumentUpload key={docType} docType={docType} required existing={uploaded.get(docType)} />
            ))}
          </div>
          <details className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">
              Add supporting documents (optional)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {OPTIONAL_DOCS.map((docType) => (
                <DocumentUpload key={docType} docType={docType} required={false} existing={uploaded.get(docType)} />
              ))}
            </div>
          </details>
          {missing.length > 0 ? (
            <p className="text-xs font-medium text-muted-foreground">
              Still needed before you can submit: {missing.map((doc) => doc.replace(/_/g, " ")).join(", ")}.
            </p>
          ) : null}
        </section>

        <section className="space-y-4">
          <CheckboxField checked={declarationAccepted} onChange={setDeclarationAccepted}>
            I confirm that the information and documents I have provided are accurate and belong to me.
          </CheckboxField>

          {error ? (
            <p className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3 text-sm font-medium text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ) : null}

          {notice ? (
            <p className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-3 text-sm font-medium text-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {notice}
            </p>
          ) : null}

          <ActionButton
            type="submit"
            size="lg"
            loading={submitKyc.isPending}
            disabled={!declarationAccepted}
            icon={<ArrowRight className="h-4 w-4" />}
          >
            {isResubmission ? "Resubmit for review" : "Submit for review"}
          </ActionButton>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            Your document number, date of birth and address are encrypted before they are written to our database.
            Only the reviewer handling your case can open them.
          </p>
        </section>
      </form>
    </AccountLayout>
  );
}
