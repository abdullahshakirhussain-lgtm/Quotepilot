"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { ArrowRight, CalendarCheck, ChevronRight, Loader2, Mail, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CURRENCIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { defaultQuoteBody, defaultQuoteSubject } from "@/lib/quote-email";
import { cleanPasted, isValidEmail } from "@/lib/email-address";
import { EARLIEST_SENT_DATE, LIMITS, MAX_AMOUNT } from "@/lib/quote-flows";
import { QuoteEmailPreview } from "./QuoteEmailPreview";
import { QuoteDonePanel } from "./QuoteDonePanel";
import { AddBusinessEmailButton } from "@/components/ui/AddBusinessEmailButton";
import {
  sendDraftQuoteEmail,
  sendQuoteWithQuoteLoop,
  trackQuoteAlreadySent,
} from "@/app/(app)/quotes/new-quote-actions";

type Outcome = Awaited<ReturnType<typeof trackQuoteAlreadySent>>;
type Success = Extract<Outcome, { ok: true }>;

export interface QuoteCustomer {
  id: string;
  customer_name: string;
  company_name: string | null;
  email: string | null;
}

const SENT_METHODS = ["Email", "WhatsApp", "Phone", "Text message", "In person", "Other"];

/** Same limit the server enforces for an email body. */
const MAX_EMAIL_LENGTH = 10_000;

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="tap inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-900 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
        {label}
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

/**
 * New quote, in the user's own words: either QuoteLoop sends the quote email,
 * or the user records a quote they already sent. Both end with follow-up
 * reminders and a confirmation that says what happens next.
 */
