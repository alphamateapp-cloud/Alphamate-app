import React, { useState } from 'react';
import {
  ChevronLeft,
  Coins,
  ShieldCheck,
  Lock,
  ArrowRight,
  Search,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  UserCheck,
  UserMinus,
  Send,
  History,
  Settings,
  Sparkles,
  Users,
  Award,
  ExternalLink,
  Plus,
  KeyRound,
  Filter,
  Radio,
  Tv,
  Target,
  LogOut,
  Edit2,
  Check,
  Building2,
  Percent,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SendCoinsModal } from '../components/agency/SendCoinsModal';
import { AgencyOrderDetailsModal } from '../components/agency/AgencyOrderDetailsModal';
import { AgencyPinSetupModal } from '../components/agency/AgencyPinSetupModal';
import { ApplyAgencyModal } from '../components/modals/ApplyAgencyModal';
import { AgencyOrder, HostMember, HostJoinRequest } from '../types';

export const AgencyManagementScreen: React.FC = () => {
  const {
    navigateBack,
    agencyProfile,
    agencyOrders,
    agencyTransactions,
    updateAgencyProfile,
    findUserByIdOrUsername,
    sendAgencyCoins,
    hostAgencyProfile,
    agencyHosts,
    hostJoinRequests,
    setHostWeeklyTarget,
    updateHostCommission,
    updateHostContract,
    toggleHostLiveStatus,
    approveHostJoinRequest,
    rejectHostJoinRequest,
    removeHostFromAgency,
    updateHostAgencyProfile,
  } = useApp();

  // Branch Selection: 'coin_seller' vs 'host_agency'
  const [activeBranch, setActiveBranch] = useState<'coin_seller' | 'host_agency'>('coin_seller');

  // Sub tabs under Coin Seller Agency
  const [activeCoinSubTab, setActiveCoinSubTab] = useState<'orders' | 'send' | 'history' | 'settings'>('orders');

  // Sub tabs under Host Agency
  const [activeHostSubTab, setActiveHostSubTab] = useState<'roster' | 'requests' | 'settings'>('roster');

  // Orders filter: 'pending' | 'delivered' | 'all'
  const [orderFilter, setOrderFilter] = useState<'pending' | 'delivered' | 'all'>('pending');

  // Host Roster Filter: 'all' | 'live' | 'achieved' | 'pending' | 'resigned'
  const [hostFilter, setHostFilter] = useState<'all' | 'live' | 'achieved' | 'pending' | 'resigned'>('all');
  const [hostSearchQuery, setHostSearchQuery] = useState('');

  // Modals
  const [isSendCoinsModalOpen, setIsSendCoinsModalOpen] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [isApplyAgencyModalOpen, setIsApplyAgencyModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AgencyOrder | null>(null);

  // Host Join Request Approval & Contract Modal (First-time agreement setup)
  const [approvingCandidate, setApprovingCandidate] = useState<HostJoinRequest | null>(null);
  const [candidateDiamonds, setCandidateDiamonds] = useState(500000);
  const [candidateCommission, setCandidateCommission] = useState(15);
  const [candidateHours, setCandidateHours] = useState(20);

  // Edit Host Contract Modal (Continuous editing of existing host target, commission, hours)
  const [editingContractHost, setEditingContractHost] = useState<HostMember | null>(null);
  const [editContractDiamonds, setEditContractDiamonds] = useState(500000);
  const [editContractCommission, setEditContractCommission] = useState(15);
  const [editContractHours, setEditContractHours] = useState(20);

  // Host Release & Tag Removal Modal
  const [releasingHost, setReleasingHost] = useState<HostMember | null>(null);
  const [releaseReason, setReleaseReason] = useState('');

  // Action feedback toast
  const [actionFeedbackToast, setActionFeedbackToast] = useState<string | null>(null);

  // Quick Direct Send Form State
  const [directQuery, setDirectQuery] = useState('');
  const [directUser, setDirectUser] = useState<any | null>(null);
  const [directAmount, setDirectAmount] = useState('50000');
  const [directPin, setDirectPin] = useState('');
  const [directError, setDirectError] = useState<string | null>(null);
  const [directSuccess, setDirectSuccess] = useState<string | null>(null);

  // Settings form (Coin Seller)
  const [editWhatsApp, setEditWhatsApp] = useState(agencyProfile.whatsappDisplay || agencyProfile.whatsappNumber);
  const [editSlogan, setEditSlogan] = useState(agencyProfile.slogan);
  const [settingsSavedToast, setSettingsSavedToast] = useState(false);

  // Settings form (Host Agency)
  const [editHostWhatsApp, setEditHostWhatsApp] = useState(hostAgencyProfile.whatsappDisplay || hostAgencyProfile.whatsappNumber);
  const [editHostSlogan, setEditHostSlogan] = useState(hostAgencyProfile.slogan);
  const [editDefaultCommission, setEditDefaultCommission] = useState(hostAgencyProfile.defaultCommissionRate || 15);
  const [editMinHours, setEditMinHours] = useState(hostAgencyProfile.minWeeklyHours || 15);
  const [hostSettingsSavedToast, setHostSettingsSavedToast] = useState(false);

  // Filtered orders
  const filteredOrders = agencyOrders.filter((o) => {
    if (orderFilter === 'pending') return o.status === 'pending';
    if (orderFilter === 'delivered') return o.status === 'delivered';
    return true;
  });

  const pendingOrdersCount = agencyOrders.filter((o) => o.status === 'pending').length;
  const deliveredOrdersCount = agencyOrders.filter((o) => o.status === 'delivered').length;

  const pendingHostRequestsCount = hostJoinRequests.filter((r) => r.status === 'pending').length;
  const activeLiveHostsCount = agencyHosts.filter((h) => h.isLive).length;
  const targetsMetCount = agencyHosts.filter((h) => h.targetStatus === 'achieved').length;
  const pendingTargetCount = agencyHosts.filter((h) => h.targetStatus !== 'achieved').length;
  const resignationCount = agencyHosts.filter((h) => h.resignationRequested).length;

  const displayedHosts = agencyHosts.filter((host) => {
    if (hostSearchQuery.trim()) {
      const q = hostSearchQuery.toLowerCase();
      const match =
        host.displayName.toLowerCase().includes(q) ||
        host.uniqueId.toLowerCase().includes(q) ||
        host.username.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (hostFilter === 'live') return host.isLive;
    if (hostFilter === 'achieved') return host.targetStatus === 'achieved';
    if (hostFilter === 'pending') return host.targetStatus !== 'achieved';
    if (hostFilter === 'resigned') return !!host.resignationRequested;
    return true;
  });

  const triggerToast = (msg: string) => {
    setActionFeedbackToast(msg);
    setTimeout(() => setActionFeedbackToast(null), 3500);
  };

  const handleOpenApprovalModal = (req: HostJoinRequest) => {
    setApprovingCandidate(req);
    setCandidateDiamonds(500000);
    setCandidateCommission(hostAgencyProfile.defaultCommissionRate || 15);
    setCandidateHours(req.expectedHours || hostAgencyProfile.minWeeklyHours || 20);
  };

  const handleConfirmApproval = () => {
    if (!approvingCandidate) return;
    const res = approveHostJoinRequest(
      approvingCandidate.id,
      candidateDiamonds,
      candidateCommission,
      candidateHours
    );
    if (res.success) {
      triggerToast(`Bound official tag [${hostAgencyProfile.agencyTag}] to ${approvingCandidate.displayName}!`);
      setApprovingCandidate(null);
    } else {
      triggerToast(res.message);
    }
  };

  const handleOpenEditContract = (host: HostMember) => {
    setEditingContractHost(host);
    setEditContractDiamonds(host.weeklyTargetDiamonds);
    setEditContractCommission(host.commissionRate);
    setEditContractHours(host.weeklyTargetHours);
  };

  const handleSaveContract = () => {
    if (!editingContractHost) return;
    updateHostContract(
      editingContractHost.id,
      editContractDiamonds,
      editContractHours,
      editContractCommission
    );
    triggerToast(`Contract updated for ${editingContractHost.displayName}!`);
    setEditingContractHost(null);
  };

  const handleOpenReleaseModal = (host: HostMember, defaultReason?: string) => {
    setReleasingHost(host);
    setReleaseReason(
      defaultReason ||
        (host.resignationRequested
          ? host.resignationReason || 'Resignation requested by host'
          : 'Contract completed / Host released')
    );
  };

  const handleConfirmRelease = () => {
    if (!releasingHost) return;
    const hostName = releasingHost.displayName;
    const res = removeHostFromAgency(releasingHost.id, releaseReason);
    if (res.success) {
      triggerToast(`${hostName} has been freed. Agency tag removed!`);
      setReleasingHost(null);
      setReleaseReason('');
    } else {
      triggerToast(res.message);
    }
  };

  const handleSearchDirectUser = () => {
    setDirectError(null);
    setDirectSuccess(null);
    if (!directQuery.trim()) {
      setDirectError('Please enter a User ID or Username');
      setDirectUser(null);
      return;
    }
    const found = findUserByIdOrUsername(directQuery);
    if (found) {
      setDirectUser(found);
    } else {
      setDirectUser(null);
      setDirectError('No user found with this User ID or Username');
    }
  };

  const handleExecuteDirectSend = () => {
    setDirectError(null);
    setDirectSuccess(null);

    if (!directUser) {
      setDirectError('Please search and verify the recipient first');
      return;
    }

    const amt = parseInt(directAmount.replace(/[^0-9]/g, ''), 10);
    if (!amt || amt <= 0) {
      setDirectError('Please enter a valid coin transfer amount');
      return;
    }

    if (directPin.length !== 4) {
      setDirectError('Please enter your 4-digit security PIN');
      return;
    }

    const res = sendAgencyCoins(directUser.uniqueId || directUser.username, amt, directPin);
    if (res.success) {
      setDirectSuccess(res.message);
      setDirectPin('');
      setTimeout(() => setDirectSuccess(null), 3500);
    } else {
      setDirectError(res.message);
    }
  };

  const handleSaveCoinSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateAgencyProfile({
      whatsappNumber: editWhatsApp.replace(/[^0-9+]/g, ''),
      whatsappDisplay: editWhatsApp,
      slogan: editSlogan,
    });
    setSettingsSavedToast(true);
    setTimeout(() => setSettingsSavedToast(false), 2500);
  };

  const handleSaveHostSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateHostAgencyProfile({
      whatsappNumber: editHostWhatsApp.replace(/[^0-9+]/g, ''),
      whatsappDisplay: editHostWhatsApp,
      slogan: editHostSlogan,
      defaultCommissionRate: Number(editDefaultCommission),
      minWeeklyHours: Number(editMinHours),
    });
    setHostSettingsSavedToast(true);
    setTimeout(() => setHostSettingsSavedToast(false), 2500);
  };


  const handleContactHostWhatsApp = (whatsappNumber: string, hostName: string) => {
    const clean = whatsappNumber.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(
      `Hello ${hostName}! I am contacting you from ${hostAgencyProfile.agencyName} regarding your host agreement and weekly target on Alpha Mate.`
    );
    window.open(`https://wa.me/${clean}?text=${msg}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="relative w-full h-full max-h-[100dvh] bg-[#09070F] text-white flex flex-col overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="shrink-0 h-14 px-4 bg-[#120B22]/90 backdrop-blur-xl border-b border-[#A855F7]/30 flex items-center justify-between z-20">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={navigateBack}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-sm sm:text-base font-black text-white truncate">Agency Center</h1>
              <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 text-[8.5px] font-black border border-amber-400/40 uppercase">
                {activeBranch === 'coin_seller' ? 'Coin Merchant' : 'Host Agency'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 truncate max-w-[200px] sm:max-w-[280px]">
              {activeBranch === 'coin_seller' ? agencyProfile.agencyName : hostAgencyProfile.agencyName}
            </p>
          </div>
        </div>

        {/* Header Actions: Apply for Agency & Security PIN */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsApplyAgencyModalOpen(true)}
            className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-purple-500/30 to-pink-500/30 hover:brightness-125 border border-purple-400/30 text-[10px] font-bold text-purple-200 flex items-center gap-1 transition-all cursor-pointer"
            title="Apply for an Official Agency License"
          >
            <Building2 className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden sm:inline">Apply License</span>
            <span className="sm:hidden">Apply</span>
          </button>

          <button
            onClick={() => setIsPinModalOpen(true)}
            className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
            title="4-Digit Security PIN Settings"
          >
            <Lock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">PIN</span>
          </button>
        </div>
      </div>

      {/* Main Dual Branch Selector (Coin Seller Agency vs Host Agency) */}
      <div className="shrink-0 px-4 pt-3 pb-2 bg-[#0C0618] border-b border-white/5">
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#160A2C] border border-[#A855F7]/25">
          <button
            onClick={() => setActiveBranch('coin_seller')}
            className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeBranch === 'coin_seller'
                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black shadow-md shadow-amber-500/25'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Coins className="w-4 h-4 fill-current" />
            <span>Coin Seller Agency</span>
          </button>

          <button
            onClick={() => setActiveBranch('host_agency')}
            className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeBranch === 'host_agency'
                ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow-md shadow-[#7928CA]/30'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Host Agency</span>
            {pendingHostRequestsCount > 0 && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black animate-pulse">
                {pendingHostRequestsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 px-4 py-4 space-y-4 scrollbar-none">
        {activeBranch === 'host_agency' ? (
          /* =========================================================================
             BRANCH 2: HOST AGENCY (TALENT ROSTER, WEEKLY TARGETS, COMMISSION & REQUESTS)
             ========================================================================= */
          <div className="space-y-4 animate-fade-in">
            {/* Host Agency Hero Banner Card */}
            <div className="relative rounded-3xl p-5 bg-gradient-to-b from-[#2A0E4E] via-[#1B0A33] to-[#100520] border border-[#A855F7]/50 shadow-[0_0_30px_rgba(168,85,247,0.2)] overflow-hidden">
              <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-[#EC4899]/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-[#7928CA]/25 blur-3xl pointer-events-none" />

              <div className="relative z-10 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-300">
                      Official Host Agency
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-black text-[9.5px] font-black uppercase tracking-wider shadow">
                      Tag: [{hostAgencyProfile.agencyTag}]
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1 truncate">
                    {hostAgencyProfile.agencyName}
                  </h2>
                  <p className="text-[11px] text-zinc-300 mt-0.5">
                    {hostAgencyProfile.slogan}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black border border-emerald-500/30 uppercase">
                    ACTIVE
                  </span>
                  <span className="text-[9.5px] font-mono text-zinc-400 block mt-1">
                    {hostAgencyProfile.agencyCode}
                  </span>
                </div>
              </div>

              {/* Host Agency Summary Metrics Bar (Interactive Clickable Filters) */}
              <div className="relative z-10 grid grid-cols-4 gap-1.5 mt-4 pt-3.5 border-t border-white/10 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setActiveHostSubTab('roster');
                    setHostFilter('all');
                  }}
                  className={`p-2 rounded-2xl transition-all cursor-pointer text-center ${
                    activeHostSubTab === 'roster' && hostFilter === 'all'
                      ? 'bg-purple-600/40 border border-purple-400/80 shadow-md scale-[1.02]'
                      : 'bg-white/5 hover:bg-white/10 border border-white/5'
                  }`}
                  title="Filter all hosts in roster"
                >
                  <div className="text-base font-black font-mono text-white">{agencyHosts.length}</div>
                  <div className="text-[9px] font-bold text-zinc-300 uppercase mt-0.5">Total Hosts</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveHostSubTab('roster');
                    setHostFilter('live');
                  }}
                  className={`p-2 rounded-2xl transition-all cursor-pointer text-center ${
                    activeHostSubTab === 'roster' && hostFilter === 'live'
                      ? 'bg-emerald-500/30 border border-emerald-400/80 shadow-md scale-[1.02]'
                      : 'bg-white/5 hover:bg-white/10 border border-white/5'
                  }`}
                  title="Filter hosts currently live streaming"
                >
                  <div className="text-base font-black font-mono text-emerald-400 flex items-center justify-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span>{activeLiveHostsCount}</span>
                  </div>
                  <div className="text-[9px] font-bold text-zinc-300 uppercase mt-0.5">Live Now</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveHostSubTab('roster');
                    setHostFilter('achieved');
                  }}
                  className={`p-2 rounded-2xl transition-all cursor-pointer text-center ${
                    activeHostSubTab === 'roster' && hostFilter === 'achieved'
                      ? 'bg-amber-400/30 border border-amber-400/80 shadow-md scale-[1.02]'
                      : 'bg-white/5 hover:bg-white/10 border border-white/5'
                  }`}
                  title="Filter hosts who achieved their weekly target"
                >
                  <div className="text-base font-black font-mono text-amber-300">
                    {targetsMetCount}/{agencyHosts.length}
                  </div>
                  <div className="text-[9px] font-bold text-zinc-300 uppercase mt-0.5">Targets Met</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveHostSubTab('requests');
                  }}
                  className={`p-2 rounded-2xl transition-all cursor-pointer text-center ${
                    activeHostSubTab === 'requests'
                      ? 'bg-pink-500/30 border border-pink-400/80 shadow-md scale-[1.02]'
                      : 'bg-white/5 hover:bg-white/10 border border-white/5'
                  }`}
                  title="View pending host join requests"
                >
                  <div className="text-base font-black font-mono text-pink-300">
                    {pendingHostRequestsCount}
                  </div>
                  <div className="text-[9px] font-bold text-zinc-300 uppercase mt-0.5">New Requests</div>
                </button>
              </div>
            </div>

            {/* Host Agency Sub-Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#140929] border border-white/10">
              {[
                { id: 'roster', label: `Hosts & Targets (${agencyHosts.length})`, icon: Users },
                { id: 'requests', label: `Join Requests (${pendingHostRequestsCount})`, icon: FileText },
                { id: 'settings', label: 'Agency Settings', icon: Settings },
              ].map((tab) => {
                const isActive = activeHostSubTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveHostSubTab(tab.id as any)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow font-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* SUB-TAB 1: HOSTS ROSTER, SEARCH & CONTRACT MANAGEMENT */}
            {activeHostSubTab === 'roster' && (
              <div className="space-y-3">
                {/* Search & Active Tag Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={hostSearchQuery}
                      onChange={(e) => setHostSearchQuery(e.target.value)}
                      placeholder="Search talent by name or ID..."
                      className="w-full h-9 pl-8 pr-3 rounded-xl bg-white/5 border border-white/10 focus:border-purple-400 focus:outline-none text-xs text-white placeholder-zinc-500"
                    />
                    {hostSearchQuery && (
                      <button
                        onClick={() => setHostSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <span className="shrink-0 px-2.5 py-1.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-[10px] font-mono text-amber-300 font-bold">
                    Tag: [{hostAgencyProfile.agencyTag}]
                  </span>
                </div>

                {/* Filter Chips Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10.5px]">
                  {[
                    { id: 'all', label: `All (${agencyHosts.length})` },
                    { id: 'live', label: `Live Now (${activeLiveHostsCount})` },
                    { id: 'achieved', label: `Targets Met (${targetsMetCount})` },
                    { id: 'pending', label: `In Progress (${pendingTargetCount})` },
                    { id: 'resigned', label: `Resignations (${resignationCount})` },
                  ].map((chip) => {
                    const isSelected = hostFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setHostFilter(chip.id as any)}
                        className={`px-2.5 py-1 rounded-xl whitespace-nowrap font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/30 border border-purple-400'
                            : 'bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-white/5'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>

                {displayedHosts.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-[#140929] border border-white/5 text-center space-y-2">
                    <Users className="w-8 h-8 text-zinc-500 mx-auto" />
                    <p className="text-xs font-bold text-zinc-300">
                      {hostSearchQuery || hostFilter !== 'all'
                        ? 'No hosts match current filter criteria'
                        : 'No hosts registered in your agency yet'}
                    </p>
                    <p className="text-[10px] text-zinc-500">
                      {hostSearchQuery || hostFilter !== 'all' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setHostFilter('all');
                            setHostSearchQuery('');
                          }}
                          className="mt-1 text-purple-400 hover:underline font-bold"
                        >
                          Reset Filters
                        </button>
                      ) : (
                        'Approve pending join requests or recruit creators to build your roster.'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {displayedHosts.map((host) => {
                      const progressPct = Math.min(
                        100,
                        Math.round((host.currentProgressDiamonds / host.weeklyTargetDiamonds) * 100)
                      );
                      const agencyCut = Math.round((host.weeklyEarnings * host.commissionRate) / 100);
                      const hostNetPayout = host.weeklyEarnings - agencyCut;

                      return (
                        <div
                          key={host.id}
                          className="p-4 rounded-3xl bg-[#150A2B] border border-white/10 hover:border-purple-400/40 transition-all space-y-3 shadow-md"
                        >
                          {/* Host Header Row: Avatar, Name, Tag, Live Indicator & Remote Live Toggle */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <img
                                  src={host.avatar}
                                  alt={host.displayName}
                                  className="w-12 h-12 rounded-2xl object-cover border border-purple-400/60 shadow"
                                />
                                {host.isLive && (
                                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-black text-white truncate">
                                    {host.displayName}
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider">
                                    [{host.agencyTag}]
                                  </span>
                                  <span className="px-1.5 py-0.2 rounded bg-purple-500/25 text-purple-200 text-[8.5px] font-bold">
                                    Lv.{host.level}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400 font-mono">
                                  <span>ID: {host.uniqueId}</span>
                                  <span>•</span>
                                  <span className={host.isLive ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                                    {host.isLive ? '🔴 LIVE STREAMING' : '⚪ Offline'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Remote Live Trigger Button & WhatsApp */}
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              <button
                                type="button"
                                onClick={() => toggleHostLiveStatus(host.id)}
                                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm active:scale-95 ${
                                  host.isLive
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                }`}
                                title="Agency Owner Remote Live Access"
                              >
                                <Radio className="w-3 h-3" />
                                <span>{host.isLive ? 'End Host Live' : 'Turn Live On ⚡'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleContactHostWhatsApp('+923001234567', host.displayName)}
                                className="text-[10px] text-zinc-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </button>
                            </div>
                          </div>

                          {/* Resignation Alert Banner if Requested */}
                          {host.resignationRequested && (
                            <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-between gap-2">
                              <div className="text-[10.5px] text-rose-200 leading-tight">
                                <strong className="text-white block flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  Resignation Requested
                                </strong>
                                <span>{host.resignationReason || 'Host wishes to leave agency.'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenReleaseModal(host, host.resignationReason || 'Resignation accepted')}
                                className="px-2.5 py-1 rounded-xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider shrink-0 cursor-pointer shadow hover:brightness-110 active:scale-95"
                              >
                                Release Tag
                              </button>
                            </div>
                          )}

                          {/* Weekly Target Progress Card */}
                          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-[11px] font-black text-zinc-200">
                                  Weekly Target: {host.weeklyTargetDiamonds.toLocaleString()} 💎
                                </span>
                              </div>
                              <span
                                className={`text-[9px] px-2 py-0.5 rounded font-black uppercase ${
                                  host.targetStatus === 'achieved'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : host.targetStatus === 'expired'
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                    : 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                                }`}
                              >
                                {host.targetStatus} ({progressPct}%)
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-400 via-pink-500 to-[#7928CA] rounded-full transition-all"
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[10.5px] font-mono text-zinc-400">
                              <span>
                                Achieved: <strong className="text-white">{host.currentProgressDiamonds.toLocaleString()}</strong> 💎
                              </span>
                              <span>
                                Hours: <strong className="text-white">{host.weeklyHoursStreamed}</strong>/{host.weeklyTargetHours} hrs
                              </span>
                            </div>
                          </div>

                          {/* Earnings & Commission Breakdown */}
                          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                            <div className="p-2 rounded-xl bg-white/5">
                              <span className="text-[9.5px] text-zinc-400 uppercase block">Host Earnings</span>
                              <span className="font-mono font-bold text-white text-[11px]">
                                {host.weeklyEarnings.toLocaleString()} 💎
                              </span>
                            </div>

                            <div className="p-2 rounded-xl bg-white/5">
                              <span className="text-[9.5px] text-zinc-400 uppercase block">Agency Cut ({host.commissionRate}%)</span>
                              <span className="font-mono font-bold text-amber-300 text-[11px]">
                                +{agencyCut.toLocaleString()} 💎
                              </span>
                            </div>

                            <div className="p-2 rounded-xl bg-white/5">
                              <span className="text-[9.5px] text-zinc-400 uppercase block">Net Payout</span>
                              <span className="font-mono font-bold text-emerald-400 text-[11px]">
                                {hostNetPayout.toLocaleString()} 💎
                              </span>
                            </div>
                          </div>

                          {/* Card Footer Actions: Unified Edit Contract & Release Host */}
                          <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditContract(host)}
                              className="flex-1 py-1.5 rounded-xl bg-gradient-to-r from-amber-400/20 to-purple-500/20 hover:from-amber-400/30 hover:to-purple-500/30 border border-purple-400/40 text-purple-200 font-bold text-[10.5px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                              title="Edit target diamonds, weekly hours and commission rate"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                              <span>Edit Contract 📝</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenReleaseModal(host)}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Release Host from Agency & Remove Tag"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              <span>Release Host</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 2: INCOMING HOST JOIN REQUESTS */}
            {activeHostSubTab === 'requests' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                    Host Applications ({pendingHostRequestsCount} Pending)
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Review & bind official tag [{hostAgencyProfile.agencyTag}]
                  </span>
                </div>

                {hostJoinRequests.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-[#140929] border border-white/5 text-center space-y-2">
                    <FileText className="w-8 h-8 text-zinc-500 mx-auto" />
                    <p className="text-xs font-bold text-zinc-300">No pending host requests</p>
                    <p className="text-[10px] text-zinc-500">
                      When creators tap "Join Agency" in their profile, their requests will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {hostJoinRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-3xl bg-[#150A2B] border border-white/10 space-y-3 shadow-md"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={req.avatar}
                              alt={req.displayName}
                              className="w-11 h-11 rounded-2xl object-cover border border-purple-400/60 shadow"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-black text-white truncate">
                                  {req.displayName}
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 text-[8.5px] font-bold">
                                  Lv.{req.level}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                ID: {req.uniqueId} • Applied {req.appliedDate}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[8.5px] px-2 py-0.5 rounded font-black uppercase shrink-0 ${
                              req.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : req.status === 'rejected'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-amber-400/20 text-amber-300'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>

                        {/* Experience Note & Contact */}
                        <div className="p-2.5 rounded-xl bg-white/5 border border-white/5 space-y-1 text-xs">
                          <div className="text-zinc-300 text-[11px] leading-snug">
                            <strong className="text-white">Experience: </strong>
                            {req.experience}
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10.5px] font-mono">
                            <span className="text-zinc-400">WhatsApp: <strong className="text-emerald-400">{req.whatsapp}</strong></span>
                            <span className="text-zinc-400">Expected: <strong className="text-white">{req.expectedHours} hrs/wk</strong></span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {req.status === 'pending' ? (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleContactHostWhatsApp(req.whatsapp, req.displayName)}
                              className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 text-[10.5px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                              <span>WhatsApp 💬</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => rejectHostJoinRequest(req.id)}
                              className="px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10.5px] font-bold cursor-pointer"
                            >
                              Reject
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenApprovalModal(req)}
                              className="flex-[1.5] py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-[10.5px] uppercase tracking-wider flex items-center justify-center gap-1 shadow cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve & Set Contract</span>
                            </button>
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-500 text-center font-mono">
                            Application {req.status}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUB-TAB 3: HOST AGENCY SETTINGS */}
            {activeHostSubTab === 'settings' && (
              <form onSubmit={handleSaveHostSettings} className="rounded-3xl p-4 bg-[#150A2B] border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <h3 className="text-sm font-black text-white">Host Agency Settings & Terms</h3>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-amber-400 text-black font-black uppercase">
                    [{hostAgencyProfile.agencyTag}]
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
                    Official WhatsApp Contact for New Hosts
                  </label>
                  <input
                    type="text"
                    value={editHostWhatsApp}
                    onChange={(e) => setEditHostWhatsApp(e.target.value)}
                    placeholder="+92 300 1234567"
                    className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
                    Agency Slogan / Announcement
                  </label>
                  <input
                    type="text"
                    value={editHostSlogan}
                    onChange={(e) => setEditHostSlogan(e.target.value)}
                    placeholder="Elite livestreaming talent..."
                    className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10.5px] font-bold text-zinc-300 block mb-1">
                      Default Commission Rate (%)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={40}
                      value={editDefaultCommission}
                      onChange={(e) => setEditDefaultCommission(parseInt(e.target.value, 10))}
                      className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-bold text-zinc-300 block mb-1">
                      Min Weekly Streaming Hours
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={50}
                      value={editMinHours}
                      onChange={(e) => setEditMinHours(parseInt(e.target.value, 10))}
                      className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white font-mono"
                    />
                  </div>
                </div>

                {hostSettingsSavedToast && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Host agency settings updated successfully!</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white font-black text-xs uppercase tracking-wider shadow-lg hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  Save Host Agency Settings
                </button>
              </form>
            )}
          </div>
        ) : (
          /* =========================================================================
             BRANCH 1: COIN SELLER AGENCY (ACTIVE SYSTEM)
             ========================================================================= */
          <div className="space-y-4 animate-fade-in">
            {/* Top Hero Balance Card */}
            <div className="relative rounded-3xl p-5 bg-gradient-to-b from-[#2B1705] via-[#1C0D30] to-[#0D0518] border border-amber-400/60 shadow-[0_0_30px_rgba(245,158,11,0.2)] overflow-hidden">
              <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-[#EC4899]/15 blur-3xl pointer-events-none" />

              <div className="relative z-10 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                      Agency Current Balance
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[8.5px] font-extrabold border border-emerald-500/30">
                      LIVE STOCK
                    </span>
                  </div>

                  {/* Big Balance Number */}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-black shadow-md shrink-0">
                      <Coins className="w-4 h-4 fill-current text-black" />
                    </div>
                    <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white">
                      {agencyProfile.agencyBalance.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-amber-300 self-end mb-1">
                      Coins
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-300 mt-1">
                    Official stock ready for direct transfers and instant order delivery.
                  </p>
                </div>

                <div className="shrink-0 flex flex-col items-end">
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9.5px] font-black flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-amber-400" />
                    <span>Official Merchant</span>
                  </span>
                  <span className="text-[9.5px] text-zinc-400 font-mono mt-1">
                    Code: {agencyProfile.agencyCode}
                  </span>
                </div>
              </div>

              {/* Action Buttons inside Card */}
              <div className="relative z-10 grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsSendCoinsModalOpen(true)}
                  className="h-11 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Send Coins ⚡</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(true)}
                  className="h-11 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span>Security PIN</span>
                </button>
              </div>
            </div>

            {/* Quick Stats Pill Row */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setActiveCoinSubTab('orders');
                  setOrderFilter('pending');
                }}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  activeCoinSubTab === 'orders' && orderFilter === 'pending'
                    ? 'bg-amber-400/20 border-amber-400'
                    : 'bg-[#150A28] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="text-lg font-black text-amber-300 font-mono">
                  {pendingOrdersCount}
                </div>
                <div className="text-[9.5px] font-bold text-zinc-300 uppercase mt-0.5">
                  Pending Orders
                </div>
              </button>

              <button
                onClick={() => {
                  setActiveCoinSubTab('orders');
                  setOrderFilter('delivered');
                }}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  activeCoinSubTab === 'orders' && orderFilter === 'delivered'
                    ? 'bg-emerald-500/20 border-emerald-500'
                    : 'bg-[#150A28] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="text-lg font-black text-emerald-400 font-mono">
                  {deliveredOrdersCount}
                </div>
                <div className="text-[9.5px] font-bold text-zinc-300 uppercase mt-0.5">
                  Delivered
                </div>
              </button>

              <button
                onClick={() => setActiveCoinSubTab('history')}
                className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                  activeCoinSubTab === 'history'
                    ? 'bg-purple-500/20 border-purple-400'
                    : 'bg-[#150A28] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="text-lg font-black text-purple-300 font-mono">
                  {agencyTransactions.length}
                </div>
                <div className="text-[9.5px] font-bold text-zinc-300 uppercase mt-0.5">
                  Transfers Log
                </div>
              </button>
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#140929] border border-white/10">
              {[
                { id: 'orders', label: `Orders (${agencyOrders.length})`, icon: FileText },
                { id: 'send', label: 'Send Coins', icon: Send },
                { id: 'history', label: 'History', icon: History },
                { id: 'settings', label: 'WhatsApp & Info', icon: Settings },
              ].map((tab) => {
                const isActive = activeCoinSubTab === tab.id;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCoinSubTab(tab.id as any)}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-400 to-amber-600 text-black shadow font-black'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <TabIcon className="w-3.5 h-3.5" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: ORDERS (Pending / Delivered / All) */}
            {activeCoinSubTab === 'orders' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: 'pending', label: `Pending (${pendingOrdersCount})` },
                      { id: 'delivered', label: `Delivered (${deliveredOrdersCount})` },
                      { id: 'all', label: `All (${agencyOrders.length})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setOrderFilter(f.id as any)}
                        className={`px-3 py-1 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer ${
                          orderFilter === f.id
                            ? 'bg-white/20 text-white border border-white/30'
                            : 'bg-white/5 text-zinc-400 hover:text-white border border-transparent'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <span className="text-[10px] text-zinc-400">
                    Tap order to inspect receipt
                  </span>
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-[#140929] border border-white/5 text-center space-y-2">
                    <FileText className="w-8 h-8 text-zinc-500 mx-auto" />
                    <p className="text-xs font-bold text-zinc-300">No orders in this category</p>
                    <p className="text-[10px] text-zinc-500">
                      Incoming user purchase requests with payment slips will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredOrders.map((ord) => (
                      <div
                        key={ord.id}
                        onClick={() => setSelectedOrder(ord)}
                        className="p-3.5 rounded-2xl bg-[#150A2B] hover:bg-[#1C0E38] border border-white/10 hover:border-amber-400/40 transition-all cursor-pointer group shadow-sm flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <img
                              src={ord.buyerAvatar}
                              alt={ord.buyerName}
                              className="w-11 h-11 rounded-2xl object-cover border border-amber-400/60 shadow"
                            />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border border-black flex items-center justify-center text-[7px] text-white font-bold">
                              ✓
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs sm:text-sm font-black text-white group-hover:text-amber-300 transition-colors truncate">
                                {ord.buyerName}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-400">
                                ({ord.buyerUniqueId})
                              </span>
                            </div>

                            <div className="flex items-center gap-2 mt-0.5 text-[10.5px]">
                              <span className="flex items-center gap-1 font-mono font-bold text-amber-300">
                                <Coins className="w-3 h-3 fill-amber-400" />
                                {ord.coins.toLocaleString()} Coins
                              </span>
                              <span>•</span>
                              <span className="text-zinc-400">{ord.paymentMethod}</span>
                              <span>•</span>
                              <span className="text-zinc-500 text-[10px]">{ord.createdAt}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-black text-emerald-400 block font-mono">
                              {ord.price}
                            </span>
                            <span
                              className={`text-[8.5px] px-1.5 py-0.2 rounded font-bold uppercase ${
                                ord.status === 'delivered'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : ord.status === 'rejected'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'bg-amber-400/20 text-amber-300'
                              }`}
                            >
                              {ord.status}
                            </span>
                          </div>

                          <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 bg-black shrink-0 relative group-hover:border-amber-400">
                            <img
                              src={ord.receiptUrl}
                              alt="Receipt slip"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: INLINE SEND COINS */}
            {activeCoinSubTab === 'send' && (
              <div className="rounded-3xl p-4 bg-[#150A2B] border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div>
                    <h3 className="text-sm font-black text-white">Direct Coin Transfer</h3>
                    <p className="text-[10px] text-zinc-400">
                      Stock: <span className="text-amber-300 font-mono font-bold">{agencyProfile.agencyBalance.toLocaleString()} Coins</span>
                    </p>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-black border border-amber-400/40">
                    PIN PROTECTED
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
                    Recipient User ID or Username
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={directQuery}
                      onChange={(e) => {
                        setDirectQuery(e.target.value);
                        setDirectError(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchDirectUser()}
                      placeholder="e.g. AM_664129 or sophia"
                      className="flex-1 h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white placeholder-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={handleSearchDirectUser}
                      className="px-3.5 h-11 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs flex items-center gap-1 cursor-pointer shadow"
                    >
                      <Search className="w-3.5 h-3.5" />
                      <span>Verify</span>
                    </button>
                  </div>
                </div>

                {directUser && (
                  <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-between animate-fade-in">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={directUser.avatar}
                        alt={directUser.displayName}
                        className="w-10 h-10 rounded-xl object-cover border border-emerald-400/70"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white">{directUser.displayName}</span>
                          <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 text-[8.5px] font-bold">
                            Lv.{directUser.level}
                          </span>
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono font-bold">
                          ID: {directUser.uniqueId} • @{directUser.username}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9.5px] font-black text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/20">
                      Ready
                    </span>
                  </div>
                )}

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
                    Coins to Send
                  </label>
                  <div className="relative">
                    <Coins className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2 fill-amber-400" />
                    <input
                      type="number"
                      value={directAmount}
                      onChange={(e) => setDirectAmount(e.target.value)}
                      placeholder="0"
                      className="w-full h-11 pl-9 pr-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-sm font-mono font-bold text-white"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[10000, 50000, 100000, 500000].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDirectAmount(v.toString())}
                        className="py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[9.5px] font-mono font-bold text-zinc-300 cursor-pointer"
                      >
                        +{(v / 1000)}k
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Security PIN (4 Digits)</span>
                    </label>
                    <span className="text-[9.5px] text-zinc-400">Default: 1234</span>
                  </div>
                  <input
                    type="password"
                    maxLength={4}
                    value={directPin}
                    onChange={(e) => setDirectPin(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="••••"
                    className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-center text-lg font-mono tracking-[0.5em] font-black text-amber-300"
                  />
                </div>

                {directError && (
                  <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{directError}</span>
                  </div>
                )}

                {directSuccess && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{directSuccess}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleExecuteDirectSend}
                  disabled={!directUser || !directAmount || directPin.length !== 4}
                  className={`w-full h-12 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
                    !directUser || !directAmount || directPin.length !== 4
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-amber-400 to-amber-600 text-black shadow-amber-500/30 hover:brightness-110 active:scale-95 cursor-pointer'
                  }`}
                >
                  <Coins className="w-4 h-4 fill-current" />
                  <span>Transfer Coins</span>
                </button>
              </div>
            )}

            {/* TAB 3: TRANSACTION HISTORY */}
            {activeCoinSubTab === 'history' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-300">
                    Coin Transfer Log
                  </h3>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Total {agencyTransactions.length} Records
                  </span>
                </div>

                {agencyTransactions.length === 0 ? (
                  <div className="p-8 rounded-3xl bg-[#140929] border border-white/5 text-center">
                    <History className="w-8 h-8 text-zinc-500 mx-auto" />
                    <p className="text-xs font-bold text-zinc-300 mt-2">No transactions recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agencyTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3.5 rounded-2xl bg-[#150A2B] border border-white/10 flex items-center justify-between gap-3 shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={tx.recipientAvatar}
                            alt={tx.recipientName}
                            className="w-10 h-10 rounded-xl object-cover border border-amber-400/40 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-black text-white block truncate">
                              {tx.recipientName}
                            </span>
                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5 font-mono">
                              <span className="text-amber-300 font-bold">ID: {tx.recipientUniqueId}</span>
                              <span>•</span>
                              <span>{tx.timestamp}</span>
                            </div>
                            <span className="text-[9px] text-zinc-500 font-mono">
                              Ref: {tx.referenceId || tx.id}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-1 text-sm font-mono font-black text-amber-300 justify-end">
                            <span>-{tx.coins.toLocaleString()}</span>
                            <Coins className="w-3.5 h-3.5 fill-amber-400" />
                          </div>
                          <span className="text-[9.5px] font-mono text-zinc-400 block mt-0.5">
                            Bal: {tx.remainingBalance.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: WHATSAPP & AGENCY SETTINGS */}
            {activeCoinSubTab === 'settings' && (
              <form onSubmit={handleSaveCoinSettings} className="rounded-3xl p-4 bg-[#150A2B] border border-white/10 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <h3 className="text-sm font-black text-white">Agency Contact & Profile Setup</h3>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-black">
                    PUBLIC
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
                    Official WhatsApp Number (Shown to Buyers)
                  </label>
                  <div className="relative">
                    <MessageCircle className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={editWhatsApp}
                      onChange={(e) => setEditWhatsApp(e.target.value)}
                      placeholder="+92 300 1234567"
                      className="w-full h-11 pl-9 pr-3 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs font-mono font-bold text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block mb-1">
                    Agency Slogan / Tagline
                  </label>
                  <input
                    type="text"
                    value={editSlogan}
                    onChange={(e) => setEditSlogan(e.target.value)}
                    placeholder="Get coins from official agency direct..."
                    className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-xs text-white"
                  />
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Security PIN</span>
                    <span className="text-[10px] text-zinc-400">Currently active for all transfers</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 text-black font-black text-[10.5px] uppercase cursor-pointer"
                  >
                    Change PIN
                  </button>
                </div>

                {settingsSavedToast && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Agency settings updated successfully!</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full h-11 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-95 cursor-pointer"
                >
                  Save Agency Details
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: APPROVE HOST JOIN REQUEST & INITIAL CONTRACT SETUP */}
      {approvingCandidate && (
        <div
          onClick={() => setApprovingCandidate(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#160A2C] border border-purple-400/50 shadow-2xl p-5 space-y-4 max-h-[92dvh] overflow-y-auto scrollbar-none"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Approve Host & Set Contract</span>
                </h3>
                <p className="text-[10px] text-zinc-400">
                  Configure weekly targets and bind official agency tag
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApprovingCandidate(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Candidate Summary Card */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={approvingCandidate.avatar}
                  alt={approvingCandidate.displayName}
                  className="w-11 h-11 rounded-2xl object-cover border border-purple-400/60 shadow shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white truncate">
                      {approvingCandidate.displayName}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 text-[8.5px] font-bold">
                      Lv.{approvingCandidate.level}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5 truncate">
                    ID: {approvingCandidate.uniqueId} • WhatsApp: {approvingCandidate.whatsapp}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider block">
                  [{hostAgencyProfile.agencyTag}]
                </span>
                <span className="text-[8.5px] text-zinc-400 block mt-0.5">Tag to Bind</span>
              </div>
            </div>

            {/* Target Diamonds Setup */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span>Weekly Diamond Target</span>
                </label>
                <span className="text-xs font-mono font-black text-amber-300">
                  {candidateDiamonds.toLocaleString()} 💎
                </span>
              </div>

              <input
                type="number"
                value={candidateDiamonds}
                onChange={(e) => setCandidateDiamonds(parseInt(e.target.value, 10) || 0)}
                className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-sm font-mono font-bold text-amber-300"
              />

              {/* Quick Preset Chips */}
              <div className="grid grid-cols-6 gap-1 pt-1">
                {[100000, 250000, 500000, 1000000, 2000000, 5000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setCandidateDiamonds(amt)}
                    className={`py-1.5 rounded-lg text-[9.5px] font-mono font-bold transition-all cursor-pointer ${
                      candidateDiamonds === amt
                        ? 'bg-amber-400 text-black shadow'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5'
                    }`}
                  >
                    {amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Commission Rate (%) */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-black/40 border border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-purple-400" />
                  <span>Agreed Commission Rate</span>
                </label>
                <span className="text-xs font-mono font-black text-purple-300">
                  {candidateCommission}% Agency Cut
                </span>
              </div>

              <input
                type="range"
                min={5}
                max={40}
                step={1}
                value={candidateCommission}
                onChange={(e) => setCandidateCommission(parseInt(e.target.value, 10))}
                className="w-full accent-purple-400 cursor-pointer"
              />

              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-1 border-t border-white/5">
                <span>
                  Host Payout: <strong className="text-emerald-400">{100 - candidateCommission}%</strong>
                </span>
                <span>
                  Agency Cut: <strong className="text-amber-300">{candidateCommission}%</strong>
                </span>
              </div>
            </div>

            {/* Required Weekly Hours */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-pink-400" />
                  <span>Required Weekly Hours</span>
                </label>
                <span className="text-xs font-mono font-black text-pink-300">
                  {candidateHours} hrs/week
                </span>
              </div>

              <input
                type="range"
                min={10}
                max={50}
                step={2}
                value={candidateHours}
                onChange={(e) => setCandidateHours(parseInt(e.target.value, 10))}
                className="w-full accent-pink-500 cursor-pointer"
              />

              <div className="grid grid-cols-5 gap-1 pt-1">
                {[10, 15, 20, 25, 30].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setCandidateHours(h)}
                    className={`py-1 rounded-lg text-[9.5px] font-mono font-bold transition-all cursor-pointer ${
                      candidateHours === h
                        ? 'bg-pink-500 text-white shadow'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5'
                    }`}
                  >
                    {h} hrs
                  </button>
                ))}
              </div>
            </div>

            {/* Tag Binding Note */}
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-400/20 text-[10.5px] text-purple-200">
              <span>
                Upon approval, official tag <strong className="text-amber-400 font-mono">[{hostAgencyProfile.agencyTag}]</strong> will be automatically attached to {approvingCandidate.displayName}'s profile and live streams.
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setApprovingCandidate(null)}
                className="flex-1 h-11 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-zinc-300 cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmApproval}
                className="flex-[2] h-11 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirm & Bind [{hostAgencyProfile.agencyTag}]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONTINUOUS EDIT HOST CONTRACT (TARGET, HOURS & COMMISSION) */}
      {editingContractHost && (
        <div
          onClick={() => setEditingContractHost(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl bg-[#160A2C] border border-amber-400/50 shadow-2xl p-5 space-y-4 max-h-[92dvh] overflow-y-auto scrollbar-none"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                  <span>Edit Host Contract & Targets</span>
                </h3>
                <p className="text-[10px] text-zinc-400">
                  Update contract terms for {editingContractHost.displayName} anytime
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingContractHost(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Host Info */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={editingContractHost.avatar}
                  alt={editingContractHost.displayName}
                  className="w-10 h-10 rounded-2xl object-cover border border-purple-400/60 shadow shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-xs font-black text-white block truncate">
                    {editingContractHost.displayName}
                  </span>
                  <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                    ID: {editingContractHost.uniqueId} • Lv.{editingContractHost.level}
                  </div>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-black text-[9px] font-black uppercase tracking-wider shrink-0">
                [{editingContractHost.agencyTag}]
              </span>
            </div>

            {/* Diamond Target Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span>Weekly Diamond Target</span>
                </label>
                <span className="text-xs font-mono font-black text-amber-300">
                  {editContractDiamonds.toLocaleString()} 💎
                </span>
              </div>

              <input
                type="number"
                value={editContractDiamonds}
                onChange={(e) => setEditContractDiamonds(parseInt(e.target.value, 10) || 0)}
                className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-sm font-mono font-bold text-amber-300"
              />

              <div className="grid grid-cols-6 gap-1 pt-1">
                {[100000, 250000, 500000, 1000000, 2000000, 5000000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setEditContractDiamonds(amt)}
                    className={`py-1.5 rounded-lg text-[9.5px] font-mono font-bold transition-all cursor-pointer ${
                      editContractDiamonds === amt
                        ? 'bg-amber-400 text-black shadow'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5'
                    }`}
                  >
                    {amt >= 1000000 ? `${amt / 1000000}M` : `${amt / 1000}k`}
                  </button>
                ))}
              </div>
            </div>

            {/* Commission Rate (%) */}
            <div className="space-y-1.5 p-3 rounded-2xl bg-black/40 border border-white/5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-purple-400" />
                  <span>Agency Commission Cut</span>
                </label>
                <span className="text-xs font-mono font-black text-purple-300">
                  {editContractCommission}% Cut
                </span>
              </div>

              <input
                type="range"
                min={5}
                max={40}
                step={1}
                value={editContractCommission}
                onChange={(e) => setEditContractCommission(parseInt(e.target.value, 10))}
                className="w-full accent-purple-400 cursor-pointer"
              />

              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono pt-1 border-t border-white/5">
                <span>
                  Host Payout: <strong className="text-emerald-400">{100 - editContractCommission}%</strong>
                </span>
                <span>
                  Agency Cut: <strong className="text-amber-300">{editContractCommission}%</strong>
                </span>
              </div>
            </div>

            {/* Streaming Hours */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-pink-400" />
                  <span>Streaming Hours / Week</span>
                </label>
                <span className="text-xs font-mono font-black text-pink-300">
                  {editContractHours} hrs
                </span>
              </div>

              <input
                type="range"
                min={10}
                max={50}
                step={2}
                value={editContractHours}
                onChange={(e) => setEditContractHours(parseInt(e.target.value, 10))}
                className="w-full accent-pink-500 cursor-pointer"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingContractHost(null)}
                className="flex-1 h-11 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-zinc-300 cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveContract}
                className="flex-[2] h-11 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 text-black font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                Save Updated Contract 📝
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RELEASE HOST FROM AGENCY & REMOVE TAG */}
      {releasingHost && (
        <div
          onClick={() => setReleasingHost(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-[#1A0A1C] border border-rose-500/50 shadow-2xl p-5 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Release Host & Remove Tag</h3>
                  <span className="text-[10px] text-zinc-400">Permanently unbind from agency</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReleasingHost(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Host Card Preview */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
              <img
                src={releasingHost.avatar}
                alt={releasingHost.displayName}
                className="w-11 h-11 rounded-2xl object-cover border border-rose-400/50"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white truncate">{releasingHost.displayName}</span>
                  <span className="px-1.5 py-0.2 rounded bg-amber-400 text-black text-[8.5px] font-black line-through">
                    [{releasingHost.agencyTag}]
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                  ID: {releasingHost.uniqueId}
                </div>
              </div>
            </div>

            {/* Release Consequences Notice */}
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-200 space-y-1.5 leading-snug">
              <p className="font-bold text-white">Notice of Agency Release:</p>
              <ul className="space-y-1 list-disc list-inside text-zinc-300 text-[10.5px]">
                <li>Official tag <strong className="text-amber-300">[{releasingHost.agencyTag}]</strong> will be removed.</li>
                <li>Host will be released from all targets and commission.</li>
                <li>Host will be completely free to stream independently or join another agency.</li>
              </ul>
            </div>

            {/* Optional Reason Input */}
            <div>
              <label className="text-[10.5px] font-bold text-zinc-300 block mb-1">
                Release Reason / Notice (Optional)
              </label>
              <input
                type="text"
                value={releaseReason}
                onChange={(e) => setReleaseReason(e.target.value)}
                placeholder="e.g. Contract completed, Resignation accepted..."
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-rose-400 focus:outline-none text-xs text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReleasingHost(null)}
                className="flex-1 h-11 rounded-2xl bg-white/10 hover:bg-white/15 text-xs font-bold text-zinc-300 cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRelease}
                className="flex-[1.5] h-11 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <UserMinus className="w-4 h-4" />
                <span>Release Host</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Feedback Toast */}
      {actionFeedbackToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm px-4 py-2.5 rounded-2xl bg-[#1A0E2E]/95 border border-purple-400/60 shadow-2xl flex items-center gap-2.5 text-xs font-bold text-white animate-fade-in backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{actionFeedbackToast}</span>
        </div>
      )}

      {/* Global Agency Modals */}
      <SendCoinsModal
        isOpen={isSendCoinsModalOpen}
        onClose={() => setIsSendCoinsModalOpen(false)}
      />

      <AgencyOrderDetailsModal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        order={selectedOrder}
      />

      <AgencyPinSetupModal
        isOpen={isPinModalOpen}
        onClose={() => setIsPinModalOpen(false)}
      />

      <ApplyAgencyModal
        isOpen={isApplyAgencyModalOpen}
        onClose={() => setIsApplyAgencyModalOpen(false)}
        defaultType={activeBranch}
      />
    </div>
  );
};
