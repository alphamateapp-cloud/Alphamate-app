import React, { useState } from 'react';
import {
  X,
  Users,
  Award,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  MessageSquare,
  Clock,
  LogOut,
  Target,
  Send,
  Hash,
  UserCheck,
  Building2,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HostAgencyProfile } from '../../types';
import { buildWhatsAppUrl, openExternalWhatsApp } from '../../services/agencySyncService';

interface JoinAgencyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getAgencyInitials = (name: string, tag?: string): string => {
  if (tag && tag.trim()) return tag.trim().slice(0, 2).toUpperCase();
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || 'HA';
};

export const JoinAgencyModal: React.FC<JoinAgencyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const {
    currentUser,
    allHostAgencies,
    agencyHosts,
    hostAgencyMembership,
    submitHostJoinRequest,
    requestHostResignation,
    contactAgencyInApp,
    setCurrentScreen,
  } = useApp();

  // Selected agency for application form
  const [selectedAgency, setSelectedAgency] = useState<HostAgencyProfile | null>(null);
  const [whatsapp, setWhatsapp] = useState('');
  const [experience, setExperience] = useState('');
  const [expectedHours, setExpectedHours] = useState(15);
  const [resignationReason, setResignationReason] = useState('');
  const [showResignPrompt, setShowResignPrompt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const isBoundToAgency = hostAgencyMembership.isActiveMember;
  const pendingRequest = hostAgencyMembership.pendingRequest;
  const latestRejectedRequest = hostAgencyMembership.latestRejectedRequest;

  const myHostRecord = agencyHosts.find(
    (h) => h.userId === currentUser.id || h.uniqueId === currentUser.uniqueId
  );

  const assignedAgencyDoc = hostAgencyMembership.agencyId
    ? allHostAgencies.find((a) => a.agencyId === hostAgencyMembership.agencyId) || null
    : null;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (!selectedAgency || submitting) return;
    if (!whatsapp.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Please enter your WhatsApp or contact number' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitHostJoinRequest(
        selectedAgency.agencyId,
        whatsapp.trim(),
        experience.trim() || 'Aspiring live host ready to meet weekly targets',
        expectedHours
      );

      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message });
        setSelectedAgency(null);
        setWhatsapp('');
        setExperience('');
      } else {
        setFeedbackMsg({ type: 'error', text: res.message });
      }
    } finally {
      setSubmitting(false);
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
    if (!agency.hasValidWhatsApp || !agency.whatsappNumber) return;
    const url = buildWhatsAppUrl(
      agency.whatsappNumber,
      `Hello ${agency.agencyName} (Code: ${agency.agencyCode})! I am an Alpha Mate creator (ID: ${currentUser.uniqueId}) interested in joining your Official Host Agency. Please share requirements.`
    );
    if (url) {
      openExternalWhatsApp(url);
    }
  };

  const handleOpenOwnerChat = async (agency: {
    agencyId: string;
    agencyName: string;
    agencyCode?: string;
    ownerUserId: string;
    ownerName?: string;
    ownerAvatar?: string;
  }) => {
    const res = await contactAgencyInApp(agency);
    if (res.success) {
      onClose();
    } else {
      setFeedbackMsg({ type: 'error', text: res.message });
    }
  };

  const handleOpenHostPortal = () => {
    onClose();
    setCurrentScreen('agency_management');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#1C0D34] via-[#120822] to-[#0A0414] border border-amber-400/50 shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Top Gold Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-[#EC4899] to-amber-400" />

        {/* Modal Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2 border-b border-white/10 bg-[#160A2C]/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow-md shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  {isBoundToAgency ? 'My Host Agency' : 'Join Official Host Agency'}
                </h3>
                <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[8.5px] font-black border border-amber-400/40 uppercase">
                  HOST AGENCY
                </span>
              </div>
              <p className="text-[10.5px] text-zinc-400 truncate">
                {isBoundToAgency
                  ? `Active Member • ${hostAgencyMembership.agencyName || 'Official Host Agency'}`
                  : pendingRequest
                  ? 'Application Pending Super Admin Approval'
                  : 'Select an active Official Host Agency to apply'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
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

          {/* VIEW A: USER HAS SUPER ADMIN APPROVED ACTIVE HOST AGENCY MEMBERSHIP */}
          {isBoundToAgency ? (
            <div className="space-y-4">
              {/* Bound Agency Card */}
              <div className="rounded-3xl p-4 bg-gradient-to-r from-[#2A0E4E] via-[#1B0A33] to-[#140626] border border-amber-400/40 shadow-xl relative overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {assignedAgencyDoc?.logo ? (
                      <img
                        src={assignedAgencyDoc.logo}
                        alt={hostAgencyMembership.agencyName || 'Host Agency'}
                        className="w-12 h-12 rounded-2xl object-cover border-2 border-amber-400/80 shadow shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] border-2 border-amber-400/70 flex items-center justify-center text-white font-black text-sm shrink-0">
                        {getAgencyInitials(
                          hostAgencyMembership.agencyName || 'Host Agency',
                          hostAgencyMembership.agencyTag
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                        Approved Host Agency
                      </span>
                      <h3 className="text-base font-black text-white mt-0.5 truncate">
                        {hostAgencyMembership.agencyName || myHostRecord?.agencyName || 'Official Host Agency'}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {hostAgencyMembership.agencyCode && (
                          <span className="px-2 py-0.5 rounded-lg bg-white/10 text-amber-300 text-[10px] font-mono font-bold border border-amber-400/30">
                            Code: {hostAgencyMembership.agencyCode}
                          </span>
                        )}
                        {hostAgencyMembership.agencyTag && (
                          <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-black text-[10px] font-black uppercase tracking-wider shadow">
                            [{hostAgencyMembership.agencyTag}]
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                          Active Member
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Agency ID & Owner Info */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/10 text-[10.5px]">
                  <div className="p-2 rounded-xl bg-black/30">
                    <span className="text-[9.5px] text-zinc-400 uppercase font-bold block">Agency ID</span>
                    <span className="font-mono font-bold text-zinc-200 truncate block">
                      {hostAgencyMembership.agencyCode || hostAgencyMembership.agencyId}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-black/30">
                    <span className="text-[9.5px] text-zinc-400 uppercase font-bold block">Agency Owner</span>
                    <span className="font-bold text-white truncate block">
                      {hostAgencyMembership.ownerName || assignedAgencyDoc?.ownerName || 'Official Owner'}
                    </span>
                  </div>
                </div>

                {/* Quick Portal & Owner Contact Buttons */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenHostPortal}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-[11px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 shadow cursor-pointer hover:brightness-110 transition-all"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Open Host Portal</span>
                  </button>

                  {hostAgencyMembership.ownerUserId && (
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenOwnerChat({
                          agencyId: hostAgencyMembership.agencyId || '',
                          agencyName: hostAgencyMembership.agencyName || 'Host Agency',
                          agencyCode: hostAgencyMembership.agencyCode,
                          ownerUserId: hostAgencyMembership.ownerUserId || '',
                          ownerName: hostAgencyMembership.ownerName,
                          ownerAvatar: assignedAgencyDoc?.ownerAvatar,
                        })
                      }
                      className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-zinc-100 text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-amber-300" />
                      <span>Chat Owner</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Host Performance & Weekly Target (when host record exists) */}
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
                              Math.max(1, myHostRecord.weeklyTargetDiamonds)) *
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
            /* VIEW B: USER NOT AN ACTIVE MEMBER - PENDING / REJECTED STATUS + ACTIVE HOST AGENCIES */
            <div className="space-y-3.5">
              {/* Pending Application Banner (prevents duplicate applications & blocks premature membership) */}
              {pendingRequest && (
                <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-400/50 space-y-2 shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-black text-amber-200 uppercase tracking-wide">
                        Pending Application
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-400/25 border border-amber-400/50 text-[9px] font-black text-amber-200 uppercase">
                      Pending
                    </span>
                  </div>
                  <div className="text-xs text-white font-bold">
                    {pendingRequest.agencyName || 'Selected Host Agency'}
                    {pendingRequest.agencyCode ? (
                      <span className="ml-1.5 text-[10px] font-mono text-amber-300">
                        ({pendingRequest.agencyCode})
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[10.5px] text-zinc-200 leading-relaxed">
                    Your Host Agency join request has been sent to Super Admin for review. Submitted{' '}
                    <strong className="text-amber-200">{pendingRequest.appliedDate}</strong>. Agency membership and features will unlock only after Super Admin approves your request.
                  </p>
                </div>
              )}

              {/* Rejected Application Status & Reason Banner */}
              {!pendingRequest && latestRejectedRequest && (
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-rose-200 text-xs font-black">
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Previous Application Rejected</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/25 border border-rose-400/40 text-[9px] font-black text-rose-200 uppercase">
                      Rejected
                    </span>
                  </div>
                  <p className="text-[10.5px] text-zinc-200">
                    Agency: <strong className="text-white">{latestRejectedRequest.agencyName || 'Host Agency'}</strong>
                  </p>
                  {latestRejectedRequest.rejectionReason && (
                    <p className="text-[10.5px] text-rose-200/90 bg-black/25 px-2.5 py-1.5 rounded-xl border border-rose-500/20">
                      Reason: {latestRejectedRequest.rejectionReason}
                    </p>
                  )}
                  <p className="text-[10px] text-zinc-400">
                    You remain outside the agency and may apply to any active Host Agency below.
                  </p>
                </div>
              )}

              {!pendingRequest && (
                <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-transparent border border-amber-400/30 text-[11px] text-zinc-300 leading-snug">
                  Apply to an officially activated Alpha Mate Host Agency. Your request will be reviewed by Super Admin before membership becomes active.
                </div>
              )}

              {/* Application Form Drawer (If an agency is selected & no pending application exists) */}
              {selectedAgency && !pendingRequest ? (
                <form onSubmit={handleApply} className="p-4 rounded-3xl bg-[#170B2F] border border-amber-400/50 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-white truncate">Apply to {selectedAgency.agencyName}</h4>
                      <span className="text-[10px] text-amber-300 font-mono">
                        Code: {selectedAgency.agencyCode} • Tag: [{selectedAgency.agencyTag}]
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAgency(null)}
                      className="text-zinc-400 hover:text-white text-xs shrink-0 cursor-pointer"
                    >
                      Change
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

                  <p className="text-[10px] text-zinc-400 leading-snug">
                    Status will be saved as <strong className="text-amber-300">Pending</strong> until approved by Super Admin.
                  </p>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setSelectedAgency(null)}
                      className="flex-1 h-10 rounded-xl bg-white/10 text-xs font-bold text-zinc-300 cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-[2] h-10 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 disabled:opacity-60 text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-md"
                    >
                      {submitting ? 'Submitting...' : 'Submit Application'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Active Host Agency Cards List */
                <div className="space-y-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block">
                    Active Official Host Agencies ({allHostAgencies.length})
                  </span>

                  {allHostAgencies.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-[#150A2B] border border-white/10 text-center space-y-2">
                      <Users className="w-8 h-8 text-zinc-500 mx-auto" />
                      <p className="text-xs font-bold text-white">No Active Host Agencies Available</p>
                      <p className="text-[10.5px] text-zinc-400 leading-relaxed">
                        Active Official Host Agencies approved by Super Admin will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    allHostAgencies.map((agency) => {
                      const hasValidWa = Boolean(agency.hasValidWhatsApp && agency.whatsappNumber);
                      const isPendingForThis = pendingRequest?.agencyId === agency.agencyId;
                      const hostCount =
                        typeof agency.totalHosts === 'number'
                          ? agency.totalHosts
                          : agency.activeHostsCount;

                      return (
                        <div
                          key={agency.agencyId}
                          className="p-3.5 rounded-2xl bg-[#150A2B] hover:bg-[#1B0D36] border border-white/10 hover:border-amber-400/40 transition-all flex flex-col justify-between gap-3 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {agency.logo ? (
                                <img
                                  src={agency.logo}
                                  alt={agency.agencyName}
                                  className="w-11 h-11 rounded-xl object-cover border border-amber-400/60 shadow shrink-0"
                                />
                              ) : (
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow font-black text-sm shrink-0">
                                  {getAgencyInitials(agency.agencyName, agency.agencyTag)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-xs sm:text-sm font-black text-white truncate">
                                    {agency.agencyName}
                                  </h4>
                                  <span className="px-1.5 py-0.5 rounded bg-amber-400 text-black text-[8.5px] font-black uppercase">
                                    [{agency.agencyTag}]
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-300 mt-0.5 flex-wrap">
                                  <span className="inline-flex items-center gap-0.5 font-mono text-amber-300">
                                    <Hash className="w-2.5 h-2.5" />
                                    <span>{agency.agencyCode}</span>
                                  </span>
                                  {agency.ownerName && (
                                    <span className="inline-flex items-center gap-1 text-zinc-300 truncate">
                                      <UserCheck className="w-2.5 h-2.5 text-purple-300 shrink-0" />
                                      <span className="truncate">{agency.ownerName}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[8.5px] font-black uppercase shrink-0">
                              Active
                            </span>
                          </div>

                          {/* Agency Metadata Row: Assigned Hosts, Min Hours & Host Share */}
                          <div className="grid grid-cols-3 gap-1.5 text-[10px] pt-2 border-t border-white/5">
                            <div className="flex items-center gap-1 text-zinc-300">
                              <Users className="w-3 h-3 text-purple-400 shrink-0" />
                              <span className="truncate">{hostCount} Hosts</span>
                            </div>
                            <div className="flex items-center gap-1 text-zinc-300 justify-center">
                              <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="truncate">{agency.minWeeklyHours}h/wk</span>
                            </div>
                            <div className="flex items-center gap-1 text-zinc-300 justify-end">
                              <Award className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">{100 - agency.defaultCommissionRate}% Share</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 pt-1">
                            {hasValidWa && (
                              <button
                                type="button"
                                onClick={() => handleWhatsAppContact(agency)}
                                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors shrink-0"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>WhatsApp</span>
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={Boolean(pendingRequest)}
                              onClick={() => setSelectedAgency(agency)}
                              className={`flex-1 py-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow transition-all ${
                                isPendingForThis
                                  ? 'bg-amber-400/20 border border-amber-400/50 text-amber-200 cursor-not-allowed'
                                  : pendingRequest
                                  ? 'bg-white/10 text-zinc-400 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-amber-400 to-amber-600 text-black cursor-pointer hover:brightness-110 active:scale-95'
                              }`}
                            >
                              {isPendingForThis ? (
                                <>
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Pending Approval</span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Join Agency</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-white/10 bg-[#0F071B]/95 text-center">
          <p className="text-[10px] text-zinc-400">
            Alpha Mate Official Host Agency Network • Super Admin Verified
          </p>
        </div>
      </div>
    </div>
  );
};
