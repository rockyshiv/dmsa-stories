import type { Metadata } from "next";
import { MAKER, SUPPORT_EMAIL } from "@/lib/story/brand";

// The privacy policy for the Myithri app and the conversation pages. Linked from the
// app's welcome screen and Settings, the consent screens, and the Google Play listing.
export const metadata: Metadata = {
  title: "Privacy policy | Myithri by Auraclusive",
  description: "How Myithri handles the conversations, recordings and reports it creates.",
  icons: { icon: "/admin-icons/icon-192.png" },
};

const UPDATED = "9 October 2026";

export default function PrivacyPage() {
  return (
    // The site-wide background is dark (the interview page); this page is a light document.
    <div className="min-h-dvh bg-[#F7F9FC]">
    <main className="mx-auto max-w-2xl px-5 py-10 text-[16px] leading-relaxed text-[#0B1F44] [&_h2]:mt-9 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1.5 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#11706F]">Myithri by {MAKER}</p>
      <h1 className="mt-2 text-3xl font-bold leading-tight">Privacy policy</h1>
      <p className="text-sm text-[#5B6B85]">Last updated {UPDATED}</p>

      <p>
        Myithri is an AI voice assistant made by {MAKER}. Organisations such as NGOs and sports academies use it to talk with the people they serve, and to turn
        those conversations into summaries, stories and reports. This policy explains what Myithri collects, why, where it is kept and the choices you have. It
        covers the Myithri app (on Android and on the web) and the conversation pages people open from a link.
      </p>

      <h2>Who is responsible</h2>
      <p>
        The organisation that invites you to a conversation decides what to ask and what to do with the answers. It is responsible for your data (the &quot;data
        fiduciary&quot; under India&apos;s Digital Personal Data Protection Act, 2023). {MAKER} provides the software and handles the data only to run Myithri for
        that organisation. You can contact either of us; we will pass requests on where needed.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>From people who talk with Myithri</strong> (through a link from an organisation):
      </p>
      <ul>
        <li>Your consent, given on screen before the conversation starts.</li>
        <li>The conversation: a voice recording, and for some story interviews a video recording, plus a written transcript.</li>
        <li>What you choose to share: your name, optionally your phone number, and any photos or short videos you add.</li>
        <li>Summaries, stories and reports that Myithri writes from the conversation.</li>
        <li>A technical log (for example the phone and browser type, and whether the microphone connected) so problems can be fixed.</li>
      </ul>
      <p>
        <strong>From organisations using the app:</strong> the details they enter about their programmes and participants (such as names, phone numbers, hometowns
        and the support they gave), their organisation details and logo, and any documents they add for Myithri to know.
      </p>
      <p>
        <strong>On your device:</strong> the app keeps your organisation&apos;s private access link and a copy of the lists it last loaded, so it opens quickly.
        Signing out removes them. The app has no advertising, no analytics trackers and no third-party tracking.
      </p>

      <h2>How it is used</h2>
      <ul>
        <li>To hold the conversation, in English, Hindi or Kannada.</li>
        <li>To write transcripts, summaries, impact stories and reports for the organisation that invited you.</li>
        <li>To let the organisation follow up on questions you asked or help you need.</li>
        <li>To fix problems and keep the service working.</li>
      </ul>
      <p>We never sell personal data or use it for advertising.</p>

      <h2>AI processing by Google</h2>
      <p>
        Myithri is an AI. To listen, speak and write, it sends the conversation to Google&apos;s Gemini AI service. On Google&apos;s free plan, Google may use this
        content to improve its products, and it may be seen by Google&apos;s reviewers; on a paid plan it is not used that way. You are told this before you agree
        to a conversation. AI can make mistakes, so organisations should check stories before sharing them, and the app has a &quot;Report a problem&quot; button
        on everything the AI writes.
      </p>

      <h2>Where it is kept</h2>
      <p>
        Recordings, transcripts, photos, stories and reports are stored in the Google Drive and Google Sheets account that the organisation connects to Myithri,
        using Google Apps Script. {MAKER} does not keep a separate copy. The app&apos;s web pages are served by GitHub Pages. Data is sent over encrypted (HTTPS)
        connections, and each organisation reaches its data only with its own private access link.
      </p>

      <h2>Who it is shared with</h2>
      <ul>
        <li>The organisation that invited you, and the people it chooses to share stories and reports with (for example donors or partners).</li>
        <li>Google, as the provider of the AI and of the storage the organisation uses.</li>
        <li>Authorities, only if the law requires it.</li>
      </ul>
      <p>Organisations are asked to share a story that names someone only after that person has seen and approved it.</p>

      <h2>How long it is kept</h2>
      <p>
        Data stays in the organisation&apos;s account until the organisation deletes it, or until you ask for it to be deleted. Technical logs are trimmed
        automatically.
      </p>

      <h2 id="delete">Your choices and rights</h2>
      <ul>
        <li>Taking part is your choice. You can stop a conversation at any time.</li>
        <li>You can ask to see, correct or delete what was recorded about you, or withdraw your consent.</li>
        <li>
          To do this, contact the organisation that invited you, or write to{" "}
          <a className="font-semibold text-[#11706F] underline" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Delete my data")}`}>
            {SUPPORT_EMAIL}
          </a>{" "}
          with your name, the organisation and roughly when you spoke with Myithri. We reply within 30 days.
        </li>
        <li>Organisations can delete a person&apos;s files and rows from their Google Drive and Sheet at any time, and can ask us to remove their whole setup.</li>
      </ul>

      <h2>Children</h2>
      <p>Myithri is meant for adults (18 and over). Organisations must not invite children to a conversation.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we will update this page and the date at the top.</p>

      <h2>Contact and grievances</h2>
      <p>
        {MAKER}, India. Email{" "}
        <a className="font-semibold text-[#11706F] underline" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
        . This address is also our grievance contact under the Digital Personal Data Protection Act, 2023.
      </p>
    </main>
    </div>
  );
}
