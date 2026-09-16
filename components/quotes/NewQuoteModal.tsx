"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { ArrowRight, CalendarCheck, ChevronRight, Loader2, Mail, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { CURRENCIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { defaultQuoteBody, defaultQuoteSubject } from "@/lib/quote-email";
import { QuoteEmailPreview } from "./QuoteEmailPreview";
import { QuoteDonePanel } from "./QuoteDonePanel";
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

function Disclosure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-900 [&::-webkit-details-marker]:hidden">
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
  const [error, setError] = useState<string | null>(null);
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
  const effectiveEmail = savedEmail || email.trim();

  function fields() {
    return {
      customerMode,
      leadId: customerMode === "existing" ? leadId : null,
      customerName: customerName.trim(),
      email: effectiveEmail,
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
    if (!title.trim()) return "Add a short title for the quote, like “Service 3 AC units”.";
    const value = Number(amount);
    if (!String(amount).trim() || !Number.isFinite(value) || value <= 0) {
      return "Enter the quote amount as a number greater than zero.";
    }
    if (flow === "track" && !sentDate) return "Enter the date you sent this quote.";
    return null;
  }

  function goToPreview() {
    const problem = clientProblem();
    if (problem) return setError(problem);
    if (!bodyEdited) {
      setSubject(defaultQuoteSubject(business.name, title.trim()));
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
    }
    setError(null);
    setStep("preview");
  }

  function submit(kind: "send" | "track") {
    // A second press must never start a second send.
    if (busy || (kind === "send" && sendLocked)) return;
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
              ? await sendDraftQuoteEmail({ quoteId: savedDraftId, subject, message: body })
              : await sendQuoteWithQuoteLoop(fields());
      } catch (e) {
        unstable_rethrow(e); // e.g. the session expired: let Next redirect to login
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
    </div>
  );

  return (
    <Modal open onClose={onClose} size="lg" title={heading.title} description={heading.description}>
      {step === "choose" && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={!emailEnabled}
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
            {!emailEnabled && (
              <span className="mt-2 block text-xs text-stone-500">
                Email sending isn&apos;t set up for this workspace yet.
              </span>
            )}
          </button>

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
                        "rounded px-2.5 py-1 transition-colors",
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
                    className="input"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </Field>
                <Field label="Phone" htmlFor="q-phone">
                  <input id="q-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
                <input id="q-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
                Start follow-up tracking
              </button>
            )}
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-4">
          <QuoteEmailPreview
            to={effectiveEmail}
            subject={subject}
            onSubjectChange={setSubject}
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
