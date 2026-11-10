import React, { useState } from 'react';
import {
  X,
  Users,
  ShieldCheck,
  Award,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Clock,
  ArrowRight,
  LogOut,
  Star,
  Target,
  Send,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HostAgencyProfile } from '../../types';

interface JoinAgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JoinAgencyModal: React.FC<JoinAgencyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentUser,
    allHostAgencies,
    agencyHosts,
    submitHostJoinRequest,
    requestHostResignation,
  } = useApp();

  // Selected agency for application form
  const [selectedAgency, setSelectedAgency] = useState<HostAgencyProfile | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [experience, setExperience] = useState('');
  const [expectedHours, setExpectedHours] = useState(15);
  const [resignationReason, setResignationReason] = useState('');
  const [showResignPrompt, setShowResignPrompt] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  // Check if current user is already an agency host
  const isBoundToAgency = Boolean(currentUser.agencyId || currentUser.agencyTag);
  const myHostRecord = agencyHosts.find(
    (h) => h.userId === currentUser.id || h.uniqueId === currentUser.uniqueId
  );

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!selectedAgency) return;
    if (!whatsapp.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Please enter your WhatsApp or contact number' });
      return;
    }

    const res = submitHostJoinRequest(
      selectedAgency.agencyId,
      whatsapp.trim(),
      experience.trim() || 'Aspiring live host ready to meet weekly targets',
      expectedHours
    );

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: res.message });
      setSelectedAgency(null);
      setTimeout(() => {
        setFeedbackMsg(null);
        onClose();
      }, 2000);
    } else {
      setFeedbackMsg({ type: 'error', text: res.message });
    }
  };

  const handleResign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resignationReason.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Please provide a reason for resignation' });
      return;
    }

    const res = requestHostResignation(resignationReason.trim());
    if (res.success) {
      setFeedbackMsg({ type: 'success', text: res.message });
      setShowResignPrompt(false);
      setResignationReason('');
    } else {
      setFeedbackMsg({ type: 'error', text: res.message });
    }
  };

  const handleWhatsAppContact = (agency: HostAgencyProfile) => {
    const cleanNum = agency.whatsappNumber.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(
      `Hello ${agency.agencyName}! I am an Alpha Mate creator (ID: ${currentUser.uniqueId}) interested in joining your official host agency. Please share requirements.`
    );
    window.open(`https://wa.me/${cleanNum}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1C0D34] via-[#120822] to-[#0A0414] border border-amber-400/50 shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Top Gold Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-[#EC4899] to-amber-400" />

        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/10 bg-[#160A2C]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow-md">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-black text-white">
                  {isBoundToAgency ? 'My Agency Affiliation' : 'Join Official Host Agency'}
                </h3>
                <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[8.5px] font-black border border-amber-400/40">
                  TALENT
                </span>
              </div>
              <p className="text-[10.5px] text-zinc-400">
                {isBoundToAgency
                  ? `Bound to ${currentUser.agencyName || 'Official Agency'}`
                  : 'Official talent contract, weekly targets & commission'}
              </p>
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
        <div className="px-5 py-4 overflow-y-auto space-y-4 scrollbar-none flex-1">
          {/* Feedback Toast */}
          {feedbackMsg && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-center gap-2.5 animate-fade-in ${
                feedbackMsg.type === 'success'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-200'
              }`}
            >
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* VIEW A: USER IS ALREADY BOUND TO AN AGENCY */}
          {isBoundToAgency ? (
            <div className="space-y-4">
              {/* Bound Agency Card */}
              <div className="rounded-3xl p-4 bg-gradient-to-r from-[#2A0E4E] via-[#1B0A33] to-[#140626] border border-amber-400/40 shadow-xl relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                      Current Agency Contract
                    </span>
                    <h3 className="text-base font-black text-white mt-0.5">
                      {currentUser.agencyName || myHostRecord?.agencyName || 'Alpha Royal Talent Agency'}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider shadow">
                        Tag: [{currentUser.agencyTag || myHostRecord?.agencyTag || 'ROYAL'}]
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                        Officially Bound
                      </span>
                    </div>
                  </div>

                  <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                </div>

                {/* Exclusivity Notice */}
                <p className="text-[10.5px] text-zinc-300 mt-3 pt-3 border-t border-white/10 leading-snug">
                  You are officially bound to this agency. Your profile name displays the <strong>[{currentUser.agencyTag || 'ROYAL'}]</strong> official tag. A creator bound to one agency cannot join any other agency.
                </p>
              </div>

              {/* Host Performance & Weekly Target */}
              {myHostRecord && (
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-zinc-200 flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-amber-400" />
                      <span>Weekly Streaming Target</span>
                    </span>
                    <span
                      className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${
                        myHostRecord.targetStatus === 'achieved'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      }`}
                    >
                      {myHostRecord.targetStatus}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-[#EC4899] rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (myHostRecord.currentProgressDiamonds /
                              myHostRecord.weeklyTargetDiamonds) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-400">
                      Progress: <strong className="text-white">{myHostRecord.currentProgressDiamonds.toLocaleString()}</strong>
                    </span>
                    <span className="text-amber-300 font-bold">
                      Target: {myHostRecord.weeklyTargetDiamonds.toLocaleString()} 💎
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-black/30">
                      <span className="text-[10px] text-zinc-400 uppercase block">Hours Streamed</span>
                      <span className="font-bold font-mono text-white">
                        {myHostRecord.weeklyHoursStreamed} hrs / {myHostRecord.weeklyTargetHours} hrs
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-black/30">
                      <span className="text-[10px] text-zinc-400 uppercase block">Commission Split</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {100 - myHostRecord.commissionRate}% Host / {myHostRecord.commissionRate}% Agency
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Resignation / Withdrawal Option */}
              <div className="pt-2 border-t border-white/10">
                {myHostRecord?.resignationRequested ? (
                  <div className="p-3 rounded-2xl bg-amber-400/15 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Resignation request submitted to agency admin. Waiting for official release.
                    </span>
                  </div>
                ) : showResignPrompt ? (
                  <form onSubmit={handleResign} className="space-y-2 p-3 rounded-2xl bg-black/40 border border-white/10">
                    <label className="text-[11px] font-bold text-zinc-300 block">
                      State reason for resignation:
                    </label>
                    <textarea
                      value={resignationReason}
                      onChange={(e) => setResignationReason(e.target.value)}
                      placeholder="e.g. Schedule conflict, switching streaming focus, personal reasons..."
                      className="w-full h-16 p-2 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowResignPrompt(false)}
                        className="flex-1 py-1.5 rounded-xl bg-white/10 text-xs font-bold text-zinc-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-black text-white cursor-pointer shadow"
                      >
                        Submit Request
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowResignPrompt(true)}
                    className="w-full py-2.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Request Agency Resignation</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* VIEW B: USER NOT BOUND - BROWSE OFFICIAL HOST AGENCIES */
            <div className="space-y-3.5">
              <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-transparent border border-amber-400/30 text-[11px] text-zinc-300 leading-snug">
                Join an authorized Alpha Mate Host Agency to receive official agency tags, weekly diamond targets, streaming bonuses, and room support.
              </div>

              {/* Application Form Drawer (If an agency is selected) */}
              {selectedAgency ? (
                <form onSubmit={handleApply} className="p-4 rounded-3xl bg-[#170B2F] border border-amber-400/50 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div>
                      <h4 className="text-xs font-black text-white">Apply to {selectedAgency.agencyName}</h4>
                      <span className="text-[10px] text-amber-300">Official Tag: [{selectedAgency.agencyTag}]</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAgency(null)}
                      className="text-zinc-400 hover:text-white text-xs"
                    >
                      Change Agency
                    </button>
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-zinc-300 block mb-1">
                      Your WhatsApp Contact
                    </label>
                    <input
                      type="text"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="+92 300 1234567"
                      className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-zinc-300 block mb-1">
                      Streaming Experience / Category
                    </label>
                    <input
                      type="text"
                      value={experience}
                      onChange={(e) => setExperience(e.target.value)}
                      placeholder="e.g. Singing, Chat Host, Gaming, PK Battler"
                      className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-zinc-300 block mb-1">
                      Expected Weekly Live Hours ({expectedHours} hrs/week)
                    </label>
                    <input
                      type="range"
                      min={10}
                      max={40}
                      step={2}
                      value={expectedHours}
                      onChange={(e) => setExpectedHours(parseInt(e.target.value, 10))}
                      className="w-full accent-amber-400"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedAgency(null)}
                      className="flex-1 h-10 rounded-xl bg-white/10 text-xs font-bold text-zinc-300 cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex-[2] h-10 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-md"
                    >
                      Submit Application
                    </button>
                  </div>
                </form>
              ) : (
                /* Agency Cards List */
                <div className="space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block">
                    Available Official Host Agencies ({allHostAgencies.length})
                  </span>

                  {allHostAgencies.map((agency) => (
                    <div
                      key={agency.agencyId}
                      className="p-3.5 rounded-2xl bg-[#150A2B] hover:bg-[#1B0D36] border border-white/10 hover:border-amber-400/40 transition-all flex flex-col justify-between gap-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow font-black text-sm">
                            {agency.agencyTag.slice(0, 2)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-xs sm:text-sm font-black text-white">{agency.agencyName}</h4>
                              <span className="px-1.5 py-0.2 rounded bg-amber-400 text-black text-[8.5px] font-black uppercase">
                                [{agency.agencyTag}]
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-300 mt-0.5 line-clamp-1">{agency.slogan}</p>
                          </div>
                        </div>

                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[8.5px] font-bold shrink-0">
                          Verified
                        </span>
                      </div>

                      {/* Agency Stats Pills */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-white/5">
                        <div className="flex items-center gap-1 text-zinc-300">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>Min {agency.minWeeklyHours} hrs/week</span>
                        </div>
                        <div className="flex items-center gap-1 text-zinc-300 justify-end">
                          <Award className="w-3 h-3 text-emerald-400" />
                          <span>{100 - agency.defaultCommissionRate}% Host Share</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleWhatsAppContact(agency)}
                          className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>WhatsApp 💬</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedAgency(agency)}
                          className="flex-1 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-black text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1 shadow cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Join Agency</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-white/10 bg-[#0F071B]/95 text-center">
          <p className="text-[10px] text-zinc-400">
            Alpha Mate Official Talent Network • Verified Agency Partner Program
          </p>
        </div>
      </div>
    </div>
  );
};
