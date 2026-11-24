import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
import {
  subscribeToAccountDeletionRequests,
  adminProcessAccountDeletionRequest,
} from '../services/firebase';
import { recordAdminModerationAction } from '../services/adminModerationService';
import { AccountDeletionRequest, LiveStream } from '../types';
import { DEFAULT_AVATAR_URL, safeImageSrc } from '../utils/imageHd';
import { AdvancedGiftManager } from '../components/admin/AdvancedGiftManager';
import {
  Activity,
  Users,
  Radio,
  ShieldAlert,
  DollarSign,
  Smartphone,
  Eye,
  AlertTriangle,
  Ban,
  CheckCircle,
  RefreshCw,
  Search,
  Server,
  Zap,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  Trash2,
  Sparkles,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    liveStreams,
    setDeviceMode,
    customLogoUrl,
    openLiveStream,
    agencyApplications,
    reviewAgencyApplication,
    hostJoinRequests,
    approveHostJoinRequest,
    rejectHostJoinRequest,
    officialCoinSellerProfiles,
    adminAllocateAgencyCoins,
    agencyTransactions,
    firebaseUser,
    giftTransactions,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>(liveStreams[0]?.id || '');
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [deletionRequests, setDeletionRequests] = useState<AccountDeletionRequest[]>([]);
  const [processingRequestUid, setProcessingRequestUid] = useState<string | null>(null);
  const [stockAllocationInputs, setStockAllocationInputs] = useState<Record<string, string>>({});
  const [allocatingAgencyId, setAllocatingAgencyId] = useState<string | null>(null);
  const [adminSection, setAdminSection] = useState<'overview' | 'gifts'>('overview');

  const isOfficialAdminUser = firebaseUser?.email?.toLowerCase() === 'alphamateapp@gmail.com';

  useEffect(() => {
    if (!isOfficialAdminUser) return;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToAccountDeletionRequests((items) => {
        setDeletionRequests(items as AccountDeletionRequest[]);
      });
    } catch (err) {
      console.warn('Account deletion queue listener error:', err);
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOfficialAdminUser]);

  const activeMonitorStream = liveStreams.find((s) => s.id === selectedStreamId) || liveStreams[0];

  const totalViewers = liveStreams.reduce((acc, s) => acc + s.viewerCount, 0);
  const totalGiftCoins = giftTransactions.reduce((acc, g) => acc + (g.totalCoins || 0), 0);
  const totalHostDiamonds = giftTransactions.reduce((acc, g) => acc + (g.hostDiamonds || 0), 0);
  const totalAppShareCoins = giftTransactions.reduce((acc, g) => acc + (g.appShareCoins || 0), 0);

  const handleAction = async (type: 'Warning' | 'Terminate', stream: LiveStream) => {
    const targetUid = stream.host?.id;
    const hostName = stream.host?.displayName || 'Host';
    if (!targetUid) return;
    const res = await recordAdminModerationAction({
      targetUserId: targetUid,
      actionKind: type === 'Warning' ? 'admin_warning' : 'live_suspended',
      reason:
        type === 'Warning'
          ? `Broadcast moderation warning on "${stream.title}"`
          : `Live stream "${stream.title}" terminated for guideline violation`,
      adminMessage:
        type === 'Warning'
          ? 'Please follow Alpha Mate Live streaming guidelines during your broadcast.'
          : 'Your live stream was terminated and Live access has been temporarily suspended for 24 hours.',
      durationHours: type === 'Terminate' ? 24 : null,
      isPermanent: false,
      streamIdToClose: type === 'Terminate' ? stream.id : undefined,
    });
    setActionNotice(
      res.success
        ? `Admin action applied: [${type}] persisted and delivered to ${hostName}.`
        : res.error || `Unable to deliver [${type}] to ${hostName}.`
    );
    setTimeout(() => setActionNotice(null), 4000);
  };

  const handleDeletionQueueAction = async (
    reqItem: AccountDeletionRequest,
    action: 'restore' | 'finalize'
  ) => {
    try {
      setProcessingRequestUid(reqItem.uid);
      await adminProcessAccountDeletionRequest(reqItem, action);
      setActionNotice(
        action === 'restore'
          ? `Account restored to active status for ${reqItem.displayName} (${reqItem.email}).`
          : `Permanent deletion marked finalized for ${reqItem.displayName} (${reqItem.email}).`
      );
      setTimeout(() => setActionNotice(null), 4000);
    } catch (err: any) {
      setActionNotice(err?.message || 'Unable to process account deletion request.');
      setTimeout(() => setActionNotice(null), 4000);
    } finally {
      setProcessingRequestUid(null);
    }
  };

  const handleAllocateAgencyStock = async (agencyId: string) => {
    const raw = stockAllocationInputs[agencyId] || '100000';
    const amount = parseInt(raw.replace(/[^0-9]/g, ''), 10);
    if (!amount || amount <= 0) {
      setActionNotice('Please enter a valid positive coin stock amount.');
      setTimeout(() => setActionNotice(null), 3500);
      return;
    }
    setAllocatingAgencyId(agencyId);
    try {
      const res = await adminAllocateAgencyCoins(agencyId, amount);
      setActionNotice(res.message);
      if (res.success) {
        setStockAllocationInputs((prev) => ({ ...prev, [agencyId]: '' }));
      }
    } finally {
      setAllocatingAgencyId(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#07040D] text-white flex flex-col antialiased selection:bg-[#7928CA]/30">
      {/* Admin Top Navigation */}
      <header className="h-16 border-b border-[#A855F7]/20 bg-[#0C061A]/90 backdrop-blur-md px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <AlphaMateLogo size="sm" showText={true} withGlow={true} customLogoUrl={customLogoUrl} />
          <div className="h-6 w-[1px] bg-zinc-700 mx-1 hidden sm:block" />
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#7928CA]/20 border border-[#A855F7]/30 text-xs font-mono font-bold text-[#C084FC]">
            <Activity className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            ADMIN STREAM MONITOR CONSOLE
          </span>
        </div>

        {/* Admin Section Switcher + Mobile App Button */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-black/50 border border-white/10">
            <button
              type="button"
              onClick={() => setAdminSection('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                adminSection === 'overview'
                  ? 'bg-[#7928CA] text-white shadow'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setAdminSection('gifts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                adminSection === 'gifts'
                  ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Advanced Gift Animation Manager</span>
            </button>
          </div>
          <button
            onClick={() => setDeviceMode('mobile')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white font-bold text-xs shadow-lg shadow-[#7928CA]/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span className="hidden sm:inline">Switch to Mobile View</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Action Notice Alert */}
        {actionNotice && (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-semibold flex items-center gap-2 animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        )}

        {/* Global KPI Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-3xl bg-[#120A24] border border-[#A855F7]/20 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase mb-2">
              <span>Active Broadcasts</span>
              <Radio className="w-4 h-4 text-[#EC4899] animate-pulse" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{liveStreams.length} Streams</div>
            <div className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <span>100% Streaming Pipeline Health</span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-[#120A24] border border-[#A855F7]/20 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase mb-2">
              <span>Live Concurrent Viewers</span>
              <Users className="w-4 h-4 text-[#A855F7]" />
            </div>
            <div className="text-2xl font-black text-white font-mono">{totalViewers.toLocaleString()}</div>
            <div className="text-[11px] text-emerald-400 mt-1">
              <span>Peak: 14,200 this session</span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-[#120A24] border border-[#A855F7]/20 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase mb-2">
              <span>60/40 Gift Revenue</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono">
              {totalGiftCoins.toLocaleString()} Coins
            </div>
            <div className="text-[11px] text-zinc-300 mt-1 font-mono">
              <span>Host 60%: {totalHostDiamonds.toLocaleString()} 💎 • App 40%: {totalAppShareCoins.toLocaleString()}</span>
            </div>
          </div>

          <div className="p-5 rounded-3xl bg-[#120A24] border border-[#A855F7]/20 shadow-lg">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-bold uppercase mb-2">
              <span>Safety & Auto-Mod</span>
              <ShieldAlert className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">0 Infractions</div>
            <div className="text-[11px] text-zinc-400 mt-1">
              <span>AI stream vision scanner active</span>
            </div>
          </div>
        </div>

        {/* Dedicated Admin Section: Advanced Gift Animation Manager */}
        <AdvancedGiftManager />

        {/* Split View: Live Stream Table + Audit Video Monitor */}
        {adminSection === 'overview' && (
          <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Streams Table */}
          <div className="lg:col-span-2 rounded-3xl bg-[#120A24] border border-[#A855F7]/20 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white">Live Broadcast Feeds</h2>
                <p className="text-xs text-zinc-400">Monitor stream uptime, resolution, and viewer density</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Filter streams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-3 rounded-xl bg-[#0B0616] border border-white/10 text-xs text-white focus:outline-none focus:border-[#A855F7]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400 uppercase text-[10px] tracking-wider">
                    <th className="pb-3 font-semibold">Host / Room</th>
                    <th className="pb-3 font-semibold">Category</th>
                    <th className="pb-3 font-semibold">Viewers</th>
                    <th className="pb-3 font-semibold">Bitrate</th>
                    <th className="pb-3 font-semibold text-right">Moderation Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {liveStreams.map((stream) => {
                    const isSelected = selectedStreamId === stream.id;
                    return (
                      <tr
                        key={stream.id}
                        className={`hover:bg-white/[0.02] transition-colors ${
                          isSelected ? 'bg-[#1C1036]/50' : ''
                        }`}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={safeImageSrc(stream.host.avatar, DEFAULT_AVATAR_URL)}
                              alt={stream.host.displayName}
                              className="w-8 h-8 rounded-full object-cover border border-[#A855F7]"
                            />
                            <div>
                              <div className="font-bold text-white">{stream.host.displayName}</div>
                              <div className="text-[10px] text-zinc-400 max-w-[140px] truncate">{stream.title}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3">
                          <span className="px-2 py-0.5 rounded-md bg-[#21133D] text-[10px] font-semibold text-[#C084FC]">
                            {stream.category}
                          </span>
                        </td>

                        <td className="py-3 font-mono text-zinc-200">
                          {stream.viewerCount.toLocaleString()}
                        </td>

                        <td className="py-3 font-mono text-emerald-400">
                          4.8 Mbps (1080p)
                        </td>

                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedStreamId(stream.id)}
                              className="px-2.5 py-1 rounded-lg bg-[#251745] hover:bg-[#352163] text-white text-[10px] font-bold"
                            >
                              Inspect
                            </button>
                            <button
                              onClick={() => handleAction('Warning', stream)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold"
                            >
                              Warn
                            </button>
                            <button
                              onClick={() => handleAction('Terminate', stream)}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold"
                            >
                              Terminate
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live Video Monitor Inspector */}
          <div className="rounded-3xl bg-[#120A24] border border-[#A855F7]/20 p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#EC4899]" />
                  <span>Real-time Stream Monitor</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                  LIVE FEED
                </span>
              </div>

              {/* Video Preview Box */}
              <div className="relative rounded-2xl overflow-hidden aspect-video bg-black border border-white/10 mb-3">
                {safeImageSrc(activeMonitorStream?.thumbnail) && (
                  <img
                    src={safeImageSrc(activeMonitorStream?.thumbnail)}
                    alt="Monitor"
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[9px] font-mono text-white">
                  PID: {activeMonitorStream?.id}
                </div>
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-white bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg">
                  <span>Host: {activeMonitorStream?.host.displayName}</span>
                  <span className="font-mono text-amber-300">{activeMonitorStream?.viewerCount} viewers</span>
                </div>
              </div>

              {/* Stream Telemetry */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Audio Codec:</span>
                  <span className="font-mono text-white">Opus 128kbps stereo</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Video Encoding:</span>
                  <span className="font-mono text-white">H.264 / NVENC (Hardware)</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Latency to Edge:</span>
                  <span className="font-mono text-emerald-400">142ms (Ultra-Low)</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Reported Violations:</span>
                  <span className="font-mono text-white">0 Flags</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (activeMonitorStream) {
                  setDeviceMode('mobile');
                  openLiveStream(activeMonitorStream);
                }
              }}
              className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold hover:brightness-110 cursor-pointer"
            >
              Open Full Stream In-App
            </button>
          </div>
        </div>

        {/* Agency License Applications Review Section */}
        <div className="rounded-3xl bg-[#120A24] border border-[#A855F7]/20 p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-black text-white">Official Agency License Applications</h3>
                <p className="text-[11px] text-zinc-400">Review creator KYC & approve official Coin Seller or Host Agency licenses</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold border border-amber-400/30">
              {agencyApplications.filter((a) => a.status === 'pending').length} Pending Review
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400 uppercase text-[10px] tracking-wider">
                  <th className="pb-2">Applicant</th>
                  <th className="pb-2">Agency Type</th>
                  <th className="pb-2">Agency Name & Tag</th>
                  <th className="pb-2">WhatsApp / Phone</th>
                  <th className="pb-2">CNIC / ID</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Official Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {agencyApplications.map((app) => (
                  <tr key={app.id} className="hover:bg-white/5">
                    <td className="py-3 font-bold text-white">
                      <div>{app.applicantName}</div>
                      <div className="text-[10px] text-zinc-500 font-mono">ID: {app.applicantUniqueId}</div>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        app.type === 'coin_seller'
                          ? 'bg-amber-400/20 text-amber-300'
                          : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {app.type === 'coin_seller' ? 'Coin Seller' : 'Host Agency'}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-zinc-200">{app.agencyName}</div>
                      {app.agencyTag && (
                        <span className="text-[9.5px] font-mono text-amber-400">[{app.agencyTag}]</span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-zinc-300">
                      <div>{app.whatsapp}</div>
                      <div className="text-[10px] text-zinc-500">{app.phoneNumber}</div>
                    </td>
                    <td className="py-3 font-mono text-zinc-400">
                      {app.idCardNumber || 'N/A (Exempt)'}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase ${
                        app.status === 'approved'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : app.status === 'rejected'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-amber-400/20 text-amber-300'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {app.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              const res = reviewAgencyApplication(app.id, 'reject');
                              setActionNotice(res.message);
                              setTimeout(() => setActionNotice(null), 4000);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10.5px] font-bold cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => {
                              const res = reviewAgencyApplication(app.id, 'approve');
                              setActionNotice(res.message);
                              setTimeout(() => setActionNotice(null), 4000);
                            }}
                            className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10.5px] font-bold cursor-pointer border border-emerald-500/30"
                          >
                            Approve License
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-zinc-500 font-mono">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Host Agency Join Requests (agency_requests) — Super Admin Approval Queue */}
        <div className="rounded-3xl bg-[#120A24] border border-purple-500/25 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="text-sm font-black text-white">Host Agency Join Requests</h3>
                <p className="text-[11px] text-zinc-400">
                  Real-time creator requests from Firestore agency_requests. Approving activates Host Agency membership on their profile.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs font-bold border border-purple-500/30 font-mono">
              {hostJoinRequests.filter((r) => r.status === 'pending').length} Pending
            </span>
          </div>

          {hostJoinRequests.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#0B0616] border border-white/10 text-xs text-zinc-400">
              No Host Agency join requests submitted yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400 uppercase text-[10px]">
                    <th className="pb-2.5">Applicant</th>
                    <th className="pb-2.5">Selected Host Agency</th>
                    <th className="pb-2.5">WhatsApp &amp; Hours</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {hostJoinRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-white/5">
                      <td className="py-3 font-bold text-white">
                        <div>{req.displayName}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">ID: {req.uniqueId}</div>
                      </td>
                      <td className="py-3">
                        <div className="font-bold text-zinc-200">{req.agencyName || req.agencyId}</div>
                        {req.agencyCode && (
                          <span className="text-[9.5px] font-mono text-amber-400">Code: {req.agencyCode}</span>
                        )}
                      </td>
                      <td className="py-3 font-mono text-zinc-300">
                        <div>{req.whatsapp}</div>
                        <div className="text-[10px] text-zinc-500">{req.expectedHours} hrs/week</div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase ${
                            req.status === 'approved'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : req.status === 'rejected'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-amber-400/20 text-amber-300'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {req.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const res = rejectHostJoinRequest(
                                  req.id,
                                  'Request was declined by Alpha Mate Super Admin.'
                                );
                                setActionNotice(res.message);
                                setTimeout(() => setActionNotice(null), 4000);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10.5px] font-bold cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const res = approveHostJoinRequest(req.id);
                                setActionNotice(res.message);
                                setTimeout(() => setActionNotice(null), 4000);
                              }}
                              className="px-3 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10.5px] font-bold cursor-pointer border border-emerald-500/30"
                            >
                              Approve Host
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-500 font-mono">Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Official Admin Coin Seller Stock Allocation */}
        <div className="rounded-3xl bg-[#120A24] border border-amber-400/25 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-black text-white">Approved Coin Seller Agencies &amp; Stock Allocation</h3>
                <p className="text-[11px] text-zinc-400">
                  Approved Coin Seller Agencies start with 0 Coins. Only Official Admin can allocate stock.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 text-xs font-bold border border-amber-400/30 font-mono">
              {officialCoinSellerProfiles.length} Approved Merchant(s)
            </span>
          </div>

          {!isOfficialAdminUser ? (
            <div className="p-4 rounded-2xl bg-[#0B0616] border border-white/10 text-xs text-zinc-400">
              Sign in as <span className="text-zinc-200 font-mono">alphamateapp@gmail.com</span> to allocate Coin Seller agency stock.
            </div>
          ) : officialCoinSellerProfiles.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#0B0616] border border-white/10 text-xs text-zinc-400">
              No approved Coin Seller Agencies yet. Approve a pending application above first.
            </div>
          ) : (
            <div className="space-y-2.5">
              {officialCoinSellerProfiles.map((agency) => (
                <div
                  key={agency.agencyId}
                  className="p-3.5 rounded-2xl bg-[#0B0616] border border-white/10 flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">{agency.agencyName}</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 text-[9px] font-mono">
                        {agency.agencyCode}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-zinc-400 mt-0.5 font-mono">
                      Owner: {agency.ownerName || agency.ownerUserId} • Current Stock:{' '}
                      <strong className="text-amber-300">{(agency.agencyBalance || 0).toLocaleString()} Coins</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="100000"
                      value={stockAllocationInputs[agency.agencyId] ?? ''}
                      onChange={(e) =>
                        setStockAllocationInputs((prev) => ({
                          ...prev,
                          [agency.agencyId]: e.target.value,
                        }))
                      }
                      className="w-32 h-9 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs font-mono text-white"
                    />
                    <button
                      type="button"
                      disabled={allocatingAgencyId === agency.agencyId}
                      onClick={() => handleAllocateAgencyStock(agency.agencyId)}
                      className="px-3 h-9 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-black font-black text-[11px] uppercase cursor-pointer hover:brightness-110 disabled:opacity-50"
                    >
                      {allocatingAgencyId === agency.agencyId ? 'Allocating...' : 'Allocate Stock'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 60/40 Coin-to-Diamond Gift Economy Ledger */}
        <div className="rounded-3xl bg-[#120A24] border border-amber-400/25 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <DollarSign className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-black text-white">
                  60/40 Gift Revenue Split Ledger (Host Diamonds vs App Share)
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Real-time audit of all live, party, moments, PK &amp; demo gifts
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-400/15 text-amber-300 text-xs font-bold border border-amber-400/30 font-mono">
              App 40% Share: {totalAppShareCoins.toLocaleString()} Coins
            </span>
          </div>

          {giftTransactions.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#0B0616] border border-white/10 text-xs text-zinc-400">
              No gift transactions recorded yet. Send any gift in Live, Party, Moments or Wallet Demo to see the 60/40 split here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400 uppercase text-[10px] tracking-wider">
                    <th className="pb-2">Gift &amp; Context</th>
                    <th className="pb-2">Sender</th>
                    <th className="pb-2">Recipient Host</th>
                    <th className="pb-2">Total Coins</th>
                    <th className="pb-2">60% Host 💎</th>
                    <th className="pb-2 text-right">40% App Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {giftTransactions.slice(0, 25).map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 font-sans">
                        <span className="font-bold text-white">
                          {tx.giftIcon} {tx.giftName} {tx.quantity > 1 ? `x${tx.quantity}` : ''}
                        </span>
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-purple-500/20 text-[#C084FC] text-[9px] uppercase font-bold">
                          {tx.context}
                        </span>
                      </td>
                      <td className="py-2.5 text-zinc-300 font-sans">{tx.senderName}</td>
                      <td className="py-2.5 text-zinc-200 font-sans">{tx.recipientName}</td>
                      <td className="py-2.5 text-white">{tx.totalCoins.toLocaleString()}</td>
                      <td className="py-2.5 text-pink-300 font-bold">+{tx.hostDiamonds.toLocaleString()} 💎</td>
                      <td className="py-2.5 text-right text-amber-300 font-bold">
                        {tx.appShareCoins.toLocaleString()} Coins
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Official Agency Coin Transfer Audit Ledger */}
        <div className="rounded-3xl bg-[#120A24] border border-emerald-400/25 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-black text-white">
                  Official Agency Coin Transfer Audit Ledger
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Real-time atomic Firestore transfers from Coin Seller Agencies to user Gifting Wallets
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-400/15 text-emerald-300 text-xs font-bold border border-emerald-400/30 font-mono">
              Total Distributed: {agencyTransactions.reduce((acc, t) => acc + (t.coins || 0), 0).toLocaleString()} Coins
            </span>
          </div>

          {agencyTransactions.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#0B0616] border border-white/10 text-xs text-zinc-400">
              No agency coin transfers recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400 uppercase text-[10px] tracking-wider">
                    <th className="pb-2">Agency</th>
                    <th className="pb-2">Recipient</th>
                    <th className="pb-2">Transferred</th>
                    <th className="pb-2">Agency Remaining</th>
                    <th className="pb-2 text-right">Ref &amp; Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {agencyTransactions.slice(0, 25).map((tx) => (
                    <tr key={tx.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 font-sans font-bold text-white">
                        {tx.agencyName || 'Official Agency'}
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px] uppercase">
                          {tx.type === 'order_delivery' ? 'Order' : 'Direct'}
                        </span>
                      </td>
                      <td className="py-2.5 font-sans text-zinc-200">
                        {tx.recipientName} <span className="text-zinc-500 font-mono text-[10px]">({tx.recipientUniqueId})</span>
                      </td>
                      <td className="py-2.5 text-emerald-300 font-bold">+{tx.coins.toLocaleString()} 🪙</td>
                      <td className="py-2.5 text-amber-300">{tx.remainingBalance.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-zinc-400 text-[10px]">
                        {tx.referenceId || tx.id.slice(-8)} • {tx.timestamp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Official Account Deletion & Deactivation Queue (15-Day Pending Review) */}
        <div className="rounded-3xl bg-[#120A24] border border-rose-500/25 p-5 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-rose-400" />
              <div>
                <h3 className="text-sm font-black text-white">
                  Official Account Deletion &amp; Deactivation Queue (15-Day Review)
                </h3>
                <p className="text-[11px] text-zinc-400">
                  OTP-verified permanent deletions remain pending for 15 days; temporary deactivations never expire
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 text-xs font-bold border border-rose-500/30">
              {deletionRequests.filter((r) => r.status === 'pending_official_deletion').length} Pending 15-Day Delete
            </span>
          </div>

          {!isOfficialAdminUser ? (
            <div className="p-4 rounded-2xl bg-[#0B0616] border border-white/10 text-xs text-zinc-400">
              Sign in with the official administrator account (<span className="text-zinc-200 font-mono">alphamateapp@gmail.com</span>) to view and manage live account deletion requests.
            </div>
          ) : deletionRequests.length === 0 ? (
            <div className="p-4 rounded-2xl bg-[#0B0616] border border-white/10 text-xs text-zinc-400">
              No account deactivation or permanent deletion requests recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-zinc-400 uppercase text-[10px] tracking-wider">
                    <th className="pb-2">User</th>
                    <th className="pb-2">Request Type</th>
                    <th className="pb-2">OTP Verified</th>
                    <th className="pb-2">15-Day Scheduled Date</th>
                    <th className="pb-2">Reason</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2 text-right">Official Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {deletionRequests.map((reqItem) => {
                    const scheduledMs = reqItem.scheduledPermanentDeletionAt
                      ? Date.parse(reqItem.scheduledPermanentDeletionAt)
                      : NaN;
                    const daysRemaining = Number.isFinite(scheduledMs)
                      ? Math.max(0, Math.ceil((scheduledMs - Date.now()) / (24 * 60 * 60 * 1000)))
                      : null;
                    return (
                      <tr key={reqItem.uid} className="hover:bg-white/[0.02]">
                        <td className="py-3">
                          <div className="font-bold text-white">{reqItem.displayName}</div>
                          <div className="text-[10px] text-zinc-400">{reqItem.email}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">ID: {reqItem.uniqueId || reqItem.uid}</div>
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              reqItem.type === 'permanent_delete'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-purple-500/20 text-purple-300'
                            }`}
                          >
                            {reqItem.type === 'permanent_delete' ? 'Permanent Delete' : 'Temp Deactivation'}
                          </span>
                        </td>
                        <td className="py-3">
                          {reqItem.otpVerified ? (
                            <span className="text-emerald-400 font-semibold">Yes (Email OTP)</span>
                          ) : (
                            <span className="text-zinc-500">N/A</span>
                          )}
                        </td>
                        <td className="py-3 font-mono text-[11px] text-zinc-300">
                          {reqItem.type === 'deactivation' ? (
                            <span className="text-emerald-300">Never (Unlimited Recovery)</span>
                          ) : reqItem.scheduledPermanentDeletionAt ? (
                            <div>
                              <div>{new Date(reqItem.scheduledPermanentDeletionAt).toLocaleDateString()}</div>
                              <div className="text-[10px] text-amber-300">{daysRemaining} day(s) remaining</div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 max-w-[180px] truncate text-zinc-400">
                          {reqItem.reason || 'No reason provided'}
                        </td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase ${
                              reqItem.status === 'pending_official_deletion'
                                ? 'bg-amber-500/20 text-amber-300'
                                : reqItem.status === 'deactivated'
                                ? 'bg-purple-500/20 text-purple-300'
                                : reqItem.status === 'recovered'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {reqItem.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(reqItem.status === 'deactivated' || reqItem.status === 'pending_official_deletion') && (
                              <button
                                type="button"
                                disabled={processingRequestUid === reqItem.uid}
                                onClick={() => handleDeletionQueueAction(reqItem, 'restore')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Restore</span>
                              </button>
                            )}
                            {reqItem.status === 'pending_official_deletion' && (
                              <button
                                type="button"
                                disabled={processingRequestUid === reqItem.uid}
                                onClick={() => handleDeletionQueueAction(reqItem, 'finalize')}
                                className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10.5px] font-bold inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Finalize</span>
                              </button>
                            )}
                            {(reqItem.status === 'recovered' || reqItem.status === 'permanently_deleted') && (
                              <span className="text-[10px] text-zinc-500 font-mono">Closed</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </div>
        )}
      </div>
    </div>
  );
};
