import React, { useMemo, useRef, useState } from 'react';
import {
  AdvancedGiftConfig,
  AdvancedGiftFormat,
  AdvancedGiftStatus,
  GiftAnimationType,
  GiftDisplayMode,
  GiftEdgeBlendMode,
  GiftPlaybackPosition,
  UnifiedGiftKind,
} from '../../types';
import { useApp } from '../../context/AppContext';
import {
  ALPHA_MATE_TEST_GIFT_ID,
  DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG,
  SAMPLE_TRANSPARENT_SVG_URL,
  UPLOADED_TEST_WEBM_URL,
  UNIFIED_GIFT_SCHEMA_VERSION,
  advancedGiftConfigToGift,
  convertAdminGiftToWebm,
  detectDeviceGiftCapabilities,
  probeAdminLocalGiftFile,
  uploadAdminGiftFile,
} from '../../services/giftAnimationEngine';
import { UniversalGiftPlayer } from '../live/UniversalGiftPlayer';
import {
  Upload,
  Sparkles,
  Play,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Film,
  Layers,
  Trash2,
  Eye,
  EyeOff,
  Save,
  Volume2,
  VolumeX,
  Plus,
  Cpu,
  ShieldCheck,
  Wand2,
  FlaskConical,
  Image as ImageIcon,
  Maximize2,
  X,
  Search,
  Database,
} from 'lucide-react';

function createBlankGiftConfig(kind: UnifiedGiftKind = 'animated'): AdvancedGiftConfig {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const id = `gift_${nowMs.toString(36)}`;
  return {
    id,
    schemaVersion: UNIFIED_GIFT_SCHEMA_VERSION,
    giftKind: kind,
    name: kind === 'static' ? 'New Sticker Gift' : 'New Animated Gift',
    description:
      kind === 'static'
        ? 'Static PNG / sticker gift for Live & Party rooms.'
        : 'Custom multi-format live room animation gift.',
    category: kind === 'static' ? 'Stickers' : 'VIP & Special',
    coins: kind === 'static' ? 50 : 500,
    icon: kind === 'static' ? '✨' : '🎁',
    thumbnailUrl: SAMPLE_TRANSPARENT_SVG_URL,
    previewImageUrl: SAMPLE_TRANSPARENT_SVG_URL,
    originalFileUrl: '',
    optimizedFileUrl: undefined,
    animationUrl: '',
    format: 'webm',
    animationType: 'sparkle',
    displayMode: 'semi_transparent',
    transparencyStatus: 'unknown',
    opacity: 90,
    durationMs: kind === 'static' ? 4000 : 10000,
    loop: false,
    playbackSpeed: 1,
    position: 'fullscreen',
    scale: 1,
    priority: 50,
    enableParticles: true,
    enableSound: true,
    edgeFeather: kind === 'animated',
    blendMode: 'normal',
    status: 'draft',
    isActive: false,
    show: false,
    conversionStatus: 'not_needed',
    isTestGift: false,
    createdAt: now,
    createdAtMs: nowMs,
    updatedAt: now,
    updatedAtMs: nowMs,
  };
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function detectLocalVideoDurationSec(file: File): Promise<number | null> {
  if (typeof document === 'undefined' || !file.type.startsWith('video/')) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const cleanup = () => {
      try {
        URL.revokeObjectURL(objectUrl);
      } catch {
        // ignore
      }
    };
    const timer = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 4500);
    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const dur = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      cleanup();
      resolve(dur);
    };
    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(null);
    };
    video.src = objectUrl;
  });
}

