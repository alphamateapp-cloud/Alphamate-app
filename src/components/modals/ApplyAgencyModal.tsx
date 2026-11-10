import React, { useState } from 'react';
import {
  X,
  Coins,
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Phone,
  MessageCircle,
  CreditCard,
  Building2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ApplyAgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: 'coin_seller' | 'host_agency';
}

export const ApplyAgencyModal: React.FC<ApplyAgencyModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'host_agency',
}) => {
  const { currentUser, submitAgencyApplication } = useApp();

  const [agencyType, setAgencyType] = useState<'coin_seller' | 'host_agency'>(defaultType);
  const [agencyName, setAgencyName] = useState('');
  const [agencyTag, setAgencyTag] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [idCardNumber, setIdCardNumber] = useState('');
  const [experience, setExperience] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!agencyName.trim()) {
      setErrorMsg('Please enter your proposed Agency Name');
      return;
    }

    if (agencyType === 'host_agency' && !agencyTag.trim()) {
      setErrorMsg('Please choose a 2-6 character Agency Tag');
      return;
    }

    if (!whatsapp.trim() || !phoneNumber.trim()) {
      setErrorMsg('Please enter both your WhatsApp and Phone Number');
      return;
    }

    if (!agreedTerms) {
      setErrorMsg('Please agree to the Official Agency Terms & Regulations');
      return;
    }

    const cleanTag = agencyTag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

    const res = submitAgencyApplication({
      type: agencyType,
      applicantUserId: currentUser.id,
      applicantName: currentUser.displayName,
      applicantUniqueId: currentUser.uniqueId,
      agencyName: agencyName.trim(),
      agencyTag: cleanTag || undefined,
      whatsapp: whatsapp.trim(),
      phoneNumber: phoneNumber.trim(),
      idCardNumber: idCardNumber.trim() || undefined,
      experience: experience.trim() || 'Experienced live entertainment operator',
    });

    if (res.success) {
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2500);
    } else {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1C0D34] via-[#120822] to-[#0A0414] border border-amber-400/50 shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Top Gold Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-[#EC4899] to-amber-400" />

        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/10 bg-[#160A2C]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-[#EC4899] flex items-center justify-center text-black shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-black text-white">Apply for Official Agency</h3>
                <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[8.5px] font-black border border-amber-400/40">
                  LICENSE
                </span>
              </div>
              <p className="text-[10px] text-zinc-400">Merchant and Talent Agency Program</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h4 className="text-lg font-black text-white">Agency Application Submitted!</h4>
            <p className="text-xs text-zinc-300 max-w-xs mx-auto">
              Your application has been received by Alpha Mate Official Admin. Our team will verify your credentials and activate your agency panel.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-5 py-4 overflow-y-auto space-y-3.5 scrollbar-none flex-1">
            {/* Step 1: Select Agency License Type */}
            <div>
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1.5">
                1. Select Agency License Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAgencyType('coin_seller')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    agencyType === 'coin_seller'
                      ? 'bg-amber-400/20 border-amber-400 shadow-md'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold text-xs">
                    <Coins className="w-4 h-4 fill-amber-400" />
                    <span>Coin Seller Agency</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1">Direct coin stock & user order sales</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAgencyType('host_agency')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    agencyType === 'host_agency'
                      ? 'bg-[#7928CA]/30 border-purple-400 shadow-md'
                      : 'bg-white/5 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-purple-300 font-bold text-xs">
                    <Users className="w-4 h-4" />
                    <span>Host Agency</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-1">Recruit hosts, set targets & commissions</span>
                </button>
              </div>
            </div>

            {/* Step 2: Agency Name & Tag */}
            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
                  Proposed Agency Name
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="e.g. Sultan Royal Exchange / Nova Talent"
                  className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white"
                />
              </div>

              {agencyType === 'host_agency' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                      Host Agency Tag (2-6 Letters)
                    </label>
                    <span className="text-[9.5px] text-amber-400">Shown next to host names</span>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    value={agencyTag}
                    onChange={(e) => setAgencyTag(e.target.value.toUpperCase())}
                    placeholder="e.g. ROYAL, NOVA, STAR"
                    className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs font-mono font-black text-amber-300 uppercase tracking-widest"
                  />
                </div>
              )}
            </div>

            {/* Step 3: Contact & KYC Verification */}
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block">
                Contact & KYC Details
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+92 300 7654321"
                    className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white"
                  />
                </div>
              </div>

              {/* ID Card / CNIC (Optional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-zinc-400">National ID Card / CNIC Number</label>
                  <span className="text-[9px] text-zinc-500 font-bold">Optional</span>
                </div>
                <input
                  type="text"
                  value={idCardNumber}
                  onChange={(e) => setIdCardNumber(e.target.value)}
                  placeholder="35201-XXXXXXX-X (Optional for faster verification)"
                  className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white"
                />
              </div>

              {/* Experience */}
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">
                  Agency Plan / Management Experience
                </label>
                <textarea
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="Describe your talent network, expected monthly volume, or streaming background..."
                  className="w-full h-14 p-2 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white resize-none"
                />
              </div>
            </div>

            {/* Terms and Regulations Checkbox */}
            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="termsCheck"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 accent-amber-400"
              />
              <label htmlFor="termsCheck" className="text-[10.5px] text-zinc-300 leading-tight cursor-pointer">
                I agree to the Alpha Mate Agency Code of Conduct, fair target distribution, and official anti-fraud merchant policies.
              </label>
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-95 cursor-pointer mt-2"
            >
              <FileCheck className="w-4 h-4" />
              <span>Submit Official Agency Application</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
