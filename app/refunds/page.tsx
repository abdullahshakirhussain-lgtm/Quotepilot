import type { Metadata } from "next";
import { ContactEmail, InternalLink, LegalList, LegalPage, LegalSection } from "@/components/legal/LegalPage";
import { PRICE_LABEL, TRIAL_DAYS } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Refund Policy | QuoteLoop",
  description: "QuoteLoop's 14-day money-back guarantee.",
};

export default function RefundsPage() {
  return (
    <LegalPage
      title="Refund Policy"
      effectiveDate="October 29, 2026"
      intro={
        <p>
          If QuoteLoop isn’t right for you, you can have your money back. This policy is part of our{" "}
          <InternalLink href="/terms">Terms of Service</InternalLink>.
        </p>
      }
    >
      <LegalSection title="14-day money-back guarantee">
        <p>
          Ask within 14 days of any payment and we’ll refund that payment in full. You don’t need to
          give a reason.
        </p>
      </LegalSection>

      <LegalSection title="How to ask for a refund">
        <LegalList
          items={[
            <>
              Email <ContactEmail /> from the address you use for QuoteLoop, or tell us that address.
            </>,
            "The refund goes back to the card or payment method you paid with. How soon it shows up depends on your bank or card issuer.",
            "Payments may be processed by our payment provider, acting as the reseller of QuoteLoop. If so, they issue the refund and their buyer terms also apply.",
          ]}
        />
      </LegalSection>

      <LegalSection title="After 14 days">
        <p>
          Payments older than 14 days aren’t refunded, including for part of a month. You can cancel
          at any time and keep full access until the end of the period you’ve paid for, so you won’t
          be charged again.
        </p>
      </LegalSection>

      <LegalSection title="The free trial">
        <p>
          The {TRIAL_DAYS}-day free trial costs nothing and needs no card. You’re only charged ({PRICE_LABEL} a
          month) if you choose to subscribe.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>This policy doesn’t limit any rights you have under the consumer laws where you live.</p>
      </LegalSection>
    </LegalPage>
  );
}