export const AdvancedGiftManager: React.FC = () => {
  const {
    unifiedCatalogGifts,
    catalogSyncStats,
    saveAdvancedGift,
    deleteAdvancedGift,
    migrateUnifiedGiftCatalog,
    firebaseUser,
  } = useApp();

  const unifiedCatalogItems = unifiedCatalogGifts;

  const [catalogFilter, setCatalogFilter] = useState<'all' | 'animated' | 'static' | 'published' | 'inactive'>('all');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSort, setCatalogSort] = useState<'priority' | 'coins_asc' | 'coins_desc' | 'newest'>('priority');
  const [isMigratingSchema, setIsMigratingSchema] = useState(false);
  const [togglingGiftId, setTogglingGiftId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AdvancedGiftConfig>(
    () =>
      unifiedCatalogItems.find((g) => g.id === ALPHA_MATE_TEST_GIFT_ID) ||
      unifiedCatalogItems[0] ||
      DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG
  );
  const [isUploadingAnim, setIsUploadingAnim] = useState(false);
  const [isUploadingThumb, setIsUploadingThumb] = useState(false);
  const [isProbing, setIsProbing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'warn' | 'err'; text: string } | null>(null);
  const [previewNonce, setPreviewNonce] = useState(1);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [previewLoop, setPreviewLoop] = useState(true);
  const [previewSource, setPreviewSource] = useState<'optimized' | 'original'>('optimized');
  const [stageControlClicks, setStageControlClicks] = useState(0);
  const [isFullScreenTestOpen, setIsFullScreenTestOpen] = useState(false);

  const animFileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbFileInputRef = useRef<HTMLInputElement | null>(null);

  const capabilities = useMemo(() => detectDeviceGiftCapabilities(), []);
  const isOfficialAdmin = firebaseUser?.email?.toLowerCase() === 'alphamateapp@gmail.com';

  const notify = (type: 'ok' | 'warn' | 'err', text: string) => {
    setStatusMessage({ type, text });
    window.setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 5500);
  };

  const handleSelectExisting = (item: AdvancedGiftConfig) => {
    setDraft({ ...item });
    setPreviewSource(item.optimizedFileUrl ? 'optimized' : 'original');
    setPreviewNonce((n) => n + 1);
  };

  const handleLoadSvgSpecimen = async () => {
    const now = new Date().toISOString();
    const specimen: AdvancedGiftConfig = {
      ...createBlankGiftConfig(),
      id: 'sample_transparent_svg_crown',
      name: 'Royal Crown SVG (Transparent Test)',
      description: 'Sanitized transparent animated SVG gift using SMIL <animateTransform> with zero background box.',
      category: 'Test & Showcase',
      coins: 1000,
      icon: '👑',
      thumbnailUrl: SAMPLE_TRANSPARENT_SVG_URL,
      previewImageUrl: SAMPLE_TRANSPARENT_SVG_URL,
      originalFileUrl: SAMPLE_TRANSPARENT_SVG_URL,
      optimizedFileUrl: SAMPLE_TRANSPARENT_SVG_URL,
      animationUrl: SAMPLE_TRANSPARENT_SVG_URL,
      format: 'svg',
      displayMode: 'transparent',
      transparencyStatus: 'alpha_verified',
      opacity: 100,
      durationMs: 6000,
      loop: true,
      playbackSpeed: 1,
      position: 'center',
      scale: 0.95,
      priority: 80,
      status: 'draft',
      conversionStatus: 'not_needed',
      isTestGift: true,
      analysis: {
        format: 'svg',
        container: 'image/svg+xml',
        codec: 'SVG (SMIL)',
        pixFmt: 'vector-rgba',
        width: 320,
        height: 320,
        fps: 60,
        durationSec: 5,
        fileSizeBytes: 1850,
        hasAlpha: true,
        hasAudio: false,
        transparencyStatus: 'alpha_verified',
        recommendedMode: 'transparent',
        androidWebViewCompatible: true,
        warnings: [],
        svgFeatures: {
          hasSmil: true,
          hasCssKeyframes: false,
          unsupportedFeatures: [],
        },
      },
      createdAt: now,
      updatedAt: now,
    };
    setDraft(specimen);
    setPreviewNonce((n) => n + 1);
    notify('ok', 'Loaded transparent SMIL SVG test specimen. Preview all 3 modes on the stage or publish it.');
  };

  const handleUploadAnimation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploadingAnim(true);
    try {
      const [localDurationSec, res] = await Promise.all([
        detectLocalVideoDurationSec(file),
        uploadAdminGiftFile(file, 'animation'),
      ]);
      if (!res.success || !res.originalFileUrl || !res.format) {
        notify('err', res.error || 'Failed to upload animation file.');
        return;
      }

      const analysis = res.analysis;
      const effectiveDurationSec =
        analysis?.durationSec && analysis.durationSec >= 1.0
          ? analysis.durationSec
          : localDurationSec && localDurationSec >= 1.0
          ? localDurationSec
          : null;
      const detectedDurationMs = effectiveDurationSec
        ? Math.min(60_000, Math.max(1500, Math.round(effectiveDurationSec * 1000)))
        : Math.max(10_000, draft.durationMs);

      const isTransparentNative =
        res.format === 'svga' || res.format === 'svg' || Boolean(analysis?.hasAlpha);
      const isVideoUpload = res.format === 'webm' || res.format === 'mp4' || res.format === 'mov';

      setDraft((prev) => ({
        ...prev,
        giftKind: 'animated',
        originalFileUrl: res.originalFileUrl!,
        optimizedFileUrl:
          res.format === 'svga' || res.format === 'svg' || res.format === 'gif' || res.format === 'webm'
            ? res.originalFileUrl
            : undefined,
        animationUrl: res.originalFileUrl!,
        format: res.format!,
        transparencyStatus: analysis?.transparencyStatus || (isTransparentNative ? 'alpha_verified' : 'unknown'),
        displayMode: isTransparentNative ? 'transparent' : analysis?.recommendedMode || 'semi_transparent',
        opacity: isTransparentNative ? 100 : 90,
        position: 'fullscreen',
        edgeFeather: !isTransparentNative,
        blendMode: 'normal',
        loop: isVideoUpload ? false : prev.loop,
        durationMs: detectedDurationMs,
        conversionStatus: res.format === 'mov' ? 'pending' : 'not_needed',
        conversionMessage:
          res.format === 'svga'
            ? 'SVGA uploaded — native transparent canvas playback ready (zero background box).'
            : res.format === 'mov'
            ? 'MOV uploaded — click "Convert to Optimized WebM (VP9)" for Android & Web compatibility.'
            : analysis?.hasAlpha
            ? 'Alpha channel verified on upload — pure transparent playback ready.'
            : 'Uploaded and analyzed via server ffprobe — Full-width Soft Edge Merge enabled automatically.',
        analysis,
        updatedAt: new Date().toISOString(),
      }));
      setPreviewSource('original');
      setPreviewNonce((n) => n + 1);
      notify(
        analysis?.warnings?.length ? 'warn' : 'ok',
        `Uploaded ${file.name} (${res.format.toUpperCase()}). ${
          isTransparentNative
            ? 'Native transparency verified — zero background box.'
            : 'Full-width edge-feathered merge enabled so corners & borders dissolve seamlessly.'
        }`
      );
    } finally {
      setIsUploadingAnim(false);
    }
  };

  const handleUploadThumbnail = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsUploadingThumb(true);
    try {
      const res = await uploadAdminGiftFile(file, 'thumbnail');
      if (!res.success || !res.fileUrl) {
        notify('err', res.error || 'Failed to upload thumbnail image.');
        return;
      }
      setDraft((prev) => ({
        ...prev,
        thumbnailUrl: res.fileUrl,
        previewImageUrl: res.fileUrl,
        updatedAt: new Date().toISOString(),
      }));
      notify('ok', `Thumbnail uploaded (${file.name}).`);
    } finally {
      setIsUploadingThumb(false);
    }
  };

  const handleRunLiveProbe = async () => {
    const targetUrl = draft.originalFileUrl || draft.animationUrl;
    if (!targetUrl) {
      notify('err', 'Upload or select a gift media file first.');
      return;
    }
    setIsProbing(true);
    try {
      const res = await probeAdminLocalGiftFile(targetUrl);
      if (!res.success || !res.analysis) {
        notify('err', res.error || 'Server ffprobe inspection failed.');
        return;
      }
      setDraft((prev) => ({
        ...prev,
        format: res.format || prev.format,
        transparencyStatus: res.analysis!.transparencyStatus,
        durationMs:
          res.analysis!.durationSec && res.analysis!.durationSec >= 1.5
            ? Math.min(60_000, Math.round(res.analysis!.durationSec * 1000))
            : prev.durationMs,
        analysis: res.analysis,
        updatedAt: new Date().toISOString(),
      }));
      notify(
        res.analysis.hasAlpha ? 'ok' : 'warn',
        `Live ffprobe completed: ${res.analysis.codec} (${res.analysis.pixFmt}), ${res.analysis.width}x${res.analysis.height} @ ${res.analysis.fps}fps.`
      );
    } finally {
      setIsProbing(false);
    }
  };

  const handleConvertToWebm = async () => {
    const sourceUrl = draft.originalFileUrl;
    if (!sourceUrl) {
      notify('err', 'Upload a MOV, MP4, or WebM video first.');
      return;
    }
    if (draft.format === 'svga' || draft.format === 'svg' || draft.format === 'gif') {
      notify('warn', 'SVGA, SVG, and GIF files play natively without FFmpeg video conversion.');
      return;
    }
    setIsConverting(true);
    setDraft((prev) => ({ ...prev, conversionStatus: 'converting' }));
    try {
      const res = await convertAdminGiftToWebm(sourceUrl);
      if (!res.success || !res.optimizedFileUrl) {
        setDraft((prev) => ({
          ...prev,
          conversionStatus: 'failed',
          conversionMessage: res.error || 'FFmpeg conversion failed.',
        }));
        notify('err', res.error || 'FFmpeg WebM conversion failed.');
        return;
      }
      setDraft((prev) => ({
        ...prev,
        optimizedFileUrl: res.optimizedFileUrl,
        animationUrl: res.optimizedFileUrl!,
        conversionStatus: 'completed',
        conversionMessage: res.preservedAlpha
          ? 'Converted to VP9 WebM with Alpha (yuva420p) — original preserved separately.'
          : 'Converted to optimized VP9 WebM (yuv420p) — source had no alpha channel; original preserved separately.',
        transparencyStatus: res.analysis?.transparencyStatus || prev.transparencyStatus,
        analysis: res.analysis || prev.analysis,
        updatedAt: new Date().toISOString(),
      }));
      setPreviewSource('optimized');
      setPreviewNonce((n) => n + 1);
      notify(
        res.preservedAlpha ? 'ok' : 'warn',
        res.preservedAlpha
          ? 'Converted to VP9 WebM with Alpha! Ready for Transparent Mode.'
          : 'Optimized VP9 WebM created (source had no alpha channel — use Semi-Transparent or Overlay/Background Mode).'
      );
    } finally {
      setIsConverting(false);
    }
  };

  const handleSaveGift = async (overrideStatus?: AdvancedGiftStatus) => {
    if (!draft.name.trim()) {
      notify('err', 'Gift name is required.');
      return;
    }
    const playableUrl = draft.optimizedFileUrl || draft.animationUrl || draft.originalFileUrl || '';
    const isStaticMode = draft.giftKind === 'static' || !playableUrl;
    if (!isStaticMode && !playableUrl) {
      notify('err', 'Upload a WebM/SVGA/MP4 animation or switch Gift Type to Static Sticker before saving.');
      return;
    }
    if (isStaticMode && !draft.thumbnailUrl && !draft.icon) {
      notify('err', 'Upload a PNG thumbnail or provide an icon for this static gift.');
      return;
    }
    if (draft.coins < 1) {
      notify('err', 'Coin price must be at least 1.');
      return;
    }

    setIsSaving(true);
    try {
      const nextStatus: AdvancedGiftStatus = overrideStatus || draft.status;
      const effectiveKind: UnifiedGiftKind = isStaticMode ? 'static' : 'animated';
      const toSave: AdvancedGiftConfig = {
        ...draft,
        schemaVersion: UNIFIED_GIFT_SCHEMA_VERSION,
        giftKind: effectiveKind,
        status: nextStatus,
        isActive: nextStatus === 'published',
        show: nextStatus === 'published',
        animationUrl: effectiveKind === 'animated' ? playableUrl : '',
        originalFileUrl: effectiveKind === 'animated' ? draft.originalFileUrl || playableUrl : '',
        optimizedFileUrl: effectiveKind === 'animated' ? draft.optimizedFileUrl : undefined,
        updatedAt: new Date().toISOString(),
        updatedAtMs: Date.now(),
      };
      const res = await saveAdvancedGift(toSave);
      if (res.success) {
        setDraft(toSave);
        notify('ok', res.message);
      } else {
        notify('err', res.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickToggleStatus = async (item: AdvancedGiftConfig) => {
    setTogglingGiftId(item.id);
    try {
      const nextStatus: AdvancedGiftStatus = item.status === 'published' ? 'disabled' : 'published';
      const res = await saveAdvancedGift({
        ...item,
        status: nextStatus,
        isActive: nextStatus === 'published',
        show: nextStatus === 'published',
        updatedAt: new Date().toISOString(),
        updatedAtMs: Date.now(),
      });
      if (res.success) {
        if (draft.id === item.id) {
          setDraft((prev) => ({ ...prev, status: nextStatus, isActive: nextStatus === 'published', show: nextStatus === 'published' }));
        }
        notify('ok', `"${item.name}" is now ${nextStatus === 'published' ? 'LIVE (Published)' : 'PAUSED (Hidden)'}.`);
      } else {
        notify('err', res.message);
      }
    } finally {
      setTogglingGiftId(null);
    }
  };

  const handleMigrateUnifiedSchema = async () => {
    setIsMigratingSchema(true);
    try {
      const res = await migrateUnifiedGiftCatalog();
      notify(res.success ? 'ok' : 'err', res.message);
    } finally {
      setIsMigratingSchema(false);
    }
  };

  const handleDeleteGift = async (giftId: string) => {
    if (giftId === ALPHA_MATE_TEST_GIFT_ID) {
      notify('warn', 'The default 10,000-coin Test Gift can be disabled/unpublished, or edited anytime.');
      return;
    }
    const res = await deleteAdvancedGift(giftId);
    if (res.success) {
      notify('ok', res.message);
      if (draft.id === giftId) {
        setDraft(DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG);
      }
    } else {
      notify('err', res.message);
    }
  };

  const filteredCatalogItems = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const list = unifiedCatalogItems.filter((item) => {
      const hasAnim =
        item.giftKind === 'animated' &&
        Boolean(item.optimizedFileUrl || item.animationUrl || item.originalFileUrl);
      if (catalogFilter === 'animated' && !hasAnim) return false;
      if (catalogFilter === 'static' && hasAnim) return false;
      if (catalogFilter === 'published' && item.status !== 'published') return false;
      if (catalogFilter === 'inactive' && item.status === 'published') return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q) ||
        String(item.coins).includes(q)
      );
    });
    return [...list].sort((a, b) => {
      if (catalogSort === 'coins_asc') return a.coins - b.coins;
      if (catalogSort === 'coins_desc') return b.coins - a.coins;
      if (catalogSort === 'newest') return (b.createdAtMs || 0) - (a.createdAtMs || 0);
      if (a.isTestGift && !b.isTestGift) return -1;
      if (!a.isTestGift && b.isTestGift) return 1;
      const pDiff = (a.priority || 50) - (b.priority || 50);
      if (pDiff !== 0) return pDiff;
      return (b.createdAtMs || 0) - (a.createdAtMs || 0);
    });
  }, [unifiedCatalogItems, catalogFilter, catalogSearch, catalogSort]);

  // Build live preview event for the 7-Layer Live Room Stage Simulator
  const previewConfig: AdvancedGiftConfig = useMemo(() => {
    if (draft.giftKind === 'static') {
      return {
        ...draft,
        animationUrl: '',
        optimizedFileUrl: undefined,
      };
    }
    const activeUrl =
      previewSource === 'original'
        ? draft.originalFileUrl || draft.animationUrl
        : draft.optimizedFileUrl || draft.animationUrl || draft.originalFileUrl;
    return {
      ...draft,
      animationUrl: activeUrl,
      optimizedFileUrl: previewSource === 'original' ? undefined : draft.optimizedFileUrl,
    };
  }, [draft, previewSource]);

  const previewEvent = useMemo(() => {
    if (previewConfig.giftKind === 'static' || !previewConfig.animationUrl) return null;
    return {
      id: `admin_preview_${previewConfig.id}_${previewNonce}`,
      gift: advancedGiftConfigToGift(previewConfig),
      senderName: 'Super Admin',
      senderVipTier: 5,
      recipientName: 'Host Arena',
      comboCount: 1,
      quantity: 1,
      timestamp: Date.now(),
    };
  }, [previewConfig, previewNonce]);

  const transparencyBadge = () => {
    switch (draft.transparencyStatus) {
      case 'alpha_verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase">
            <CheckCircle2 className="w-3 h-3" />
            Alpha Channel Verified
          </span>
        );
      case 'alpha_limited_gif':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-black uppercase">
            <AlertTriangle className="w-3 h-3" />
            GIF 1-Bit Transparency (Limited)
          </span>
        );
      case 'opaque_no_alpha':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-400/45 text-rose-200 text-[10px] font-black uppercase">
            <AlertTriangle className="w-3 h-3" />
            Opaque — No Alpha Channel
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-700/40 border border-zinc-500/40 text-zinc-300 text-[10px] font-bold uppercase">
            Uninspected
          </span>
        );
    }
  };

  return (
    <section className="p-6 rounded-3xl bg-[#120A24] border border-[#A855F7]/30 shadow-2xl space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7928CA] via-[#EC4899] to-amber-400 flex items-center justify-center shadow-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base sm:text-lg font-black text-white">
              Unified Gift Catalog & Animation Manager
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-[10px] font-mono font-bold uppercase">
              /gifts Schema v2 • Static & Animated
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Single unified Firestore catalog for all static sticker gifts and animated WebM/SVGA/MP4 gifts — indexed by status, kind, category, and priority.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const testGift =
                unifiedCatalogItems.find((g) => g.id === ALPHA_MATE_TEST_GIFT_ID) ||
                DEFAULT_ALPHA_MATE_TEST_GIFT_CONFIG;
              handleSelectExisting(testGift);
            }}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>10,000 Coin Test Gift</span>
          </button>
          <button
            type="button"
            onClick={handleLoadSvgSpecimen}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>SVG Test</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(createBlankGiftConfig('static'));
              setPreviewNonce((n) => n + 1);
            }}
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Static Gift</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(createBlankGiftConfig('animated'));
              setPreviewNonce((n) => n + 1);
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-black inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Animated Gift</span>
          </button>
        </div>
      </div>

      {/* Unified Schema Sync & Indexing Banner (shown whenever legacy /advancedGifts or pre-v2 docs exist) */}
      {(catalogSyncStats.legacyCount > 0 || catalogSyncStats.unindexedCount > 0) && (
        <div className="p-3.5 rounded-2xl bg-amber-500/12 border border-amber-400/35 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <Database className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-100">
              <span className="font-bold">Unified Schema Indexing Available:</span>{' '}
              {catalogSyncStats.legacyCount > 0 && (
                <span>{catalogSyncStats.legacyCount} legacy <code className="font-mono">/advancedGifts</code> record{catalogSyncStats.legacyCount === 1 ? '' : 's'} </span>
              )}
              {catalogSyncStats.legacyCount > 0 && catalogSyncStats.unindexedCount > 0 && <span>• </span>}
              {catalogSyncStats.unindexedCount > 0 && (
                <span>{catalogSyncStats.unindexedCount} pre-v2 gift{catalogSyncStats.unindexedCount === 1 ? '' : 's'} missing unified index fields (<code className="font-mono">giftKind</code>, <code className="font-mono">priority</code>, <code className="font-mono">isActive</code>).</span>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={!isOfficialAdmin || isMigratingSchema}
            onClick={handleMigrateUnifiedSchema}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-xs font-black inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isMigratingSchema ? 'animate-spin' : ''}`} />
            <span>{isMigratingSchema ? 'Unifying & Indexing...' : 'Unify & Index All Gifts'}</span>
          </button>
        </div>
      )}

      {/* Status Notice */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            statusMessage.type === 'ok'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
              : statusMessage.type === 'warn'
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
          }`}
        >
          {statusMessage.type === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {!isOfficialAdmin && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>
            Previewing in read-only mode. Sign in with the Official Admin account (<code className="font-mono">alphamateapp@gmail.com</code>) to upload files, run FFmpeg conversions, and publish changes to Firestore.
          </span>
        </div>
      )}

      {/* Main Two-Column Studio */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT COLUMN (7 cols): Upload + Analysis + Conversion + Full Config Form */}
        <div className="xl:col-span-7 space-y-5">
          {/* 1. Unified Gift Type + Upload & Conversion Panel */}
          <div className="p-4 rounded-2xl bg-[#180E30] border border-white/10 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-[#EC4899]" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200">
                  1. Gift Type, Thumbnail & Animation Media
                </h3>
              </div>
              {transparencyBadge()}
            </div>

            {/* Unified Gift Kind Selector: Static Sticker vs Animated Video/SVGA */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/40 border border-white/10">
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    giftKind: 'animated',
                  }))
                }
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  (draft.giftKind || (draft.animationUrl ? 'animated' : 'static')) === 'animated'
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Animated Gift (WebM / SVGA / MP4)
              </button>
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    giftKind: 'static',
                    edgeFeather: false,
                  }))
                }
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  draft.giftKind === 'static'
                    ? 'bg-amber-500/25 border border-amber-400/50 text-amber-200 shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Static Sticker Gift (PNG / Icon)
              </button>
            </div>

            {draft.giftKind === 'static' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/25 flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] text-amber-100">
                  <span className="font-bold">Static Gift Mode:</span> Displays your PNG icon in the Gift Box with particle/banner effects (no video file required).
                </div>
                <select
                  value={draft.animationType || 'sparkle'}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      animationType: e.target.value as GiftAnimationType,
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/15 text-xs text-white font-semibold"
                >
                  <option value="sparkle">Effect: Sparkle</option>
                  <option value="heart">Effect: Heart Burst</option>
                  <option value="crown">Effect: Royal Crown</option>
                  <option value="ring">Effect: Diamond Ring</option>
                  <option value="car">Effect: Supercar</option>
                  <option value="yacht">Effect: Luxury Yacht</option>
                  <option value="rocket">Effect: Rocket</option>
                  <option value="dragon">Effect: Dragon</option>
                </select>
              </div>
            )}

            {/* File Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-black/30 border border-dashed border-[#A855F7]/40 flex flex-col gap-2">
                <div className="text-[11px] font-bold text-white flex items-center justify-between">
                  <span>Animation Asset</span>
                  <span className="text-[10px] font-mono text-purple-300 uppercase">
                    {draft.format}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Supports WebM (VP9 / VP9 Alpha), SVGA (100% transparent), MOV, MP4, animated SVG, and GIF.
                </p>
                <input
                  ref={animFileInputRef}
                  type="file"
                  accept=".svga,.webm,.mov,.mp4,.svg,.gif,video/webm,video/quicktime,video/mp4,image/svg+xml,image/gif"
                  onChange={handleUploadAnimation}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingAnim}
                  onClick={() => animFileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingAnim ? 'Uploading & Inspecting...' : 'Upload Animation File'}</span>
                </button>
              </div>

              <div className="p-3 rounded-xl bg-black/30 border border-dashed border-white/20 flex flex-col gap-2">
                <div className="text-[11px] font-bold text-white flex items-center justify-between">
                  <span>Gift Thumbnail / Preview</span>
                  <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <p className="text-[10px] text-zinc-400">
                  Optional icon shown in Gift Picker Drawer & fallback if device lacks codec.
                </p>
                <input
                  ref={thumbFileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.gif,.svg,image/*"
                  onChange={handleUploadThumbnail}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isUploadingThumb}
                  onClick={() => thumbFileInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingThumb ? 'Uploading Thumbnail...' : 'Upload Thumbnail Image'}</span>
                </button>
              </div>
            </div>

            {/* File URLs + Real FFprobe / FFmpeg Controls */}
            <div className="p-3 rounded-xl bg-black/35 border border-white/10 space-y-2.5 text-[11px]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-[10px]">
                <div className="truncate text-zinc-300">
                  <span className="text-zinc-500">Original: </span>
                  {draft.originalFileUrl || 'Not uploaded'}
                </div>
                <div className="truncate text-emerald-300">
                  <span className="text-zinc-500">Optimized: </span>
                  {draft.optimizedFileUrl || 'Using original'}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isProbing || !draft.originalFileUrl}
                  onClick={handleRunLiveProbe}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`} />
                  <span>{isProbing ? 'Running FFprobe...' : 'Run Live FFprobe Analysis'}</span>
                </button>

                <button
                  type="button"
                  disabled={
                    isConverting ||
                    !draft.originalFileUrl ||
                    draft.format === 'svga' ||
                    draft.format === 'svg' ||
                    draft.format === 'gif'
                  }
                  onClick={handleConvertToWebm}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
                >
                  <Cpu className={`w-3.5 h-3.5 ${isConverting ? 'animate-spin' : ''}`} />
                  <span>
                    {isConverting ? 'Converting via FFmpeg...' : 'Convert to Optimized WebM (VP9)'}
                  </span>
                </button>

                <span className="ml-auto px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-300 uppercase">
                  Conversion: {draft.conversionStatus}
                </span>
              </div>

              {draft.conversionMessage && (
                <p className="text-[10.5px] text-purple-200">{draft.conversionMessage}</p>
              )}
            </div>

            {/* Real Technical Analysis Readout */}
            {draft.analysis && (
              <div className="p-3 rounded-xl bg-[#0D071B] border border-white/10 space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] font-mono">
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-zinc-500 text-[9px] uppercase">Codec</div>
                    <div className="text-white font-bold truncate">{draft.analysis.codec || '—'}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-zinc-500 text-[9px] uppercase">Pixel Format</div>
                    <div
                      className={`font-bold truncate ${
                        draft.analysis.hasAlpha ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {draft.analysis.pixFmt || '—'}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-zinc-500 text-[9px] uppercase">Dimensions / FPS</div>
                    <div className="text-white font-bold">
                      {draft.analysis.width || 0}×{draft.analysis.height || 0} @ {draft.analysis.fps || 0}fps
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-white/5">
                    <div className="text-zinc-500 text-[9px] uppercase">Duration / Size</div>
                    <div className="text-white font-bold">
                      {draft.analysis.durationSec || 0}s • {formatBytes(draft.analysis.fileSizeBytes)}
                    </div>
                  </div>
                </div>

                {draft.analysis.warnings && draft.analysis.warnings.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {draft.analysis.warnings.map((w, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[10.5px] text-amber-200 flex items-start gap-1.5"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {draft.analysis.svgFeatures && (
                  <div className="text-[10.5px] text-emerald-200 flex flex-wrap gap-2 pt-1">
                    <span>SMIL: {draft.analysis.svgFeatures.hasSmil ? 'Yes' : 'No'}</span>
                    <span>•</span>
                    <span>CSS Keyframes: {draft.analysis.svgFeatures.hasCssKeyframes ? 'Yes' : 'No'}</span>
                    {draft.analysis.svgFeatures.unsupportedFeatures.length > 0 && (
                      <span className="text-amber-300">
                        • Sanitized: {draft.analysis.svgFeatures.unsupportedFeatures.join('; ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. Display Modes & Playback Configuration */}
          <div className="p-4 rounded-2xl bg-[#180E30] border border-white/10 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200">
                2. Gift Metadata & 3 Display Modes
              </h3>
            </div>

            {/* Basic Metadata Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Gift Name
                </label>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-[#EC4899]"
                  placeholder="Alpha Mate Dragon"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Coin Price (Coins)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10000000}
                  value={draft.coins}
                  onChange={(e) => setDraft({ ...draft, coins: Math.max(1, Number(e.target.value) || 1) })}
                  className="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-[#EC4899]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-[#EC4899]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-[#EC4899]"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Gift ID
                </label>
                <input
                  type="text"
                  value={draft.id}
                  onChange={(e) =>
                    setDraft({ ...draft, id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '_') })
                  }
                  className="w-full h-9 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#EC4899]"
                />
              </div>
            </div>

            {/* 3 Configurable Gift Display Modes */}
            <div>
              <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-2">
                Display Mode (Select & Preview Live on Stage)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(
                  [
                    {
                      mode: 'transparent' as GiftDisplayMode,
                      title: 'Mode 1: Transparent',
                      desc: 'Pure alpha cutout, zero background box; host, seats & controls stay visible.',
                    },
                    {
                      mode: 'semi_transparent' as GiftDisplayMode,
                      title: 'Mode 2: Semi-Transparent',
                      desc: '10%–100% animation opacity, fade-in/out & particles; UI stays crisp.',
                    },
                    {
                      mode: 'overlay_background' as GiftDisplayMode,
                      title: 'Mode 3: Overlay / Background',
                      desc: 'Cinematic effect BEHIND host & seats; comments & controls stay on top.',
                    },
                  ] as const
                ).map((item) => {
                  const active = draft.displayMode === item.mode;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={() => {
                        setDraft({ ...draft, displayMode: item.mode });
                        setPreviewNonce((n) => n + 1);
                      }}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        active
                          ? 'bg-gradient-to-br from-[#7928CA]/40 to-[#EC4899]/30 border-[#EC4899] shadow-lg'
                          : 'bg-black/30 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-black text-white">{item.title}</div>
                      <div className="text-[10px] text-zinc-300 mt-1 leading-snug">{item.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Playback & Layout Sliders */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 flex justify-between mb-1">
                  <span>Opacity</span>
                  <span className="text-amber-300 font-mono">{draft.opacity}%</span>
                </label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={draft.opacity}
                  onChange={(e) => setDraft({ ...draft, opacity: Number(e.target.value) })}
                  className="w-full accent-[#EC4899]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 flex justify-between mb-1">
                  <span>Duration</span>
                  <span className="text-amber-300 font-mono">{(draft.durationMs / 1000).toFixed(1)}s</span>
                </label>
                <input
                  type="range"
                  min={1500}
                  max={30000}
                  step={500}
                  value={Math.min(30000, draft.durationMs)}
                  onChange={(e) => setDraft({ ...draft, durationMs: Number(e.target.value) })}
                  className="w-full accent-[#EC4899]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 flex justify-between mb-1">
                  <span>Scale</span>
                  <span className="text-amber-300 font-mono">{draft.scale.toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min={0.4}
                  max={1.5}
                  step={0.05}
                  value={draft.scale}
                  onChange={(e) => setDraft({ ...draft, scale: Number(e.target.value) })}
                  className="w-full accent-[#EC4899]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 flex justify-between mb-1">
                  <span>Speed</span>
                  <span className="text-amber-300 font-mono">{draft.playbackSpeed.toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={draft.playbackSpeed}
                  onChange={(e) => setDraft({ ...draft, playbackSpeed: Number(e.target.value) })}
                  className="w-full accent-[#EC4899]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Position
                </label>
                <select
                  value={draft.position}
                  onChange={(e) => setDraft({ ...draft, position: e.target.value as GiftPlaybackPosition })}
                  className="w-full h-9 px-2.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white"
                >
                  <option value="center">Center</option>
                  <option value="top">Top</option>
                  <option value="bottom">Bottom</option>
                  <option value="fullscreen">Fullscreen</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Format
                </label>
                <select
                  value={draft.format}
                  onChange={(e) => setDraft({ ...draft, format: e.target.value as AdvancedGiftFormat })}
                  className="w-full h-9 px-2.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white uppercase"
                >
                  <option value="webm">WebM (VP9)</option>
                  <option value="svga">SVGA (Transparent)</option>
                  <option value="mov">MOV (QuickTime)</option>
                  <option value="mp4">MP4 (H.264/HEVC)</option>
                  <option value="svg">SVG (Animated)</option>
                  <option value="gif">GIF (Animated)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Priority (1–100)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={draft.priority}
                  onChange={(e) =>
                    setDraft({ ...draft, priority: Math.min(100, Math.max(1, Number(e.target.value) || 50)) })
                  }
                  className="w-full h-9 px-3 rounded-xl bg-black/50 border border-white/15 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                  Publish Status
                </label>
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as AdvancedGiftStatus })}
                  className="w-full h-9 px-2.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white capitalize"
                >
                  <option value="draft">Draft</option>
                  <option value="processing">Processing</option>
                  <option value="published">Published</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>

            {/* Seamless Screen Merge & Blend Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-black/30 border border-purple-500/25">
              <div>
                <label className="text-[10px] font-bold text-purple-200 uppercase block mb-1">
                  Video Edge Blend Mode
                </label>
                <select
                  value={draft.blendMode || 'normal'}
                  onChange={(e) => {
                    setDraft({ ...draft, blendMode: e.target.value as GiftEdgeBlendMode });
                    setPreviewNonce((n) => n + 1);
                  }}
                  className="w-full h-9 px-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white"
                >
                  <option value="normal">Normal (Rich Full Colors)</option>
                  <option value="screen">Screen (Auto-Remove Black BG)</option>
                  <option value="lighten">Lighten (Soft Glow Merge)</option>
                </select>
              </div>
              <div className="flex items-center">
                <label className="inline-flex items-start gap-2 cursor-pointer text-xs text-zinc-200 pt-2 sm:pt-4">
                  <input
                    type="checkbox"
                    checked={
                      draft.edgeFeather !== undefined
                        ? draft.edgeFeather
                        : draft.format !== 'svga' &&
                          draft.format !== 'svg' &&
                          draft.transparencyStatus !== 'alpha_verified'
                    }
                    onChange={(e) => {
                      setDraft({ ...draft, edgeFeather: e.target.checked });
                      setPreviewNonce((n) => n + 1);
                    }}
                    className="accent-[#EC4899] mt-0.5"
                  />
                  <span>
                    <span className="font-bold text-white block leading-tight">
                      Soft Blurred Edge Merge
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Dissolves all 4 corners & top/bottom/side edges into screen
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Boolean Toggles */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-200 pt-1">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.loop}
                  onChange={(e) => setDraft({ ...draft, loop: e.target.checked })}
                  className="accent-[#EC4899]"
                />
                <span>Loop Animation</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.enableParticles !== false}
                  onChange={(e) => setDraft({ ...draft, enableParticles: e.target.checked })}
                  className="accent-[#EC4899]"
                />
                <span>Mode 2/3 Particles</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.enableSound !== false}
                  onChange={(e) => setDraft({ ...draft, enableSound: e.target.checked })}
                  className="accent-[#EC4899]"
                />
                <span>Play Media Audio</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(draft.isTestGift)}
                  onChange={(e) => setDraft({ ...draft, isTestGift: e.target.checked })}
                  className="accent-cyan-400"
                />
                <span className="text-cyan-300 font-bold">Mark as [TEST GIFT]</span>
              </label>
            </div>

            {/* Publish / Save / Unpublish / Delete Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveGift('published')}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-black text-xs font-black inline-flex items-center gap-1.5 shadow-lg cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Publish to Live & Party Rooms'}</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveGift('draft')}
                className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleSaveGift('disabled')}
                className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/35 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Unpublish / Disable</span>
              </button>
              {draft.id !== ALPHA_MATE_TEST_GIFT_ID && (
                <button
                  type="button"
                  onClick={() => handleDeleteGift(draft.id)}
                  className="ml-auto px-3 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (5 cols): 7-Layer Live Room Stage Simulator + Device Support + Catalog */}
        <div className="xl:col-span-5 space-y-4">
          {/* Interactive 7-Layer Live Room Simulator */}
          <div className="p-4 rounded-2xl bg-[#180E30] border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200">
                  7-Layer Live Room Preview
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                {draft.optimizedFileUrl && draft.optimizedFileUrl !== draft.originalFileUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewSource((s) => (s === 'optimized' ? 'original' : 'optimized'));
                      setPreviewNonce((n) => n + 1);
                    }}
                    className="px-2 py-1 rounded-lg bg-white/10 text-[10px] font-mono text-purple-200 cursor-pointer"
                  >
                    Src: {previewSource}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewMuted((m) => !m)}
                  className="p-1.5 rounded-lg bg-white/10 text-zinc-200 hover:text-white cursor-pointer"
                  title={previewMuted ? 'Unmute Preview' : 'Mute Preview'}
                >
                  {previewMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLoop((l) => !l)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                    previewLoop ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-zinc-300'
                  }`}
                >
                  {previewLoop ? 'Loop ON' : 'Once'}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewNonce((n) => n + 1)}
                  className="px-2 py-1 rounded-lg bg-[#7928CA] text-white text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Replay</span>
                </button>
                <button
                  type="button"
                  disabled={!previewEvent}
                  onClick={() => {
                    setPreviewNonce((n) => n + 1);
                    setIsFullScreenTestOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#EC4899] to-amber-500 text-white text-[10px] font-black inline-flex items-center gap-1 cursor-pointer disabled:opacity-40"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Full-Screen Test</span>
                </button>
              </div>
            </div>

            {/* Vertical Phone Live-Room Stage Demonstrating All 7 Layers */}
            <div className="relative mx-auto w-full max-w-[290px] aspect-[9/16] rounded-3xl overflow-hidden border-2 border-[#A855F7]/40 bg-gradient-to-b from-[#170933] via-[#0F0622] to-[#080312] shadow-2xl">
              {/* LAYER 1 (z-0): Live Room Background */}
              <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_28%,rgba(168,85,247,0.35),rgba(10,4,22,0.95)_70%)]" />

              {/* LAYER 2 (z-[5]): Background Gift Animation Layer (Mode 3 plays here BEHIND Host & Seats) */}
              <UniversalGiftPlayer
                event={previewEvent}
                layer="background"
                forceMuted={previewMuted}
                previewLoopOverride={previewLoop}
              />

              {/* LAYER 4 (z-10): Host & Guest Seats Stage */}
              <div className="relative z-10 pt-12 px-3 flex flex-col items-center gap-2.5">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-400 to-[#EC4899] p-0.5 shadow-lg">
                    <div className="w-full h-full rounded-full bg-[#1C1036] flex items-center justify-center text-sm font-black text-amber-300">
                      HOST
                    </div>
                  </div>
                  <span className="mt-1 px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-white">
                    Alpha Host 👑
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 w-full">
                  {[1, 2, 3, 4].map((seat) => (
                    <div
                      key={seat}
                      className="flex flex-col items-center p-1.5 rounded-xl bg-black/45 border border-white/15 backdrop-blur-sm"
                    >
                      <div className="w-7 h-7 rounded-full bg-purple-900/70 border border-purple-400/50 flex items-center justify-center text-[9px] font-bold text-purple-200">
                        S{seat}
                      </div>
                      <span className="text-[8px] text-zinc-300 mt-0.5">Seat {seat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* LAYER 5 (z-[35]): Foreground Gift Animation Layer (Mode 1 & Mode 2 play here) */}
              <UniversalGiftPlayer
                event={previewEvent}
                layer="foreground"
                forceMuted={previewMuted}
                previewLoopOverride={previewLoop}
              />

              {/* LAYER 7 TOP (z-[45]): Top Live Room Header */}
              <div className="absolute top-2 left-2 right-2 z-[45] flex items-center justify-between">
                <span className="px-2 py-0.5 rounded-full bg-black/70 border border-white/15 text-[9px] font-black text-white">
                  🔴 LIVE • 7-Layer Test
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/70 border border-amber-400/40 text-[8.5px] font-mono text-amber-300 uppercase">
                  {draft.displayMode.replace('_', ' ')}
                </span>
              </div>

              {/* LAYERS 6 & 7 BOTTOM (z-40 / z-50): Comments & Interactive Controls NEVER Blocked */}
              <div className="absolute bottom-2 left-2 right-2 z-40 space-y-1.5">
                <div className="space-y-1 pointer-events-none">
                  <div className="inline-block px-2 py-0.5 rounded-lg bg-black/65 border border-white/10 text-[9px] text-zinc-200">
                    <span className="text-purple-300 font-bold">Sara:</span> Comments stay 100% readable!
                  </div>
                  <div className="inline-block px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-[9px] text-amber-200 font-bold">
                    🎁 {draft.name} ({draft.coins.toLocaleString()} 💰)
                  </div>
                </div>
                <div className="relative z-50 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStageControlClicks((c) => c + 1)}
                    className="flex-1 py-1.5 px-2 rounded-full bg-black/75 hover:bg-black/90 border border-emerald-400/50 text-[9.5px] font-bold text-emerald-300 cursor-pointer"
                  >
                    Tap Control Test ({stageControlClicks} clicks OK)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewNonce((n) => n + 1)}
                    className="px-2.5 py-1.5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white text-[9.5px] font-black cursor-pointer inline-flex items-center gap-1"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>Gift</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Runtime Browser / Device Format Capability Badges */}
            <div className="pt-2 border-t border-white/10">
              <div className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5">
                Current Engine Format Support Check
              </div>
              <div className="flex flex-wrap gap-1.5 text-[9.5px] font-mono">
                {[
                  { label: 'WebM VP9', ok: capabilities.webmVp9 },
                  { label: 'SVGA Canvas', ok: capabilities.svgaAnimation },
                  { label: 'MP4 H.264', ok: capabilities.mp4H264 },
                  { label: 'MOV Direct', ok: capabilities.movQuickTime },
                  { label: 'SVG Anim', ok: capabilities.svgAnimation },
                  { label: 'GIF Anim', ok: capabilities.gifAnimation },
                ].map((c) => (
                  <span
                    key={c.label}
                    className={`px-2 py-0.5 rounded-md border ${
                      c.ok
                        ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                        : 'bg-amber-500/15 border-amber-500/35 text-amber-200'
                    }`}
                  >
                    {c.label}: {c.ok ? 'YES' : 'CONVERT'}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Single Canonical Unified Gift Catalog (/gifts — Static & Animated) */}
          <div className="p-4 rounded-2xl bg-[#180E30] border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-zinc-200">
                  Unified Gift Catalog ({catalogSyncStats.total})
                </h3>
                <p className="text-[10px] text-zinc-400">
                  All static & animated gifts from canonical <code className="font-mono text-purple-300">/gifts</code>. Select any item to edit, publish, pause, or delete.
                </p>
              </div>
              <span className="text-[10px] text-emerald-300 font-mono">
                {catalogSyncStats.animatedCount} Animated • {catalogSyncStats.staticCount} Static • {catalogSyncStats.publishedCount} Live
              </span>
            </div>

            {/* Search & Index-Aligned Sort Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder="Search name, category, ID, or coins..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[11px] text-white placeholder-zinc-500 focus:outline-none focus:border-[#A855F7]"
                />
              </div>
              <select
                value={catalogSort}
                onChange={(e) => setCatalogSort(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 text-[10.5px] font-bold text-zinc-200 cursor-pointer"
              >
                <option value="priority">Sort: Priority (Indexed)</option>
                <option value="coins_asc">Sort: Coins Low → High</option>
                <option value="coins_desc">Sort: Coins High → Low</option>
                <option value="newest">Sort: Newest First</option>
              </select>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {([
                { id: 'all', label: `All (${catalogSyncStats.total})` },
                { id: 'animated', label: `Animated (${catalogSyncStats.animatedCount})` },
                { id: 'static', label: `Static (${catalogSyncStats.staticCount})` },
                { id: 'published', label: `Published (${catalogSyncStats.publishedCount})` },
                { id: 'inactive', label: `Draft/Paused (${catalogSyncStats.draftOrPausedCount})` },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCatalogFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    catalogFilter === tab.id
                      ? 'bg-[#7928CA] text-white shadow'
                      : 'bg-black/35 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredCatalogItems.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-black/25 border border-white/5 text-xs text-zinc-400">
                  No gifts match your current search or filter.
                </div>
              ) : (
                filteredCatalogItems.map((item) => {
                  const isSelected = draft.id === item.id;
                  const hasAnim =
                    item.giftKind === 'animated' &&
                    Boolean(item.optimizedFileUrl || item.animationUrl || item.originalFileUrl);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectExisting(item)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-[#7928CA]/25 border-[#EC4899]'
                          : 'bg-black/30 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.name}
                            className="w-9 h-9 rounded-lg object-contain bg-black/40 p-1 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-black/40 flex items-center justify-center text-lg shrink-0">
                            {item.icon || '🎁'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white truncate max-w-[135px]">
                              {item.name}
                            </span>
                            {item.isTestGift && (
                              <span className="px-1.5 py-0.2 rounded bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-[8.5px] font-black uppercase">
                                TEST
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.2 rounded border text-[8px] font-black uppercase ${
                                hasAnim
                                  ? 'bg-purple-500/20 border-purple-400/35 text-purple-200'
                                  : 'bg-amber-500/20 border-amber-400/35 text-amber-200'
                              }`}
                            >
                              {hasAnim ? item.format.toUpperCase() : 'STATIC'}
                            </span>
                            {item.needsSchemaSync && item.sourceCollection !== 'default' && (
                              <span className="px-1.5 py-0.2 rounded bg-orange-500/20 border border-orange-400/40 text-orange-200 text-[8px] font-black uppercase">
                                {item.sourceCollection === 'advancedGifts' ? 'LEGACY' : 'UNINDEXED'}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5 flex-wrap">
                            <span className="text-amber-300 font-bold">{item.coins.toLocaleString()} 💰</span>
                            <span>•</span>
                            <span>P{item.priority}</span>
                            <span>•</span>
                            <span className="truncate max-w-[90px]">{item.category}</span>
                            {hasAnim && (
                              <>
                                <span>•</span>
                                <span>{(item.durationMs / 1000).toFixed(1)}s</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={!isOfficialAdmin || togglingGiftId === item.id}
                          title={item.status === 'published' ? 'Pause / hide from users' : 'Publish live to users'}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleQuickToggleStatus(item);
                          }}
                          className={`px-2 py-1 rounded-full text-[9px] font-black uppercase inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 ${
                            item.status === 'published'
                              ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              : item.status === 'disabled'
                              ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                          }`}
                        >
                          {item.status === 'published' ? (
                            <Eye className="w-2.5 h-2.5" />
                          ) : (
                            <EyeOff className="w-2.5 h-2.5" />
                          )}
                          <span>{item.status}</span>
                        </button>
                        {item.id !== ALPHA_MATE_TEST_GIFT_ID && (
                          <button
                            type="button"
                            title="Delete gift from unified catalog"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDeleteGift(item.id);
                            }}
                            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Built-in Asset Quick Reference Footer */}
      <div className="text-[10.5px] text-zinc-400 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 font-mono">
        <span>Active Test WebM Asset: {UPLOADED_TEST_WEBM_URL}</span>
        <span>All animation layers enforce pointer-events: none • Live controls remain interactive</span>
      </div>

      {/* Full-Screen Live Room Gift Verification Stage */}
      {isFullScreenTestOpen && previewEvent && (
        <div className="fixed inset-0 z-[120] bg-[#090414] flex flex-col overflow-hidden">
          {/* Realistic Party Room Background */}
          <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_50%_20%,rgba(139,92,246,0.42),rgba(18,8,38,0.96)_62%,#06020E_100%)]" />

          {/* LAYER 2: Background Gift Mode */}
          <UniversalGiftPlayer
            event={previewEvent}
            layer="background"
            forceMuted={previewMuted}
            previewLoopOverride={previewLoop}
          />

          {/* LAYER 4: Simulated Host, VIP 1 & Party Seats */}
          <div className="relative z-10 flex-1 flex flex-col items-center pt-20 px-4 pointer-events-none">
            <div className="flex items-center justify-center gap-8 mb-6">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-amber-400 via-yellow-300 to-[#EC4899] shadow-[0_0_24px_rgba(251,191,36,0.45)]">
                  <div className="w-full h-full rounded-full bg-[#1C1036] flex items-center justify-center text-sm font-black text-amber-300">
                    HOST
                  </div>
                </div>
                <span className="mt-1.5 text-xs font-black text-amber-300">Alpha Host</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full p-1 bg-gradient-to-tr from-purple-400 via-[#EC4899] to-amber-300 shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                  <div className="w-full h-full rounded-full bg-[#1C1036] flex items-center justify-center text-xs font-black text-purple-200">
                    VIP 1
                  </div>
                </div>
                <span className="mt-1.5 text-[11px] font-bold text-purple-200">VIP Guest</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((seat) => (
                <div
                  key={seat}
                  className="flex flex-col items-center p-2 rounded-2xl bg-black/35 border border-white/10 backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-950/80 border border-amber-400/50 flex items-center justify-center text-xs font-bold text-amber-200">
                    {seat}
                  </div>
                  <span className="text-[10px] text-zinc-300 mt-1">Seat {seat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* LAYER 5: Foreground Gift Mode (Full-Screen Edge-to-Edge Seamless Render) */}
          <UniversalGiftPlayer
            event={previewEvent}
            layer="foreground"
            forceMuted={previewMuted}
            previewLoopOverride={previewLoop}
          />

          {/* Top Interactive Verification Controls (Always Above Animation) */}
          <div className="absolute top-4 inset-x-4 z-50 flex flex-wrap items-center justify-between gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-black/75 border border-white/15 backdrop-blur-md text-xs text-white font-bold flex items-center gap-2">
              <span>{draft.name}</span>
              <span className="text-zinc-400">·</span>
              <span className="text-amber-300 font-mono uppercase">{draft.format}</span>
              <span className="text-zinc-400">·</span>
              <span className="text-cyan-300">
                {draft.edgeFeather !== false && draft.format !== 'svga' && draft.format !== 'svg'
                  ? 'Soft Edge Merge ON'
                  : 'Native Transparent'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewMuted((m) => !m)}
                className="min-h-[40px] px-3 rounded-xl bg-black/75 border border-white/20 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {previewMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-amber-300" />}
                <span>{previewMuted ? 'Muted' : 'Sound On'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewNonce((n) => n + 1)}
                className="min-h-[40px] px-3 rounded-xl bg-[#7928CA] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Replay</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullScreenTestOpen(false)}
                className="min-h-[40px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black inline-flex items-center gap-1.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Close Test</span>
              </button>
            </div>
          </div>

          {/* Bottom Simulated Live Chat Bar */}
          <div className="relative z-40 p-4 max-w-md w-full mx-auto space-y-2 pointer-events-none">
            <div className="inline-block px-3 py-1 rounded-xl bg-black/60 border border-white/10 text-xs text-zinc-200 backdrop-blur-sm">
              <span className="text-amber-300 font-bold">Super Admin</span> sent{' '}
              <span className="text-pink-300 font-bold">{draft.name}</span> ({draft.coins.toLocaleString()} coins)
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