export function NewQuoteModal({
  customers,
  defaultCurrency,
  today,
  business,
  emailEnabled,
  preselectCustomerId,
  onClose,
  onSaved,
  onWriteFollowUp,
}: {
  customers: QuoteCustomer[];
  defaultCurrency: string;
  /** Viewer's local date from the server. */
  today: string;
  business: { name: string; ownerName: string | null; email: string | null };
  /** Whether this workspace can send email at all. */
  emailEnabled: boolean;
  preselectCustomerId?: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  onWriteFollowUp: (quoteId: string) => void;
}) {
  const preselected = customers.find((c) => c.id === preselectCustomerId);
  const [step, setStep] = useState<"choose" | "form" | "preview" | "done">("choose");
  const [flow, setFlow] = useState<"send" | "track">("send");
  const [customerMode, setCustomerMode] = useState<"new" | "existing">(
    preselected ? "existing" : "new"
  );
  const [leadId, setLeadId] = useState(preselected?.id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [sentDate, setSentDate] = useState(today);
  const [validUntil, setValidUntil] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [sentMethod, setSentMethod] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bodyEdited, setBodyEdited] = useState(false);
  const [subjectEdited, setSubjectEdited] = useState(false);
  // The quote details the email text was written from, to notice later edits.
  const [bodyBasis, setBodyBasis] = useState("");
  // Details the user was warned about and chose to send the edited text anyway.
  const [staleAcknowledged, setStaleAcknowledged] = useState("");
  // The customer's saved address changed after the preview was shown, for the
  // customer and typed address it was found for.
  const [override, setOverride] = useState<{ basis: string; to: string } | null>(null);
  // The details a "looks like a quote you already added" warning was shown for:
  // pressing the button again with the same details saves it anyway.
  const [duplicateBasis, setDuplicateBasis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The "add a business email first" refusal, so its way out shows only under it.
  const [businessEmailError, setBusinessEmailError] = useState<string | null>(null);
  const needsBusinessEmail = error !== null && error === businessEmailError;
  // An unclear send outcome must not offer a second send.
  const [sendLocked, setSendLocked] = useState(false);
  // Set once a failed send has saved the quote as a draft: retries send that
  // draft instead of creating a second quote.
  const [savedDraftId, setSavedDraftId] = useState<string | null>(null);
  const [result, setResult] = useState<Success | null>(null);
  const [busy, startAction] = useTransition();

  const selected = customers.find((c) => c.id === leadId) ?? null;
  const customerLabel =
    customerMode === "existing" ? (selected?.customer_name ?? "") : customerName.trim();
  const savedEmail = customerMode === "existing" ? (selected?.email?.trim() ?? "") : "";
  const typedEmail = cleanPasted(email);
  const recipientBasis = JSON.stringify([customerMode, leadId, typedEmail]);
  const recipientOverride = override?.basis === recipientBasis ? override.to : null;
  const effectiveEmail = recipientOverride ?? (savedEmail || typedEmail);

  // What the quote email is written from. If it changes after the user edited
  // the text, the text may still mention the old title or amount.
  const detailsBasis = JSON.stringify([customerLabel, title.trim(), amount, currency, description.trim(), validUntil]);
  const staleEmail = step === "preview" && bodyEdited && bodyBasis !== "" && bodyBasis !== detailsBasis;
  const duplicateWarned =
    duplicateBasis ===
    JSON.stringify([recipientBasis, customerName.trim(), phone.trim(), title.trim(), amount, currency, sentDate]);

  function fields() {
    return {
      customerMode,
      leadId: customerMode === "existing" ? leadId : null,
      customerName: customerName.trim(),
      // Only an address the user typed. A saved customer's address stays on
      // the server, so a stale copy here can never be written back.
      email: customerMode === "existing" && savedEmail ? "" : typedEmail,
      // The address the preview shows: the server refuses if it has changed.
      expectedTo: flow === "send" ? effectiveEmail : null,
      allowDuplicate: flow === "track" && duplicateWarned,
      phone: phone.trim(),
      companyName: companyName.trim(),
      title: title.trim(),
      amount,
      currency,
      sentDate: flow === "send" ? today : sentDate,
      validUntil: validUntil || null,
      description: description.trim() || null,
      notes: notes.trim() || null,
      sentMethod: flow === "track" ? sentMethod.trim() || null : null,
      subject,
      message: body,
    };
  }

  /** Same rules as the server, checked early so the user isn't surprised. */
  function clientProblem(): string | null {
    if (customerMode === "existing" && !leadId) return "Choose which customer this quote is for.";
    if (customerMode === "new" && !customerName.trim()) return "Enter the customer's name.";
    if (flow === "send" && !effectiveEmail) {
      return "Enter the customer's email address so QuoteLoop can send the quote.";
    }
    if (typedEmail && !(customerMode === "existing" && savedEmail) && !isValidEmail(typedEmail)) {
      return flow === "send"
        ? "That email address doesn't look right. Check it and try again."
        : "That email address doesn't look right. Leave it empty if you don't have one.";
    }
    if (!title.trim()) return "Add a short title for the quote, like “Service 3 AC units”.";
    const value = Number(String(amount).replace(/[, ]/g, ""));
    if (!String(amount).trim() || !Number.isFinite(value) || value <= 0) {
      return "Enter the quote amount as a number greater than zero.";
    }
    if (value > MAX_AMOUNT) return "That amount is too large. Check the number and try again.";
    if (flow === "track" && !sentDate) return "Enter the date you sent this quote.";
    if (flow === "track" && sentDate > today) return "The sent date can't be in the future.";
    if (flow === "track" && sentDate < EARLIEST_SENT_DATE) {
      return "That sent date looks too far in the past. Check the year.";
    }
    if (validUntil && validUntil < (flow === "send" ? today : sentDate)) {
      return flow === "send"
        ? "The valid-until date can't be before today."
        : "The valid-until date can't be before the sent date.";
    }
    if (description.trim().length > LIMITS.description) {
      return `The description is too long. Keep it under ${LIMITS.description.toLocaleString("en-US")} characters.`;
    }
    if (notes.trim().length > LIMITS.notes) {
      return `The notes are too long. Keep them under ${LIMITS.notes.toLocaleString("en-US")} characters.`;
    }
    return null;
  }

  // Anything typed that closing the window would throw away.
  const dirty =
    step !== "done" &&
    [customerName, email, phone, companyName, title, amount, description, notes, validUntil].some((v) => v.trim() !== "");

  /** Never close mid-send (the result would be lost), and ask before discarding typing. */
  function requestClose() {
    if (busy) return;
    if (savedDraftId) {
      // The quote itself is safe as a draft; only edited email text would go.
      if (bodyEdited && !window.confirm("Close this window? Your quote is saved as a draft, but the email text you edited won't be kept.")) {
        return;
      }
    } else if (dirty && !window.confirm("Close without saving this quote? What you typed will be lost.")) {
      return;
    }
    onClose();
  }

  // Replies to a quote email go to the business email, so sending needs one.
  const canSendEmail = emailEnabled && isValidEmail(business.email);

  /** The email as QuoteLoop would write it from the details as they are now. */
  function writeEmail(options: { keepEditedSubject: boolean }) {
    if (!options.keepEditedSubject) {
      setSubject(defaultQuoteSubject(business.name, title.trim()));
      setSubjectEdited(false);
    }
    setBody(
      defaultQuoteBody({
        customerName: customerLabel,
        businessName: business.name,
        ownerName: business.ownerName,
        title: title.trim(),
        amount: Number(amount),
        currency,
        description: description.trim() || null,
        validUntil: validUntil || null,
      })
    );
    setBodyEdited(false);
    setBodyBasis(detailsBasis);
  }

  function goToPreview() {
    const problem = clientProblem();
    if (problem) return setError(problem);
    // Text the user hasn't touched always follows the details. Edited text is
    // kept (see the notice on the preview if the details changed since).
    if (!bodyEdited) writeEmail({ keepEditedSubject: subjectEdited });
    else if (!subjectEdited) setSubject(defaultQuoteSubject(business.name, title.trim()));
    setError(null);
    setStep("preview");
  }

  function submit(kind: "send" | "track") {
    // A second press must never start a second send.
    if (busy || (kind === "send" && sendLocked)) return;
    if (kind === "send" && staleEmail && staleAcknowledged !== detailsBasis) {
      // Asked once: pressing Send again sends the text as it is.
      setStaleAcknowledged(detailsBasis);
      return setError(
        "You changed the quote details after editing this email, so it may still mention the old ones. Check the text and press Send quote email again, or use “Rewrite with the new details”."
      );
    }
    if (kind === "send" && body.trim().length > MAX_EMAIL_LENGTH) {
      return setError(
        `This email is too long to send. Keep it under ${MAX_EMAIL_LENGTH.toLocaleString("en-US")} characters.`
      );
    }
    const problem = clientProblem();
    if (problem) return setError(problem);
    setError(null);
    startAction(async () => {
      let outcome: Outcome;
      try {
        outcome =
          kind === "track"
            ? await trackQuoteAlreadySent(fields())
            : savedDraftId
              ? await sendDraftQuoteEmail({ quoteId: savedDraftId, subject, message: body, expectedTo: effectiveEmail })
              : await sendQuoteWithQuoteLoop(fields());
      } catch (e) {
        unstable_rethrow(e); // a redirect Next is handling itself must not be swallowed
        if (kind === "send") setSendLocked(true);
        setError(
          kind === "send"
            ? "We couldn't confirm whether the quote email was sent. Check this customer's quotes before trying again."
            : "The quote couldn't be saved just now. Please try again."
        );
        return;
      }
      if (!outcome.ok) {
        if (outcome.quoteId) setSavedDraftId(outcome.quoteId);
        if (outcome.unconfirmed || outcome.locked) setSendLocked(true);
        // Show where it would go now; pressing Send again confirms that address.
        if (outcome.recipientChanged) setOverride({ basis: recipientBasis, to: outcome.recipientChanged });
        if (outcome.needsBusinessEmail) setBusinessEmailError(outcome.error);
        // Shown once; pressing the button again with the same details saves it anyway.
        if (outcome.duplicate) {
          setDuplicateBasis(
            JSON.stringify([recipientBasis, customerName.trim(), phone.trim(), title.trim(), amount, currency, sentDate])
          );
        }
        setError(outcome.error);
        return;
      }
      setResult(outcome);
      setStep("done");
      onSaved(
        kind === "send"
          ? "Quote email sent. Follow-up reminders are scheduled."
          : outcome.followUpDueNow
            ? "Quote saved. This quote already needs a follow-up."
            : "Quote saved. QuoteLoop will remind you when to follow up."
      );
    });
  }

  function startAnother() {
    setStep("choose");
    setResult(null);
    setError(null);
    setSendLocked(false);
    setSavedDraftId(null);
    setCustomerMode("new");
    setLeadId("");
    setCustomerName("");
    setEmail("");
    setPhone("");
    setCompanyName("");
    setTitle("");
    setAmount("");
    setSentDate(today);
    setValidUntil("");
    setDescription("");
    setNotes("");
    setSentMethod("");
    setSubject("");
    setBody("");
    setBodyEdited(false);
    setSubjectEdited(false);
    setBodyBasis("");
    setStaleAcknowledged("");
    setOverride(null);
    setDuplicateBasis(null);
  }

  const heading =
    step === "choose"
      ? { title: "What are you doing?", description: "Two ways to add a quote." }
      : step === "form"
        ? flow === "send"
          ? {
              title: "Send a quote with QuoteLoop",
              description: "QuoteLoop emails the quote, then starts your follow-up reminders.",
            }
          : {
              title: "Track a quote already sent",
              description: "You sent it yourself; QuoteLoop reminds you to follow up.",
            }
        : step === "preview"
          ? { title: "Preview quote email", description: "This is what your customer receives." }
          : result?.recipient
            ? { title: "Quote email sent", description: "QuoteLoop scheduled your follow-up reminders." }
            : {
                title: "Follow-up tracking started",
                description: result?.followUpDueNow
                  ? "Reminders were counted from the date you sent it, so this one is already due."
                  : "QuoteLoop will remind you when it is time to follow up.",
              };

  const errorBox = error && (
    <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-inset ring-red-200">
      {error}
      {needsBusinessEmail && (
        <div className="mt-2 flex flex-wrap gap-2">
          <AddBusinessEmailButton unsaved={savedDraftId ? bodyEdited : dirty} />
          {/* Not once a draft is saved: tracking would add a second quote. */}
          {!savedDraftId && (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                setFlow("track");
                setStep("form");
                setError(null);
              }}
            >
              Track this quote instead
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <Modal open onClose={requestClose} size="lg" title={heading.title} description={heading.description}>
      {step === "choose" && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={!canSendEmail}
            onClick={() => {
              setFlow("send");
              setError(null);
              setStep("form");
            }}
            className="rounded-lg border border-stone-200 p-4 text-left transition-colors hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex items-center gap-2 font-medium text-stone-900">
              <Mail className="h-4 w-4 text-brand-600" />
              Send a quote with QuoteLoop
              <ArrowRight className="ml-auto h-4 w-4 text-stone-400" />
            </span>
            <span className="mt-1 block text-sm text-stone-500">
              Create a quote email, send it to the customer, and schedule follow-up reminders.
            </span>
            {!emailEnabled ? (
              <span className="mt-2 block text-xs text-stone-500">
                Email sending isn&apos;t set up for this workspace yet.
              </span>
            ) : (
              !canSendEmail && (
                <span className="mt-2 block text-xs text-stone-500">
                  Add your business email in Settings before sending from QuoteLoop.
                </span>
              )
            )}
          </button>
          {emailEnabled && !canSendEmail && (
            <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <AddBusinessEmailButton unsaved={dirty} />
              <span className="text-xs text-stone-500">Or track a quote you already sent:</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setFlow("track");
              setError(null);
              setStep("form");
            }}
            className="rounded-lg border border-stone-200 p-4 text-left transition-colors hover:border-stone-400 hover:bg-stone-50"
          >
            <span className="flex items-center gap-2 font-medium text-stone-900">
              <CalendarCheck className="h-4 w-4 text-stone-500" />
              Track a quote already sent
              <ArrowRight className="ml-auto h-4 w-4 text-stone-400" />
            </span>
            <span className="mt-1 block text-sm text-stone-500">
              Add a quote you sent elsewhere and let QuoteLoop remind you to follow up, counting from
              the day you sent it.
            </span>
          </button>
        </div>
      )}

      {step === "form" && (
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="eyebrow">Customer</span>
              {customers.length > 0 && (
                <div className="inline-flex rounded-md border border-stone-300 p-0.5 text-xs font-medium">
                  {(["new", "existing"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCustomerMode(m)}
                      className={cn(
                        "tap rounded px-2.5 py-1 transition-colors",
                        customerMode === m ? "bg-stone-900 text-white" : "text-stone-600 hover:text-stone-900"
                      )}
                    >
                      {m === "new" ? "New customer" : "Existing customer"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {customerMode === "existing" ? (
              <>
                <Field label="Which customer?" htmlFor="q-lead">
                  <select id="q-lead" className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)}>
                    <option value="" disabled>
                      Choose a customer…
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.customer_name}
                        {c.company_name ? ` — ${c.company_name}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                {flow === "send" && selected && savedEmail && (
                  <p className="text-sm text-stone-600">
                    The quote goes to <span className="font-medium text-stone-900">{savedEmail}</span>.
                  </p>
                )}
                {flow === "send" && selected && !savedEmail && (
                  <Field
                    label="Customer email"
                    htmlFor="q-email"
                    hint="Saved to this customer, so you can email follow-ups too."
                  >
                    <input
                      id="q-email"
                      type="email"
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                    />
                  </Field>
                )}
              </>
            ) : (
              <>
                <Field label="Customer name" htmlFor="q-name">
                  <input
                    id="q-name"
                    autoFocus
                    maxLength={LIMITS.customerName}
                    className="input"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Marcus Reed"
                  />
                </Field>
                {flow === "send" && (
                  <Field label="Customer email" htmlFor="q-email" hint="QuoteLoop sends the quote to this address.">
                    <input
                      id="q-email"
                      type="email"
                      className="input"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                    />
                  </Field>
                )}
              </>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <span className="eyebrow">Quote</span>
            <Field label="What did you quote for?" htmlFor="q-title">
              <input
                id="q-title"
                maxLength={LIMITS.title}
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Service 3 split-system AC units"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <Field label="Amount" htmlFor="q-amount">
                <input
                  id="q-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  className="input num"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Currency" htmlFor="q-currency">
                <select
                  id="q-currency"
                  className="input"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {flow === "track" && (
              <Field
                label="When did you send it?"
                htmlFor="q-sent"
                hint="Follow-up reminders are counted from this date, so an older quote may already be due."
              >
                <input
                  id="q-sent"
                  type="date"
                  max={today}
                  className="input"
                  value={sentDate}
                  onChange={(e) => setSentDate(e.target.value)}
                />
              </Field>
            )}
          </section>

          <Disclosure label="Add more details (optional)">
            {flow === "track" && (
              <Field label="Sent by" htmlFor="q-method">
                <select
                  id="q-method"
                  className="input"
                  value={sentMethod}
                  onChange={(e) => setSentMethod(e.target.value)}
                >
                  <option value="">Not sure</option>
                  {SENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {flow === "track" && !savedEmail && (
              <Field
                label="Customer email"
                htmlFor="q-email-optional"
                hint="Add one to email follow-ups from QuoteLoop later."
              >
                <input
                  id="q-email-optional"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </Field>
            )}
            {customerMode === "new" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Company" htmlFor="q-company">
                  <input
                    id="q-company"
                    maxLength={LIMITS.companyName}
                    className="input"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </Field>
                <Field label="Phone" htmlFor="q-phone">
                  <input
                    id="q-phone"
                    type="tel"
                    maxLength={LIMITS.phone}
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
              </div>
            )}
            <Field label="Description" htmlFor="q-description" hint="Scope of work. Helps the AI write a better follow-up.">
              <textarea
                id="q-description"
                rows={2}
                className="input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Valid until" htmlFor="q-valid">
                <input
                  id="q-valid"
                  type="date"
                  className="input"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </Field>
              <Field label="Internal notes" htmlFor="q-notes" hint="Only you see these.">
                <textarea
                  id="q-notes"
                  rows={2}
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </div>
          </Disclosure>

          {errorBox}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
            <button type="button" className="btn-ghost" onClick={() => setStep("choose")} disabled={busy}>
              Back
            </button>
            {flow === "send" ? (
              <button type="button" className="btn-accent" onClick={goToPreview} disabled={busy}>
                <Mail className="h-4 w-4" /> Preview quote email
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => submit("track")} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
                {duplicateWarned ? "Add it anyway" : "Start follow-up tracking"}
              </button>
            )}
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-4">
          {staleEmail && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              <span>You changed the quote details after editing this email. Check it still matches.</span>
              <button
                type="button"
                className="btn-secondary"
                disabled={busy}
                onClick={() => {
                  writeEmail({ keepEditedSubject: false });
                  setError(null);
                }}
              >
                Rewrite with the new details
              </button>
            </div>
          )}
          {recipientOverride && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
              This customer&apos;s saved email address is now <span className="font-medium">{recipientOverride}</span>.
              Check it before sending.
            </div>
          )}
          <QuoteEmailPreview
            to={effectiveEmail}
            subject={subject}
            onSubjectChange={(value) => {
              setSubject(value);
              setSubjectEdited(true);
            }}
            body={body}
            onBodyChange={(value) => {
              setBody(value);
              setBodyEdited(true);
            }}
            title={title.trim()}
            amount={Number(amount)}
            currency={currency}
            description={description.trim() || null}
            businessName={business.name}
            replyTo={business.email}
          />

          {errorBox}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
            {savedDraftId ? (
              <p className="max-w-xs text-xs text-stone-500">
                Your quote is saved as a draft. To change its details, close this and edit it on the Quotes
                page.
              </p>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setStep("form")} disabled={busy}>
                Back to details
              </button>
            )}
            <button
              type="button"
              className="btn-accent"
              onClick={() => submit("send")}
              disabled={busy || sendLocked || !body.trim()}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Send quote email
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <QuoteDonePanel
          result={result}
          today={today}
          onWriteFollowUp={() => onWriteFollowUp(result.quoteId)}
          onAnother={startAnother}
        />
      )}
    </Modal>
  );
}
