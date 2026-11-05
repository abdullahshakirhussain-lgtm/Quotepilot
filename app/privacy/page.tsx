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
  title: "Privacy Policy | QuoteLoop",
  description: "What information QuoteLoop collects, how it is used, and the choices you have.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      effectiveDate="November 5, 2026"
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
              name, owner or contact name, industry, currency, phone number, business email, your
              follow-up schedule, and the sign-off and signature you add to messages.
            </>,
            <>
              <strong className="font-medium text-stone-800">Customer and quote data</strong> you
              enter, plus AI drafts and emails you send from QuoteLoop. See the sections below.
            </>,
            <>
              <strong className="font-medium text-stone-800">Pages you open in QuoteLoop:</strong>{" "}
              which page of the app you open (for example Quotes or Follow-ups), when, and whether
              on a phone, tablet or computer. Only the page’s name is recorded, never what is on it,
              and no cookie is used for this.
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
            "message templates you save",
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
          You can send a quote email or a follow-up email from inside QuoteLoop. QuoteLoop never
          sends emails automatically: an email is only sent when you click Send quote email or Send
          email, one email per click.
        </p>
        <p>
          Emails are delivered by Resend to the email address saved for that customer. Each email
          shows your business name and a short note that the person is receiving it because they
          asked your business for a quote. Replies reach the business email set in QuoteLoop, and
          QuoteLoop won’t send an email until a business email is set.
        </p>
        <p>
          You can attach PDFs and photos to an email (up to five files, 10 MB in all). They go to
          Resend with the email and are not stored by QuoteLoop; the email lists their names, and
          that text is kept with the email.
        </p>
        <p>
          A reply passes through QuoteLoop on its way: each email carries a reply address that
          belongs to its quote. When the customer replies, Resend receives the reply for us, and
          QuoteLoop records who replied, the subject and when, pauses that quote’s reminders, and
          forwards the whole reply, with any attachments, to the business email. QuoteLoop keeps the
          reply&apos;s text (up to 10,000 characters) and the names of its attachments, so you can read
          and answer it inside QuoteLoop; the attachments themselves are forwarded, not stored by
          QuoteLoop. Resend keeps received emails for up to 30 days, and while it does, you can open
          a reply&apos;s attachments from its quote in QuoteLoop.
        </p>
        <p>
          If you receive an email sent through QuoteLoop and do not want more emails from that
          business, reply to that business and ask them to stop contacting you. You can also email{" "}
          <ContactEmail /> if you believe QuoteLoop is being misused.
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
        <p>
          For each customer reply, we store the sender’s name and email address, the subject, its text,
          the names of any attachments, when it arrived, and whether it was forwarded. QuoteLoop also keeps
          a short list of updates for you (a customer replied, a payment went through), which you can read
          and clear.
        </p>
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
        <p>
          We do not use advertising, tracking or analytics cookies. The page visits described above
          are recorded without cookies.
        </p>
      </LegalSection>

      <LegalSection title="Service providers and international processing">
        <p>We use these providers to run QuoteLoop:</p>
        <LegalList
          items={[
            "Railway: hosting",
            "Supabase: database and login",
            "Resend: email delivery and receiving customer replies, including account emails such as sign-up confirmations",
            "DeepSeek: AI text generation",
            "Google: sign-in with Google",
            "Cloudflare: domain and DNS",
            "Our payment provider (when you subscribe): sells you the subscription as the reseller, and handles your card details, billing address and sales tax. We never see your full card number.",
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
            "to send a quote or follow-up email when you click to send it",
            "to send account emails, such as sign-up confirmations and password reset links",
            "to keep QuoteLoop secure, prevent abuse (for example, with sending limits) and fix problems",
            "to understand how QuoteLoop is used and improve it: from the page visits above and from counts and dates in your account (for example, how many quotes you have and when you last used QuoteLoop), never from the content of your quotes, customers or messages",
            "to answer your questions and requests",
            "to comply with the law",
          ]}
        />
        <p>
          QuoteLoop’s operator can see, for each account, its email address, sign-up date, plan,
          those counts and dates, and its page visits. We do not sell your data, and we do not use
          your data or your customers’ data for advertising.
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
            "In Settings, you can clear all your customers, quotes, follow-ups, messages, customer replies, updates and page visits at once. Your business profile and message templates stay until your account is deleted.",
            "Page visits are kept for 13 months, then deleted.",
            "Records of emails you sent from QuoteLoop are kept when you delete a quote or customer, or clear your data, so your sending history and sending limits stay accurate. They are deleted when your account is deleted.",
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
