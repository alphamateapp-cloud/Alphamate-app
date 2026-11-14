import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, RefreshCw, WifiOff } from 'lucide-react';
import { useApp, RefreshScope } from '../../context/AppContext';

export interface RefreshResult {
  ok: boolean;
  message?: string;
}

interface PullToRefreshProps {
  onRefresh: () => Promise<RefreshResult | void> | RefreshResult | void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  label?: string;
  /** When true, attaches gesture handling on overlay container without wrapping scroll height (great for Live / Party full-screen stages). */
  overlayMode?: boolean;
}

const PULL_THRESHOLD = 64;
const MAX_PULL_PX = 96;

function isDescendantOfBlocker(target: EventTarget | null, root: HTMLElement): boolean {
  let node = target as HTMLElement | null;
  while (node && node !== root) {
    if (
      node.dataset?.noPtr === 'true' ||
      node.getAttribute('role') === 'dialog' ||
      node.tagName === 'INPUT' ||
      node.tagName === 'TEXTAREA' ||
      node.tagName === 'SELECT'
    ) {
      return true;
    }

    const style = window.getComputedStyle(node);
    const overflowY = style.overflowY;

    // Never hijack pull when an inner vertical scrollable list is not at scrollTop <= 2
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 2) {
      if (node.scrollTop > 2) {
        return true;
      }
    }

    node = node.parentElement;
  }
  return false;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  scrollContainerRef,
  children,
  className = '',
  disabled = false,
  label = 'Refreshing...',
  overlayMode = false,
}) => {
  const internalRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState<'idle' | 'pulling' | 'ready' | 'refreshing' | 'done' | 'error'>('idle');
  const [feedbackText, setFeedbackText] = useState<string>('');

  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const isTrackingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const setPullSafe = (px: number) => {
    pullDistanceRef.current = px;
    setPullDistance(px);
  };

  const triggerRefresh = useCallback(async () => {
    if (isRefreshingRef.current || disabled) return;
    isRefreshingRef.current = true;
    setStatus('refreshing');
    setPullSafe(52);
    const startedAt = Date.now();

    let result: RefreshResult = { ok: true, message: 'Refreshed' };
    try {
      const res = await Promise.race([
        Promise.resolve(onRefreshRef.current()),
        new Promise<RefreshResult>((resolve) =>
          window.setTimeout(() => resolve({ ok: true, message: 'Synced' }), 10000)
        ),
      ]);
      if (res && typeof res === 'object' && typeof res.ok === 'boolean') {
        result = res;
      }
    } catch (err: any) {
      result = {
        ok: false,
        message: err?.message || 'Network unavailable. Check connection.',
      };
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed < 450) {
      await new Promise((r) => window.setTimeout(r, 450 - elapsed));
    }

    setFeedbackText(result.message || (result.ok ? 'Refreshed' : 'Connection error'));
    setStatus(result.ok ? 'done' : 'error');
    setPullSafe(0);

    window.setTimeout(() => {
      isRefreshingRef.current = false;
      setStatus((prev) => (prev === 'done' || prev === 'error' ? 'idle' : prev));
    }, 1700);
  }, [disabled]);

  useEffect(() => {
    if (disabled) return;
    const container = scrollContainerRef?.current || internalRef.current;
    if (!container) return;

    const getScrollTop = (): number => {
      if (scrollContainerRef?.current) return scrollContainerRef.current.scrollTop;
      return container.scrollTop;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current || e.touches.length !== 1) return;
      if (getScrollTop() > 2) return;
      if (isDescendantOfBlocker(e.target, container)) return;

      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      isTrackingRef.current = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isTrackingRef.current || startYRef.current === null || startXRef.current === null) return;
      if (isRefreshingRef.current) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const deltaY = currentY - startYRef.current;
      const deltaX = currentX - startXRef.current;

      // Cancel gesture if user scrolls up or swipes horizontally
      if (deltaY <= 0 || getScrollTop() > 2 || Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
        if (pullDistanceRef.current > 0) {
          setPullSafe(0);
          setStatus('idle');
        }
        if (deltaY < -6 || Math.abs(deltaX) > 14) {
          isTrackingRef.current = false;
        }
        return;
      }

      if (deltaY > 10) {
        const damped = Math.min(MAX_PULL_PX, (deltaY - 10) * 0.48);
        setPullSafe(damped);
        setStatus(damped >= PULL_THRESHOLD ? 'ready' : 'pulling');
      }
    };

    const handleTouchEnd = () => {
      if (!isTrackingRef.current) return;
      isTrackingRef.current = false;
      startYRef.current = null;
      startXRef.current = null;

      if (pullDistanceRef.current >= PULL_THRESHOLD && !isRefreshingRef.current) {
        void triggerRefresh();
      } else if (!isRefreshingRef.current) {
        setPullSafe(0);
        setStatus('idle');
      }
    };

    // Mouse / Trackpad drag support when pulled downward from scrollTop === 0
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0 || isRefreshingRef.current) return;
      if (getScrollTop() > 2) return;
      if (isDescendantOfBlocker(e.target, container)) return;
      // Only start pointer pull if not clicking buttons/links
      const targetEl = e.target as HTMLElement | null;
      if (targetEl?.closest('button, a, input, textarea, select')) return;

      startYRef.current = e.clientY;
      startXRef.current = e.clientX;
      isTrackingRef.current = true;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || !isTrackingRef.current || startYRef.current === null || startXRef.current === null) {
        return;
      }
      const deltaY = e.clientY - startYRef.current;
      const deltaX = e.clientX - startXRef.current;
      if (deltaY <= 0 || getScrollTop() > 2 || Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
        if (pullDistanceRef.current > 0) {
          setPullSafe(0);
          setStatus('idle');
        }
        return;
      }
      if (deltaY > 12) {
        const damped = Math.min(MAX_PULL_PX, (deltaY - 12) * 0.45);
        setPullSafe(damped);
        setStatus(damped >= PULL_THRESHOLD ? 'ready' : 'pulling');
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      handleTouchEnd();
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    container.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [disabled, scrollContainerRef, triggerRefresh]);

  const showFloatingIndicator = status !== 'idle' || pullDistance > 2;
  const progress = Math.min(1, pullDistance / PULL_THRESHOLD);
  const translateY =
    status === 'refreshing'
      ? 14
      : status === 'done' || status === 'error'
      ? 12
      : Math.max(-48, pullDistance - 48);

  const indicatorOverlay = showFloatingIndicator ? (
    <div
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+12px)] z-[85] -translate-x-1/2 transition-[transform,opacity] duration-200 ease-out"
      style={{
        transform: `translateY(${Math.max(0, translateY)}px)`,
        opacity: status === 'done' || status === 'error' || status === 'refreshing' ? 1 : Math.min(1, progress * 1.25),
      }}
    >
      <div
        className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[11px] font-bold shadow-2xl backdrop-blur-md ${
          status === 'error'
            ? 'border-rose-500/50 bg-[#220914]/95 text-rose-200'
            : status === 'done'
            ? 'border-emerald-400/45 bg-[#0C211A]/95 text-emerald-200'
            : 'border-[#A855F7]/45 bg-[#150B29]/95 text-white'
        }`}
      >
        {status === 'refreshing' ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#EC4899]" />
        ) : status === 'done' ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : status === 'error' ? (
          <WifiOff className="h-3.5 w-3.5 text-rose-400" />
        ) : (
          <ArrowDown
            className="h-3.5 w-3.5 text-[#C084FC] transition-transform duration-150"
            style={{ transform: `rotate(${status === 'ready' ? 180 : Math.round(progress * 120)}deg)` }}
          />
        )}
        <span className="whitespace-nowrap">
          {status === 'refreshing'
            ? label
            : status === 'done' || status === 'error'
            ? feedbackText
            : status === 'ready'
            ? 'Release to refresh'
            : 'Pull to refresh'}
        </span>
      </div>
    </div>
  ) : null;

  // External scrollContainerRef mode (no extra scroll wrapper)
  if (scrollContainerRef && !children) {
    return indicatorOverlay;
  }

  if (overlayMode) {
    return (
      <div ref={internalRef} className={className || 'relative w-full h-full'}>
        {indicatorOverlay}
        {children}
      </div>
    );
  }

  return (
    <div ref={internalRef} className={`relative ${className || 'w-full min-h-full'}`}>
      {indicatorOverlay}
      <div
        className="transition-transform duration-150 ease-out will-change-transform"
        style={{
          transform: pullDistance > 0 && status !== 'idle' ? `translateY(${Math.round(pullDistance * 0.35)}px)` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

interface RefreshScopeButtonProps {
  scope: RefreshScope;
  onAfterRefresh?: (res: RefreshResult) => void;
  onBeforeRefresh?: () => void;
  compact?: boolean;
  label?: string;
  title?: string;
  className?: string;
}

export const RefreshScopeButton: React.FC<RefreshScopeButtonProps> = ({
  scope,
  onAfterRefresh,
  onBeforeRefresh,
  compact = false,
  label = 'Refresh',
  title = 'Refresh current view & reconnect network',
  className = '',
}) => {
  const { refreshScope } = useApp();
  const [isSpinning, setIsSpinning] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSpinning) return;
    setIsSpinning(true);
    onBeforeRefresh?.();
    const started = Date.now();
    try {
      const res = await refreshScope(scope);
      const elapsed = Date.now() - started;
      if (elapsed < 400) {
        await new Promise((r) => window.setTimeout(r, 400 - elapsed));
      }
      onAfterRefresh?.(res);
    } finally {
      setIsSpinning(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isSpinning}
        title={title}
        aria-label={title}
        className={`flex items-center justify-center rounded-full border border-white/15 bg-black/55 backdrop-blur-md text-zinc-200 hover:text-white hover:border-[#A855F7]/50 active:scale-90 transition-all cursor-pointer disabled:opacity-60 ${
          className || 'w-8 h-8'
        }`}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin text-[#EC4899]' : ''}`} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSpinning}
      title={title}
      aria-label={title}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#A855F7]/30 bg-[#180E2C]/90 text-xs font-bold text-purple-100 hover:text-white hover:border-[#EC4899]/60 active:scale-95 transition-all cursor-pointer disabled:opacity-60 ${className}`}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin text-[#EC4899]' : ''}`} />
      <span className="whitespace-nowrap">{isSpinning ? 'Refreshing...' : label}</span>
    </button>
  );
};
