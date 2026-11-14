import React from 'react';
import { Check, FileText, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface LegalConsentCheckboxesProps {
  agreedToTerms: boolean;
  onToggleTerms: (next: boolean) => void;
  agreedToPrivacy: boolean;
  onTogglePrivacy: (next: boolean) => void;
  hasError?: boolean;
}

export const LegalConsentCheckboxes: React.FC<LegalConsentCheckboxesProps> = ({
  agreedToTerms,
  onToggleTerms,
  agreedToPrivacy,
  onTogglePrivacy,
  hasError = false,
}) => {
  const { setCurrentScreen } = useApp();

  return (
    <div
      className={`rounded-2xl p-3 border transition-colors ${
        hasError && (!agreedToTerms || !agreedToPrivacy)
          ? 'bg-rose-500/10 border-rose-500/50'
          : 'bg-[#120A24]/90 border-[#A855F7]/25'
      }`}
    >
      <div className="space-y-1">
        {/* Checkbox 1: Terms & Conditions */}
        <label className="min-h-[44px] flex items-center gap-2.5 px-1.5 py-1 rounded-xl hover:bg-white/[0.03] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => onToggleTerms(e.target.checked)}
            className="sr-only peer"
          />
          <span
            aria-hidden="true"
            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-[#EC4899] ${
              agreedToTerms
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] border-[#EC4899] shadow-sm shadow-[#EC4899]/40'
                : hasError
                ? 'border-rose-400 bg-[#0B0617]'
                : 'border-zinc-500 bg-[#0B0617]'
            }`}
          >
            {agreedToTerms && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
          </span>
          <span className="text-[11px] sm:text-xs text-zinc-200 leading-snug">
            I agree to Alpha Mate&apos;s{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentScreen('terms_conditions');
              }}
              className="inline-flex items-center gap-1 text-[#D8B4FE] hover:text-white font-bold underline underline-offset-2 cursor-pointer py-0.5"
            >
              <FileText className="w-3 h-3 inline" />
              <span>Terms &amp; Conditions</span>
            </button>
            <span className="text-rose-400 font-bold ml-0.5">*</span>
          </span>
        </label>

        {/* Checkbox 2: Privacy Policy */}
        <label className="min-h-[44px] flex items-center gap-2.5 px-1.5 py-1 rounded-xl hover:bg-white/[0.03] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={agreedToPrivacy}
            onChange={(e) => onTogglePrivacy(e.target.checked)}
            className="sr-only peer"
          />
          <span
            aria-hidden="true"
            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-[#EC4899] ${
              agreedToPrivacy
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] border-[#EC4899] shadow-sm shadow-[#EC4899]/40'
                : hasError
                ? 'border-rose-400 bg-[#0B0617]'
                : 'border-zinc-500 bg-[#0B0617]'
            }`}
          >
            {agreedToPrivacy && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
          </span>
          <span className="text-[11px] sm:text-xs text-zinc-200 leading-snug">
            I have read and agree to Alpha Mate&apos;s{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setCurrentScreen('privacy_policy');
              }}
              className="inline-flex items-center gap-1 text-[#D8B4FE] hover:text-white font-bold underline underline-offset-2 cursor-pointer py-0.5"
            >
              <ShieldCheck className="w-3 h-3 inline" />
              <span>Privacy Policy</span>
            </button>
            <span className="text-rose-400 font-bold ml-0.5">*</span>
          </span>
        </label>
      </div>
    </div>
  );
};
