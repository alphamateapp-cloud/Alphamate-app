import React from 'react';
import { ArrowLeft, ShieldCheck, FileText, Mail, Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';

const EFFECTIVE_DATE = 'November 14, 2026';

interface PolicySection {
  id: string;
  number: number;
  title: string;
  content: React.ReactNode;
}

export const PrivacyPolicyScreen: React.FC = () => {
  const { navigateBack, setCurrentScreen, customLogoUrl } = useApp();

  const sections: PolicySection[] = [
    {
      id: 'introduction',
      number: 1,
      title: 'Introduction',
      content: (
        <>
          <p>
            Welcome to <strong>Alpha Mate</strong> (&ldquo;Alpha Mate,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or
            &ldquo;us&rdquo;), accessible on the web at{' '}
            <span className="text-[#D8B4FE] font-medium">https://alphamate.app</span> and through the Alpha Mate
            Android application (<code className="text-purple-200">com.alphamate.live</code>).
          </p>
          <p>
            Alpha Mate is a live-streaming, multi-seat voice party room, short video (&ldquo;Moments&rdquo; / Reels),
            and real-time social messaging platform. This Privacy Policy explains how we collect, use, store, transmit,
            and protect information based strictly on the actual systems implemented in the Alpha Mate application.
          </p>
          <p>
            By creating an account, signing in, or using Alpha Mate, you acknowledge the practices described in this
            Privacy Policy.
          </p>
        </>
      ),
    },
    {
      id: 'information-we-collect',
      number: 2,
      title: 'Information We Collect',
      content: (
        <>
          <p>Depending on how you use Alpha Mate, we collect and process the following categories of information:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
            <li>
              <strong>Account &amp; Authentication Information:</strong> Email address, authentication provider details,
              and Firebase unique user identifier (UID).
            </li>
            <li>
              <strong>Profile Information:</strong> Display name, username, unique Alpha Mate ID, profile avatar URL,
              bio, date of birth (collected during email sign-up), VIP tier, level/XP progress, social counts, and
              optional agency/host affiliation tags.
            </li>
            <li>
              <strong>User-Generated Content:</strong> Short videos (Moments/Reels), titles, descriptions, tags,
              comments, direct/group chat messages, chat media attachments (images, audio, video, documents), stories,
              and party room cover images.
            </li>
            <li>
              <strong>Live Streaming &amp; Party Room Data:</strong> Room titles, categories, announcements, seat
              assignments, real-time audio/video WebRTC streams and signaling metadata, active viewer lists, live chat
              messages, heart/reaction events, and moderation states (mute, kick, block).
            </li>
            <li>
              <strong>Coins, Diamonds &amp; Transaction Records:</strong> In-app Coin and Diamond balances, gift
              sending/receiving records, VIP purchases, Diamond-to-Coin swap logs, and withdrawal request submissions.
            </li>
            <li>
              <strong>Device &amp; Technical Information:</strong> Push notification tokens (FCM), platform identifier,
              last active timestamp, browser/device local storage preferences, and system permissions you grant on your
              device (such as camera, microphone, media storage, and notifications).
            </li>
          </ul>
          <p className="text-xs text-zinc-400">
            Alpha Mate does <strong>not</strong> request or collect GPS/precise device location, device address book
            contacts, or third-party advertising identifiers (such as AdMob).
          </p>
        </>
      ),
    },
    {
      id: 'account-registration',
      number: 3,
      title: 'Account Registration and Authentication',
      content: (
        <>
          <p>
            Alpha Mate uses <strong>Firebase Authentication</strong> (provided by Google) to register users and manage
            verified sessions via:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
            <li>
              <strong>Google (Gmail) Sign-In:</strong> Uses Firebase Google OAuth authentication. Google supplies your
              verified email address, display name, and profile photo URL, along with a Firebase UID.
            </li>
            <li>
              <strong>Email &amp; Password Sign-Up:</strong> Collects your full name/display name, unique username,
              email address, date of birth (verified to confirm you are at least 18 years old), selected avatar, and
              password. Firebase sends a verification email before your account can enter protected app features, and
              handles password reset emails.
            </li>
          </ul>
          <p>
            Passwords are processed directly by Firebase Authentication and are stripped before any profile record is
            saved to our Cloud Firestore database. Apple Sign-In is currently labeled &ldquo;Coming Soon&rdquo; and is
            not active.
          </p>
        </>
      ),
    },
    {
      id: 'user-profile-information',
      number: 4,
      title: 'User Profile Information',
      content: (
        <>
          <p>
            Your profile record is stored in Google <strong>Cloud Firestore</strong> under the{' '}
            <code className="text-purple-200">users</code> collection. Fields stored may include your unique ID (e.g.,{' '}
            <code className="text-purple-200">AM_XXXXXX</code>), username, display name, email address, avatar URL, bio,
            date of birth (when provided during email sign-up), verification status, level, XP, VIP tier, active profile
            frame or honor title, follower/following/like counts, Coin and Diamond balances, push notification metadata,
            and optional host/coin-agency membership details.
          </p>
          <p>
            Public profile details (such as your display name, username, unique ID, avatar, bio, level, and VIP badge)
            are visible to other Alpha Mate users when you interact, host rooms, post Reels, or appear in leaderboards.
          </p>
        </>
      ),
    },
    {
      id: 'user-generated-content',
      number: 5,
      title: 'User-Generated Content',
      content: (
        <>
          <p>When you upload or send content on Alpha Mate, it is processed as follows:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
            <li>
              <strong>Moments / Reels Videos:</strong> Video files uploaded to Reels are stored in{' '}
              <strong>Cloudflare R2</strong> (<code className="text-purple-200">media.alphamate.app</code>) via our
              Cloudflare Workers media API. Reel metadata (title, description, tags, music title, view/like counts, and
              creator details) and Reel comments are stored in Cloud Firestore (<code className="text-purple-200">reels</code>{' '}
              and <code className="text-purple-200">comments</code>). Deleting a Reel removes both its video object from
              Cloudflare R2 and its Firestore document.
            </li>
            <li>
              <strong>Chat Messages &amp; Media:</strong> Direct and group conversations, text messages, chat requests,
              and group invitations are stored in Cloud Firestore (<code className="text-purple-200">chats</code>,{' '}
              <code className="text-purple-200">chatRequests</code>, <code className="text-purple-200">groupInvites</code>).
              Files shared in chat (images, video, audio, or PDF/text files up to 50 MB) are uploaded to{' '}
              <strong>Firebase Storage</strong> (<code className="text-purple-200">chatMedia/...</code>).
            </li>
            <li>
              <strong>Room Cover Images &amp; Stories:</strong> Party room cover images (images up to 5 MB) are stored in
              Firebase Storage (<code className="text-purple-200">partyRoomCovers/...</code>). Personal stories created
              in the client may also be cached locally in your browser/device storage.
            </li>
            <li>
              <strong>Blocked Users:</strong> When you block another user, that block record is saved in your{' '}
              <code className="text-purple-200">users/&#123;uid&#125;/blockedUsers</code> Firestore subcollection.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'live-streaming-party',
      number: 6,
      title: 'Live Streaming and Party Room Information',
      content: (
        <>
          <p>
            To power real-time Solo Live video broadcasts, PK battles, and 4-seat or 8-seat Voice Party Rooms, Alpha Mate
            processes:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
            <li>
              <strong>Room &amp; Presence State:</strong> Room titles, categories, announcements, host profile, seat
              occupancy, microphone mute/speaking indicators, viewer lists, room chat messages, heart reactions, and
              online presence records stored in Cloud Firestore and synchronized in real time via our WebSocket service (
              <code className="text-purple-200">https://api.alphamate.app/ws</code>).
            </li>
            <li>
              <strong>Real-Time Audio &amp; Video Transmission:</strong> Microphone audio and camera video captured from
              your device are transmitted through WebRTC using <strong>Cloudflare Realtime SFU &amp; TURN/STUN</strong>{' '}
              (<code className="text-purple-200">rtc.live.cloudflare.com</code>) and authenticated session APIs on our
              backend server (<code className="text-purple-200">https://api.alphamate.app</code>). Audio and video
              streams are relayed live so participants can see and hear each other in real time; our backend server does
              not store or archive live voice/video recordings by default.
            </li>
            <li>
              <strong>Automated Stream Cleanup:</strong> A scheduled Firebase Cloud Function (
              <code className="text-purple-200">cleanupStaleLiveStreams</code>) runs periodically to deactivate timed-out
              live streams and remove expired <code className="text-purple-200">liveStreams</code> session documents.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'coins-diamonds-transactions',
      number: 7,
      title: 'Coins, Diamonds and Transaction Information',
      content: (
        <>
          <p>
            Alpha Mate tracks virtual Coins, Diamonds, held Diamonds (pending review), VIP tier upgrades, virtual gift
            transfers, Diamond-to-Coin conversions, and withdrawal request records.
          </p>
          <p>
            When you submit a Diamond withdrawal request in the Wallet screen, the application records the requested USD
            amount, estimated PKR reference value, chosen payout method (JazzCash, EasyPaisa, Bank, or USDT), account
            title / beneficiary name, account number / IBAN / wallet address, and optional bank name or branch city.
          </p>
          <p className="text-xs text-zinc-400">
            <strong>Current Implementation Notice:</strong> Wallet recharges and withdrawal submissions in this version
            of the application are recorded in-app (client state and local storage / Firestore profile balances) for
            platform accounting and administrative review. Alpha Mate does not currently connect to a live external
            card-processing or payment-gateway API on its backend server, and does not collect or store raw credit card
            numbers or banking PINs.
          </p>
        </>
      ),
    },
    {
      id: 'device-technical-info',
      number: 8,
      title: 'Device and Technical Information',
      content: (
        <>
          <p>We collect or access the following device and technical data strictly to operate core app features:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
            <li>
              <strong>Push Notifications (FCM):</strong> On Android and supported browsers, Firebase Cloud Messaging
              generates a device token (<code className="text-purple-200">pushNotificationToken</code>) along with your
              platform name and last active timestamp, stored on your user document to deliver live stream, party,
              reward, and chat alerts.
            </li>
            <li>
              <strong>Device Permissions (Android):</strong> The Android app declares{' '}
              <code className="text-purple-200">CAMERA</code>, <code className="text-purple-200">RECORD_AUDIO</code>,{' '}
              <code className="text-purple-200">MODIFY_AUDIO_SETTINGS</code>,{' '}
              <code className="text-purple-200">POST_NOTIFICATIONS</code>,{' '}
              <code className="text-purple-200">INTERNET</code>,{' '}
              <code className="text-purple-200">ACCESS_NETWORK_STATE</code>, media/storage read permissions for
              selecting images, videos, or audio files, <code className="text-purple-200">VIBRATE</code>, and{' '}
              <code className="text-purple-200">WAKE_LOCK</code>. Camera and microphone are only accessed when you start
              or join a broadcast or voice seat.
            </li>
            <li>
              <strong>Local App &amp; Browser Storage:</strong> We use <code className="text-purple-200">localStorage</code>{' '}
              and <code className="text-purple-200">sessionStorage</code> to maintain active session continuity,
              preferences, daily check-in status, custom logo assets, and push notification token caching.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'how-we-use-information',
      number: 9,
      title: 'How We Use Information',
      content: (
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>Create, authenticate, and maintain verified user accounts and keep signed-in sessions active.</li>
          <li>Display your profile, level, VIP status, followers, and social badges across the app.</li>
          <li>Deliver real-time Solo Live broadcasts, PK battles, 4-seat/8-seat Party Voice Rooms, Reels, and Chat.</li>
          <li>Process in-app virtual gift transfers, Coins, Diamonds, rewards, and withdrawal request workflows.</li>
          <li>Send push notifications for live broadcasts, messages, invitations, and account activity.</li>
          <li>Moderate rooms, investigate misuse, prevent fraud or unauthorized transactions, and enforce our Terms.</li>
          <li>Respond to user support, account deletion, and account recovery inquiries.</li>
        </ul>
      ),
    },
    {
      id: 'data-storage-security',
      number: 10,
      title: 'Data Storage and Security',
      content: (
        <>
          <p>
            Application data is stored and transmitted using Google <strong>Firebase</strong> (Authentication, Cloud
            Firestore, Firebase Storage), <strong>Cloudflare R2</strong> (Reels videos),{' '}
            <strong>Cloudflare Realtime</strong> (WebRTC media transport), and our backend API/WebSocket server hosted
            on <strong>Railway</strong> (<code className="text-purple-200">api.alphamate.app</code>).
          </p>
          <p>
            Communications with our backend API, Firebase, and Cloudflare services use encrypted HTTPS/WSS transport,
            and protected live SFU/media endpoints verify Firebase ID tokens via Google Identity Toolkit. Read-only
            administrative monitoring endpoints on the backend are restricted to authorized administrator emails.
          </p>
          <p>
            While we apply Firestore security rules, Storage access rules, and token verification controls, no method
            of electronic transmission or cloud storage is completely immune from security risk.
          </p>
        </>
      ),
    },
    {
      id: 'third-party-services',
      number: 11,
      title: 'Third-Party Services',
      content: (
        <>
          <p>Alpha Mate integrates only the following third-party infrastructure providers to run the application:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
            <li>
              <strong>Google Firebase &amp; Google Identity Services:</strong> Authentication, Google Sign-In, Cloud
              Firestore database, Firebase Storage, Cloud Functions, and Firebase Cloud Messaging (FCM).
            </li>
            <li>
              <strong>Cloudflare:</strong> Cloudflare R2 object storage, Cloudflare Workers media API, and Cloudflare
              Realtime SFU &amp; TURN/STUN servers for live audio/video streams.
            </li>
            <li>
              <strong>Railway:</strong> Cloud hosting for our Express API and WebSocket real-time signaling server (
              <code className="text-purple-200">api.alphamate.app</code>).
            </li>
          </ul>
          <p>
            Alpha Mate does <strong>not</strong> currently integrate third-party advertising SDKs or third-party
            cross-app tracking/analytics SDKs.
          </p>
        </>
      ),
    },
    {
      id: 'data-sharing-disclosure',
      number: 12,
      title: 'Data Sharing and Disclosure',
      content: (
        <>
          <p>We do not sell your personal information to advertisers or data brokers. Information is shared only:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
            <li>
              <strong>With Other Alpha Mate Users:</strong> Your public profile, live broadcasts, party seat presence,
              public Reels, comments, and room chat messages are visible to users participating in those spaces.
            </li>
            <li>
              <strong>With Infrastructure Providers:</strong> Strictly with Google Firebase, Cloudflare, and Railway to
              operate authentication, storage, real-time messaging, and live audio/video transport.
            </li>
            <li>
              <strong>For Legal Compliance &amp; Safety:</strong> When required to comply with applicable law, valid
              legal process, or to investigate fraud, abuse, safety risks, or violations of our Terms &amp; Conditions.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'account-deletion',
      number: 13,
      title: 'Account Deletion',
      content: (
        <>
          <p>
            You may request permanent deletion of your Alpha Mate account at any time by emailing{' '}
            <a href="mailto:support@alphamate.app" className="text-[#D8B4FE] underline font-semibold">
              support@alphamate.app
            </a>{' '}
            from your registered email address (or by completing email ownership verification with our support team).
          </p>
          <p>
            Upon verifying your deletion request, your account enters a <strong>15-day deletion grace period</strong>{' '}
            before permanent removal. Active account access is disabled, and once the 15-day window concludes without
            recovery, our team permanently removes your account authentication credentials, profile data, and associated
            hosted user content where applicable.
          </p>
          <p className="text-xs text-zinc-400">
            Note: Automated self-service deletion inside the app UI and automated purging of infrastructure backups are
            not currently automated via a background server job. Infrastructure-level backups, server logs, or records
            required for fraud prevention or legal compliance remain subject to the underlying cloud provider&apos;s
            standard retention cycles and applicable law.
          </p>
        </>
      ),
    },
    {
      id: 'account-recovery',
      number: 14,
      title: 'Account Recovery',
      content: (
        <>
          <p>
            If you change your mind after submitting an account deletion request, you have <strong>15 days</strong> from
            the request date to recover your account.
          </p>
          <p>
            To recover your account within this 15-day window, contact{' '}
            <a href="mailto:support@alphamate.app" className="text-[#D8B4FE] underline font-semibold">
              support@alphamate.app
            </a>{' '}
            and complete <strong>email ownership verification</strong> using your registered email address. After the
            15-day period expires and permanent deletion is completed, your account, Coins, Diamonds, VIP status, and
            content cannot be restored.
          </p>
        </>
      ),
    },
    {
      id: 'childrens-privacy',
      number: 15,
      title: "Children's Privacy",
      content: (
        <>
          <p>
            Alpha Mate is strictly intended for individuals aged <strong>18 years and older</strong>. Email sign-up
            requires confirming a date of birth showing you are at least 18 years old.
          </p>
          <p>
            We do not knowingly permit anyone under 18 years of age to register, stream, participate in party rooms, or
            use Alpha Mate. If we discover or receive credible notice that an account is operated by someone under 18,
            we will promptly suspend or remove that account. To report an underage account, contact{' '}
            <a href="mailto:support@alphamate.app" className="text-[#D8B4FE] underline font-semibold">
              support@alphamate.app
            </a>
            .
          </p>
        </>
      ),
    },
    {
      id: 'changes-to-policy',
      number: 16,
      title: 'Changes to This Privacy Policy',
      content: (
        <p>
          We may update this Privacy Policy periodically to reflect operational, technical, or legal changes. Any
          updated version will be published inside the Alpha Mate application and at{' '}
          <span className="text-[#D8B4FE]">https://alphamate.app/privacy</span> with an updated Effective Date at the
          top of this page. Continued use of Alpha Mate after an updated policy is published constitutes acknowledgment
          of the revised Privacy Policy.
        </p>
      ),
    },
    {
      id: 'contact-information',
      number: 17,
      title: 'Contact Information',
      content: (
        <div className="space-y-2">
          <p>
            If you have questions about this Privacy Policy, data practices, account deletion, or 15-day account
            recovery, please contact us:
          </p>
          <div className="p-3.5 rounded-2xl bg-[#110A21] border border-[#A855F7]/25 space-y-1.5 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Mail className="w-4 h-4 text-[#EC4899] shrink-0" />
              <span>Support &amp; Privacy Email: </span>
              <a href="mailto:support@alphamate.app" className="text-[#D8B4FE] underline">
                support@alphamate.app
              </a>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <Globe className="w-4 h-4 text-[#A855F7] shrink-0" />
              <span>Official Website: https://alphamate.app/privacy</span>
            </div>
            <div className="text-xs text-zinc-400 pt-1">
              Application: Alpha Mate (Android Package: <code className="text-zinc-300">com.alphamate.live</code>)
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full h-full flex-1 bg-[#09070F] text-zinc-200 overflow-y-auto overscroll-contain select-text">
      {/* Sticky Top App Bar */}
      <header className="sticky top-0 z-30 w-full bg-[#09070F]/90 backdrop-blur-md border-b border-[#A855F7]/20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={navigateBack}
            className="min-w-[44px] min-h-[44px] -ml-2 px-2 rounded-full flex items-center justify-center gap-1.5 text-zinc-300 hover:text-white hover:bg-white/5 transition cursor-pointer"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-semibold hidden sm:inline">Back</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <AlphaMateLogo size="sm" showText={false} customLogoUrl={customLogoUrl} />
            <h1 className="text-sm sm:text-base font-bold text-white truncate">Privacy Policy</h1>
          </div>

          <button
            type="button"
            onClick={() => setCurrentScreen('terms_conditions')}
            className="min-h-[44px] px-3 rounded-xl bg-[#1A1033] hover:bg-[#251649] border border-[#A855F7]/30 text-[11px] sm:text-xs font-bold text-[#D8B4FE] flex items-center gap-1.5 shrink-0 cursor-pointer transition"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-16 space-y-6">
        {/* Hero Banner Card */}
        <section className="rounded-3xl bg-gradient-to-br from-[#170E2E] via-[#130B24] to-[#0E071B] border border-[#A855F7]/30 p-5 sm:p-7 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#7928CA]/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C084FC]">
                Alpha Mate Legal Documentation
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Alpha Mate Privacy Policy
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                Effective Date: <span className="text-zinc-200 font-semibold">{EFFECTIVE_DATE}</span> &bull; URL:{' '}
                <span className="text-[#D8B4FE]">https://alphamate.app/privacy</span>
              </p>
            </div>
          </div>
        </section>

        {/* Quick Section Jump Grid */}
        <nav
          aria-label="Privacy Policy Sections"
          className="rounded-2xl bg-[#120B22] border border-white/10 p-4 sm:p-5"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Contents ({sections.length} Sections)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#privacy-${s.id}`}
                className="text-xs text-zinc-300 hover:text-[#D8B4FE] py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition truncate"
              >
                <span className="text-[#A855F7] font-bold mr-1.5">{s.number}.</span>
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Policy Sections */}
        <div className="space-y-4">
          {sections.map((section) => (
            <section
              key={section.id}
              id={`privacy-${section.id}`}
              className="scroll-mt-16 rounded-2xl bg-[#120B22]/90 border border-white/10 p-4 sm:p-6 space-y-3"
            >
              <h3 className="text-base sm:text-lg font-bold text-white flex items-baseline gap-2">
                <span className="text-[#EC4899] font-black">{section.number}.</span>
                <span>{section.title}</span>
              </h3>
              <div className="text-xs sm:text-sm text-zinc-300 leading-relaxed space-y-2.5">
                {section.content}
              </div>
            </section>
          ))}
        </div>

        {/* Footer Switch */}
        <footer className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 text-xs text-zinc-400">
          <span>&copy; {new Date().getFullYear()} Alpha Mate. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setCurrentScreen('terms_conditions')}
              className="min-h-[44px] px-2 text-[#D8B4FE] hover:text-white font-semibold underline underline-offset-4 cursor-pointer"
            >
              Read Terms &amp; Conditions
            </button>
            <a
              href="mailto:support@alphamate.app"
              className="min-h-[44px] flex items-center px-2 text-zinc-300 hover:text-white underline underline-offset-4"
            >
              support@alphamate.app
            </a>
          </div>
        </footer>
      </main>
    </div>
  );
};
