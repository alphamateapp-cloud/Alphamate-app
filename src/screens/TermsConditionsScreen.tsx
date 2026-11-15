import React from 'react';
import { ArrowLeft, FileText, ShieldCheck, Scale, Mail, Globe } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';

const EFFECTIVE_DATE = 'November 14, 2026';

interface TermsSection {
  id: string;
  number: number;
  title: string;
  content: React.ReactNode;
}

export const TermsConditionsScreen: React.FC = () => {
  const { navigateBack, setCurrentScreen, customLogoUrl } = useApp();

  const sections: TermsSection[] = [
    {
      id: 'acceptance',
      number: 1,
      title: 'Acceptance',
      content: (
        <>
          <p>
            Welcome to <strong>Alpha Mate</strong> (<span className="text-[#D8B4FE]">https://alphamate.app</span>,
            Android package <code className="text-purple-200">com.alphamate.live</code>). These Terms &amp; Conditions
            (&ldquo;Terms&rdquo;) govern your access to and use of the Alpha Mate mobile application, website, live
            streams, voice party rooms, Moments/Reels, chat features, and in-app virtual economy.
          </p>
          <p>
            By creating an account, signing in, checking the Terms &amp; Conditions acceptance box, or using any part of
            Alpha Mate, you confirm that you are at least <strong>18 years old</strong>, that you have read and
            accepted these Terms, and that you also accept our{' '}
            <button
              type="button"
              onClick={() => setCurrentScreen('privacy_policy')}
              className="text-[#D8B4FE] hover:text-white underline font-semibold cursor-pointer"
            >
              Privacy Policy
            </button>
            . If you do not agree to these Terms, do not register for or use Alpha Mate.
          </p>
        </>
      ),
    },
    {
      id: 'ownership-of-coins',
      number: 2,
      title: 'Ownership of Coins',
      content: (
        <>
          <p>
            All coins available within Alpha Mate are the <strong>property of the application</strong>.
          </p>
          <p>
            Users receive a limited, non-exclusive, non-transferable, revocable permission to use coins within the
            application according to its rules. Coins do <strong>not</strong> represent personal ownership of cash, legal
            tender, stored-value currency, or an independent financial asset outside Alpha Mate.
          </p>
        </>
      ),
    },
    {
      id: 'coin-management-misuse',
      number: 3,
      title: 'Coin Management and Misuse',
      content: (
        <>
          <p>
            Alpha Mate reserves the right to investigate suspicious activity, fraud, exploitation, unauthorized
            transactions, chargeback abuse, technical manipulation, and policy violations across user wallets, gifting,
            and rooms.
          </p>
          <p>
            In cases of confirmed fraud or misuse, Alpha Mate may <strong>hold, adjust, remove, or reduce coin balances</strong>,
            including <strong>reducing balances to zero</strong> where justified under applicable policy and law.
          </p>
        </>
      ),
    },
    {
      id: 'virtual-gifts-purchases',
      number: 4,
      title: 'Virtual Gifts and Purchases',
      content: (
        <>
          <p>
            Virtual gifts, coins, VIP upgrades, profile frames, entrance animations, and other digital items offered
            within Alpha Mate are intended strictly for in-app entertainment and social interaction.
          </p>
          <p>
            Voluntary purchases and redemptions of coins, virtual gifts, and digital items are non-refundable once
            delivered or used in-app, subject to applicable consumer protection law and any mandatory refund rules
            required by the platform through which a purchase is processed.
          </p>
        </>
      ),
    },
    {
      id: 'withdrawals',
      number: 5,
      title: 'Withdrawals',
      content: (
        <>
          <p>
            Where Diamond withdrawals are made available to eligible users or hosts in the Wallet section, all
            withdrawal requests are strictly subject to:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
            <li>Account eligibility and good standing under these Terms.</li>
            <li>Minimum withdrawal thresholds and conversion references displayed in the Alpha Mate Wallet screen.</li>
            <li>Identity, payout-account, and anti-fraud verification prior to approval.</li>
            <li>The submission rules, payout methods, and pending review status shown in the application.</li>
          </ul>
          <p>
            Diamonds associated with a pending withdrawal request may remain held while administrative verification is
            in progress. Alpha Mate does not guarantee immediate disbursement and reserves the right to delay, hold, or
            reject withdrawal requests that involve inaccurate payout details, unverified activity, or suspected policy
            violations.
          </p>
        </>
      ),
    },
    {
      id: 'suspension-termination',
      number: 6,
      title: 'Account Suspension and Termination',
      content: (
        <>
          <p>
            Alpha Mate may mute, kick from rooms, restrict features, temporarily suspend, or permanently terminate any
            account that violates these Terms, engages in harassment, fraud, unauthorized access, underage use, or
            platform exploitation, or creates safety or legal risks for the community.
          </p>
          <p>
            You may stop using Alpha Mate at any time and may request permanent account deletion via{' '}
            <a href="mailto:support@alphamate.app" className="text-[#D8B4FE] underline font-semibold">
              support@alphamate.app
            </a>{' '}
            subject to the 15-day email-verified recovery period described in our Privacy Policy. Upon termination for
            serious violation or after permanent deletion completes, permission to access the application and any
            remaining virtual items or coins ends.
          </p>
        </>
      ),
    },
    {
      id: 'user-responsibilities',
      number: 7,
      title: 'User Responsibilities',
      content: (
        <ul className="list-disc pl-5 space-y-1.5 text-zinc-300">
          <li>
            <strong>Eligibility &amp; Accurate Information:</strong> You confirm you are at least 18 years old and that
            registration and payout details you submit are accurate and belong to you.
          </li>
          <li>
            <strong>Account Security:</strong> You are responsible for safeguarding your login credentials, Google/email
            access, and all activity occurring under your account.
          </li>
          <li>
            <strong>Lawful Conduct &amp; Content:</strong> You are solely responsible for all live video streams, voice
            party audio, Moments/Reels, stories, comments, and chat messages you publish or transmit. You must not post
            or broadcast unlawful, abusive, hateful, sexually explicit, infringing, defamatory, deceptive, or harmful
            material.
          </li>
          <li>
            <strong>No Exploitation:</strong> You must not attempt to manipulate coin or diamond balances, abuse bugs,
            impersonate staff or other users, automate scraping/spam, or interfere with live SFU/WebSocket services.
          </li>
        </ul>
      ),
    },
    {
      id: 'digital-items-services',
      number: 8,
      title: 'Digital Items and Application Services',
      content: (
        <>
          <p>
            All coins, diamonds, virtual gifts, VIP privileges, badges, levels, frames, and application features are
            digital services provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
          </p>
          <p>
            Alpha Mate may update, modify, rebalance, temporarily suspend, or discontinue any virtual item, gift catalog
            item, room layout, or application feature at any time for maintenance, security, regulatory compliance, or
            product improvement, to the fullest extent permitted by applicable law.
          </p>
        </>
      ),
    },
    {
      id: 'changes-to-terms',
      number: 9,
      title: 'Changes to Terms',
      content: (
        <p>
          Alpha Mate may revise these Terms &amp; Conditions from time to time. Updated Terms will be published within
          the application and at <span className="text-[#D8B4FE]">https://alphamate.app/terms</span> with an updated
          Effective Date. Your continued access to or use of Alpha Mate after updated Terms are published constitutes
          your acceptance of the revised Terms.
        </p>
      ),
    },
    {
      id: 'contact',
      number: 10,
      title: 'Contact Information',
      content: (
        <div className="space-y-2">
          <p>For questions regarding these Terms &amp; Conditions, wallet/withdrawal rules, or moderation appeals:</p>
          <div className="p-3.5 rounded-2xl bg-[#110A21] border border-[#A855F7]/25 space-y-1.5 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Mail className="w-4 h-4 text-[#EC4899] shrink-0" />
              <span>Support Email: </span>
              <a href="mailto:support@alphamate.app" className="text-[#D8B4FE] underline">
                support@alphamate.app
              </a>
            </div>
            <div className="flex items-center gap-2 text-zinc-300">
              <Globe className="w-4 h-4 text-[#A855F7] shrink-0" />
              <span>Official Terms URL: https://alphamate.app/terms</span>
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
            <h1 className="text-sm sm:text-base font-bold text-white truncate">Terms &amp; Conditions</h1>
          </div>

          <button
            type="button"
            onClick={() => setCurrentScreen('privacy_policy')}
            className="min-h-[44px] px-3 rounded-xl bg-[#1A1033] hover:bg-[#251649] border border-[#A855F7]/30 text-[11px] sm:text-xs font-bold text-[#D8B4FE] flex items-center gap-1.5 shrink-0 cursor-pointer transition"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-16 space-y-6">
        {/* Hero Banner Card */}
        <section className="rounded-3xl bg-gradient-to-br from-[#170E2E] via-[#130B24] to-[#0E071B] border border-[#A855F7]/30 p-5 sm:p-7 shadow-xl">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shrink-0 shadow-lg shadow-[#7928CA]/30">
              <Scale className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#C084FC]">
                Alpha Mate User Agreement
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Alpha Mate Terms &amp; Conditions
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                Effective Date: <span className="text-zinc-200 font-semibold">{EFFECTIVE_DATE}</span> &bull; URL:{' '}
                <span className="text-[#D8B4FE]">https://alphamate.app/terms</span>
              </p>
            </div>
          </div>
        </section>

        {/* Quick Section Jump Grid */}
        <nav
          aria-label="Terms & Conditions Sections"
          className="rounded-2xl bg-[#120B22] border border-white/10 p-4 sm:p-5"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Contents ({sections.length} Sections)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#terms-${s.id}`}
                className="text-xs text-zinc-300 hover:text-[#D8B4FE] py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition truncate"
              >
                <span className="text-[#A855F7] font-bold mr-1.5">{s.number}.</span>
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Terms Sections */}
        <div className="space-y-4">
          {sections.map((section) => (
            <section
              key={section.id}
              id={`terms-${section.id}`}
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
              onClick={() => setCurrentScreen('privacy_policy')}
              className="min-h-[44px] px-2 text-[#D8B4FE] hover:text-white font-semibold underline underline-offset-4 cursor-pointer flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Read Privacy Policy</span>
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
