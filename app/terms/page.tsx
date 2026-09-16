import type { Metadata } from "next";
import {
  ContactEmail,
  InternalLink,
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service — QuoteLoop",
  description: "The rules for using QuoteLoop.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      effectiveDate="September 16, 2026"
      intro={
        <>
          <p>
            These terms are the rules for using QuoteLoop (https://quoteloop.site). QuoteLoop is
            operated by Abdullah Shakir Hussain under the business name QuoteLoop, based in Sri
            Lanka (“we” or “us”).
          </p>
          <p>
            By creating an account or using QuoteLoop, you agree to these terms. If you use
            QuoteLoop for a business, you agree to them on behalf of that business. Please also read
            our <InternalLink href="/privacy">Privacy Policy</InternalLink>.
          </p>
        </>
      }
    >
      <LegalSection title="What QuoteLoop does">
        <p>
          QuoteLoop is a web app for small service businesses such as contractors, cleaners,
          installers, studios and freelancers. It helps you:
        </p>
        <LegalList
          items={[
            "track the quotes you send",
            "manage your customers",
            "create follow-up reminders",
            "draft follow-up messages with AI, then review and edit them",
            "send follow-up emails from inside QuoteLoop, one email each time you click Send email",
            "copy messages into your own email or phone",
            "track which quotes you won or lost",
            "see quote stats and your pipeline",
            "export CSV files",
          ]}
        />
        <p>QuoteLoop never sends emails automatically. You click Send quote email or Send email each time.</p>
      </LegalSection>

      <LegalSection title="Accounts">
        <LegalList
          items={[
            "Give accurate account and business information, and keep it up to date.",
            "Keep your account secure. You are responsible for activity in your account.",
            <>
              Tell us at <ContactEmail /> if you think someone else has accessed your account.
            </>,
            "You must be old enough to enter into a contract where you live.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Customer data">
        <LegalList
          items={[
            "You keep ownership of the customer and quote data you enter.",
            "You must have the right to enter that data into QuoteLoop, for example because the customer gave you their details when asking for a quote.",
            "You are responsible for complying with the laws that apply to your business and your customers, including privacy and marketing laws.",
            "We store and process customer data only to provide QuoteLoop, as described in our Privacy Policy.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Email sending rules">
        <p>
          Emails sent from QuoteLoop come from your business and go out through our sending
          service, so they must be sent responsibly:
        </p>
        <LegalList
          items={[
            "Only email people you have a business relationship with, such as customers who asked you for a quote.",
            "Do not use QuoteLoop for spam, bulk unsolicited email, cold mass outreach or misleading messages.",
            "Do not contact people who have asked you not to contact them.",
            "You must promptly honor any request from a recipient who asks not to receive more emails from you.",
            "You are responsible for the content of the emails you send.",
            "If a law that applies to you requires a physical mailing address, unsubscribe method, advertising disclosure, or other information in your emails, you are responsible for including it.",
          ]}
        />
        <p>
          Current limits are 25 emails per 24 hours and 100 emails per 30 days for each user. These
          limits may change. We can’t guarantee that every email will be delivered; for example, a
          recipient’s email provider may block or filter it.
        </p>
      </LegalSection>

      <LegalSection title="AI-generated content">
        <LegalList
          items={[
            "QuoteLoop can draft follow-up messages using AI. Drafts can be wrong, incomplete or unsuitable.",
            "Always review and edit a draft before you send or use it. You are responsible for any message you send.",
            "Drafts are saved in your account. Our Privacy Policy explains what is sent to our AI provider.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>Do not use QuoteLoop to:</p>
        <LegalList
          items={[
            "break the law or anyone’s rights",
            "send spam or harass anyone",
            "pretend to be someone else, or mislead people about who you are",
            "try to access other accounts or data, or get around security or sending limits",
            "upload harmful code, or overload, disrupt or reverse engineer the service",
          ]}
        />
      </LegalSection>

      <LegalSection title="Service providers">
        <p>
          QuoteLoop relies on other companies to work: Railway (hosting), Supabase (database and
          login), Resend (email delivery), DeepSeek (AI text generation), Google (sign-in) and
          Cloudflare (domain and DNS). If one of them has a problem, parts of QuoteLoop may not
          work for a while. Our Privacy Policy explains how they handle data.
        </p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p>
          We work to keep QuoteLoop running, but we don’t promise it will always be available,
          uninterrupted or error-free. We may add, change or remove features, and change limits,
          as the product develops.
        </p>
      </LegalSection>

      <LegalSection title="Data export and deletion">
        <p>
          In Settings, you can export your quotes, follow-ups and customers as CSV files, and clear
          all your customers, quotes, follow-ups and messages. You can also delete individual
          records at any time. Records of emails you sent from QuoteLoop are kept until your account
          is deleted. To delete your whole account, email <ContactEmail />. See our Privacy Policy
          for details.
        </p>
      </LegalSection>

      <LegalSection title="No professional advice">
        <p>
          QuoteLoop, its AI drafts and its stats are there to help you follow up. They are not
          legal, financial, tax or business advice.
        </p>
      </LegalSection>

      <LegalSection title="Fees">
        <p>
          QuoteLoop is currently free to use. If we add paid plans, prices and limits will be shown
          before you buy anything.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <LegalList
          items={[
            "You can stop using QuoteLoop at any time and ask us to delete your account.",
            "We may suspend or terminate accounts that send spam, misuse the service, break these terms, or create risk for other users, email recipients, our providers or us.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          QuoteLoop is provided “as is” and “as available.” As far as the law allows, we do not
          guarantee:
        </p>
        <LegalList
          items={[
            "that you will win more jobs or sales",
            "that AI drafts will be accurate or suitable",
            "that every email will be delivered",
            "that the service will be uninterrupted or error-free",
          ]}
        />
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          As far as the law allows, we are not liable for indirect or consequential losses, such as
          lost profits, lost jobs or lost data. Our total liability for any claim related to
          QuoteLoop is limited to the amount you paid us for QuoteLoop in the 12 months before the
          claim. Nothing in these terms limits liability that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these Terms">
        <p>
          We may update these terms as QuoteLoop changes. When we do, we will change the effective
          date at the top of this page, and tell you by email or in the app if a change is
          important. If you keep using QuoteLoop after a change, you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms: <ContactEmail />
        </p>
        <p>QuoteLoop is operated by Abdullah Shakir Hussain, Sri Lanka.</p>
      </LegalSection>
    </LegalPage>
  );
}
