import type { Metadata } from "next";
import {
  ContactEmail,
  ExternalLink,
  InternalLink,
  LegalList,
  LegalPage,
  LegalSection,
} from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — QuoteLoop",
  description: "What information QuoteLoop collects, how it is used, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate="September 15, 2026"
      intro={
        <>
          <p>
            This policy explains what information QuoteLoop collects, how we use it, who helps us
            run the service, and the choices you have. We’ve kept it in plain English.
          </p>
          <p>
            In this policy, “you” means a person or business with a QuoteLoop account, and
            “customers” means the people and businesses you send quotes to. Please also read our{" "}
            <InternalLink href="/terms">Terms of Service</InternalLink>.
          </p>
        </>
      }
    >
      <LegalSection title="Who operates QuoteLoop">
        <p>
          QuoteLoop (https://quoteloop.site) is operated by Abdullah Shakir Hussain under the
          business name QuoteLoop, based in Sri Lanka. For any question about this policy or your
          data, email <ContactEmail />.
        </p>
      </LegalSection>

      <LegalSection title="Information we collect">
        <LegalList
          items={[
            <>
              <strong className="font-medium text-stone-800">Account details:</strong> your email
              address and password. Your password is handled by Supabase Auth, our login provider,
              and is never stored in plain text.
            </>,
            <>
              <strong className="font-medium text-stone-800">Google sign-in details:</strong> if you
              choose to sign in with Google, we receive your name, email address and profile
              picture. See “Google user data” below.
            </>,
            <>
              <strong className="font-medium text-stone-800">Business profile:</strong> business
              name, owner or contact name, industry, currency, phone number, business email and your
              follow-up schedule.
            </>,
            <>
              <strong className="font-medium text-stone-800">Customer and quote data</strong> you
              enter, plus AI drafts and emails you send from QuoteLoop. See the sections below.
            </>,
            <>
              <strong className="font-medium text-stone-800">Basic technical logs:</strong> our
              hosting and login providers record basic request information, such as IP address
              and time, to keep the service secure and working.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="Customer and quote data entered by users">
        <p>When you use QuoteLoop, you may enter information about your customers and your work:</p>
        <LegalList
          items={[
            "customer names and company names",
            "phone numbers and email addresses",
            "notes",
            "quote titles, descriptions, amounts, dates and status",
            "follow-up reminders",
            "drafted message text, and the final message text you used or sent",
          ]}
        />
        <p>
          You are responsible for the customer data you enter. QuoteLoop stores and processes it
          on your behalf, only to provide the service.
        </p>
        <p>
          If you are a customer of a business that uses QuoteLoop and have a question about your
          information, please contact that business first. You can also email us at{" "}
          <ContactEmail />.
        </p>
      </LegalSection>

      <LegalSection title="AI drafts">
        <p>
          QuoteLoop uses the DeepSeek API to write draft follow-up messages. When you ask for a
          draft, we may send these quote details to DeepSeek:
        </p>
        <LegalList
          items={[
            "customer name",
            "business name",
            "quote title and description",
            "quote amount",
            "dates",
            "any optional note you type",
          ]}
        />
        <p>
          Drafts are saved in your account. AI drafts can contain mistakes, so always review and
          edit a message before you send or use it.
        </p>
        <p>
          DeepSeek may process data outside your country. DeepSeek’s privacy policy says data may
          be processed and stored in China.
        </p>
      </LegalSection>

      <LegalSection title="Emails sent from QuoteLoop">
        <p>
          You can send a follow-up email from inside QuoteLoop. QuoteLoop never sends emails
          automatically: an email is only sent when you click Send email, one email per click.
        </p>
        <p>
          Emails are delivered by Resend to the email address saved for that customer. Each email
          shows your business name and a short note that the person is receiving it because they
          asked your business for a quote. Replies go to the business email set in QuoteLoop, or to
          our configured fallback reply-to address.
        </p>
        <p>For each email, we store:</p>
        <LegalList
          items={[
            "recipient email address",
            "subject",
            "email body",
            "delivery status",
            "sending time",
            "the related quote, customer and follow-up",
          ]}
        />
        <p>Current limits: 25 emails per 24 hours and 100 emails per 30 days for each user.</p>
      </LegalSection>

      <LegalSection title="Google user data">
        <p>If you sign in with Google:</p>
        <LegalList
          items={[
            "QuoteLoop only receives your name, email address and profile picture from Google.",
            "We use this only to create your account, sign you in and prefill your setup details.",
            "QuoteLoop does not request access to your Gmail, and does not send email through your Google account.",
            "We do not sell Google user data, and we do not use it for advertising.",
            "We do not share Google user data except as needed to provide QuoteLoop, to comply with the law, or to protect the service.",
          ]}
        />
        <p>
          QuoteLoop’s use and transfer of information received from Google APIs will adhere to the{" "}
          <ExternalLink href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </ExternalLink>
          , including the Limited Use requirements.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>QuoteLoop uses only essential cookies:</p>
        <LegalList
          items={[
            "sign-in cookies that keep you securely logged in",
            "one cookie that stores your browser’s time zone, so due dates and reminders show the right day",
          ]}
        />
        <p>We do not use advertising, tracking or analytics cookies.</p>
      </LegalSection>

      <LegalSection title="Service providers and international processing">
        <p>We use these providers to run QuoteLoop:</p>
        <LegalList
          items={[
            "Railway — hosting",
            "Supabase — database and login",
            "Resend — email delivery, including account emails such as sign-up confirmations",
            "DeepSeek — AI text generation",
            "Google — sign-in with Google",
            "Cloudflare — domain and DNS",
          ]}
        />
        <p>
          We share information with them only as needed to provide QuoteLoop. These providers may
          process data outside your country (see “AI drafts” for DeepSeek).
        </p>
      </LegalSection>

      <LegalSection title="How we use information">
        <LegalList
          items={[
            "to run your account and show your quotes, customers, reminders and stats",
            "to sign you in, including with Google if you choose it",
            "to write AI drafts when you ask for one",
            "to send a follow-up email when you click Send email",
            "to send account emails, such as sign-up confirmation",
            "to keep QuoteLoop secure, prevent abuse (for example, with sending limits) and fix problems",
            "to answer your questions and requests",
            "to comply with the law",
          ]}
        />
        <p>
          We do not sell your data, and we do not use your data or your customers’ data for
          advertising.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <LegalList
          items={[
            "QuoteLoop uses HTTPS.",
            "Secret keys stay on our server and are never sent to your browser.",
            "Database security rules restrict each account to its own data.",
          ]}
        />
        <p>
          No online service can be guaranteed completely secure. If you notice anything that looks
          wrong, please email <ContactEmail />.
        </p>
      </LegalSection>

      <LegalSection title="Data retention and deletion">
        <p>We keep your data until you delete it.</p>
        <LegalList
          items={[
            "You can delete individual records, such as customers and quotes, at any time.",
            "In Settings, you can clear all your customers, quotes, follow-ups and messages at once. Your business profile stays until your account is deleted.",
            "In Settings, you can export your quotes, follow-ups and customers as CSV files.",
            <>
              To delete your whole account, email <ContactEmail />.
            </>,
          ]}
        />
        <p>
          Copies held by our service providers, such as email delivery records, may be kept for a
          limited time under their own retention rules.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>
          QuoteLoop is a tool for businesses and is not intended for children. We do not knowingly
          collect information from children. If you think a child has given us information, email{" "}
          <ContactEmail /> and we will delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          We may update this policy as QuoteLoop changes. When we do, we will change the effective
          date at the top of this page. If a change is important, we will also tell you by email or
          in the app.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions or requests about privacy: <ContactEmail />
        </p>
        <p>QuoteLoop is operated by Abdullah Shakir Hussain, Sri Lanka.</p>
      </LegalSection>
    </LegalPage>
  );
}
