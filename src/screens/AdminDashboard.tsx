import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AlphaMateLogo } from '../components/brand/AlphaMateLogo';
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
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const {
    liveStreams,
    setDeviceMode,
    customLogoUrl,
    openLiveStream,
    agencyApplications,
    reviewAgencyApplication,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>(liveStreams[0]?.id || '');
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const activeMonitorStream = liveStreams.find((s) => s.id === selectedStreamId) || liveStreams[0];

  const totalViewers = liveStreams.reduce((acc, s) => acc + s.viewerCount, 0);

  const handleAction = (type: string, hostName: string) => {
    setActionNotice(`Admin action applied: [${type}] issued to ${hostName}. Notification sent to moderation log.`);
    setTimeout(() => setActionNotice(null), 3500);
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

        {/* Action Button: Switch back to Mobile Touch App */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setDeviceMode('mobile')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white font-bold text-xs shadow-lg shadow-[#7928CA]/30 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            <Smartphone className="w-4 h-4" />
            <span>Switch to Mobile View</span>
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
              <span>Gift Revenue Velocity</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono">$18,420.50 USD</div>
            <div className="text-[11px] text-zinc-400 mt-1">
              <span>384,000 Coins Circulating</span>
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

        {/* Split View: Live Stream Table + Audit Video Monitor */}
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
                              src={stream.host.avatar}
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
                              onClick={() => handleAction('Warning', stream.host.displayName)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold"
                            >
                              Warn
                            </button>
                            <button
                              onClick={() => handleAction('Ban / Force Stop', stream.host.displayName)}
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
                <img
                  src={activeMonitorStream?.thumbnail}
                  alt="Monitor"
                  className="w-full h-full object-cover"
                />
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
                            onClick={() => reviewAgencyApplication(app.id, 'reject')}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10.5px] font-bold cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => reviewAgencyApplication(app.id, 'approve')}
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
      </div>
    </div>
  );
};
