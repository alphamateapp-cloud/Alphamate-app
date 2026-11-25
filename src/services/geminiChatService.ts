const PRODUCTION_API_URL = 'https://api.alphamate.app';

export const GEMINI_ASSISTANT_CONVERSATION_ID = 'gemini_assistant_inbox';
export const GEMINI_ASSISTANT_USER_ID = 'alpha_mate_gemini_ai';
export const GEMINI_ASSISTANT_NAME = 'Alpha AI';
export const GEMINI_ASSISTANT_HANDLE = 'alpha_ai';
export const GEMINI_ASSISTANT_PUBLIC_ID = 'AM-AI-001';

export const GEMINI_ASSISTANT_AVATAR =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="amAiBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#4F46E5"/>
          <stop offset="52%" stop-color="#7C3AED"/>
          <stop offset="100%" stop-color="#DB2777"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="48" fill="url(#amAiBg)"/>
      <circle cx="48" cy="48" r="34" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2.5"/>
      <path d="M48 22L69 66H58.5L53.8 55.5H42.2L37.5 66H27L48 22ZM45.2 47.5H50.8L48 40.8L45.2 47.5Z" fill="#FFFFFF"/>
    </svg>`
  );

export type GeminiChatMode = 'inbox' | 'live' | 'party';

export interface GeminiHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

export interface GeminiInboxMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  createdAtMs: number;
  model?: string;
  isWelcome?: boolean;
}

export interface GeminiChatContext {
  userName?: string;
  roomTitle?: string;
  hostName?: string;
}

const MAX_STORED_INBOX_MESSAGES = 80;
const welcomedSessionKeys = new Map<string, number>();

function resolveGeminiApiBase(): string {
  if (typeof window === 'undefined') return '';
  const proto = window.location.protocol;
  const host = window.location.hostname;
  const port = window.location.port;

  // On native Capacitor shell (capacitor:// or https://localhost with no dev port), point to production API
  const isCapacitorShell =
    proto === 'capacitor:' ||
    (host === 'localhost' && !port) ||
    Boolean((window as any).Capacitor?.isNativePlatform?.());

  if (!isCapacitorShell) {
    // Web & AI Studio preview: call same-origin Express backend where GEMINI_API_KEY is available
    return '';
  }

  const envUrl = ((import.meta as any).env?.VITE_RAILWAY_API_URL || '').trim();
  if (envUrl && !envUrl.includes('YOUR-RAILWAY-DOMAIN') && /^https?:\/\//i.test(envUrl)) {
    return envUrl.replace(/\/$/, '');
  }
  return PRODUCTION_API_URL;
}

function getInboxStorageKey(userId: string): string {
  const safeId = String(userId || 'guest').trim() || 'guest';
  return `alphamate_gemini_inbox_v1_${safeId}`;
}

export function loadInboxBotHistory(userId: string): GeminiInboxMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(getInboxStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m) =>
          m &&
          typeof m.id === 'string' &&
          (m.role === 'user' || m.role === 'model') &&
          typeof m.text === 'string' &&
          m.text.trim().length > 0
      )
      .slice(-MAX_STORED_INBOX_MESSAGES);
  } catch {
    return [];
  }
}

export function saveInboxBotHistory(userId: string, messages: GeminiInboxMessage[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      getInboxStorageKey(userId),
      JSON.stringify(messages.slice(-MAX_STORED_INBOX_MESSAGES))
    );
  } catch {
    // ignore storage quota errors
  }
}

export function clearInboxBotHistory(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(getInboxStorageKey(userId));
  } catch {
    // ignore storage errors
  }
}

export function hasWelcomedInSession(sessionKey: string, cooldownMs = 10 * 60_000): boolean {
  const ts = welcomedSessionKeys.get(sessionKey);
  if (!ts) return false;
  return Date.now() - ts < cooldownMs;
}

export function markWelcomedInSession(sessionKey: string): void {
  welcomedSessionKeys.set(sessionKey, Date.now());
  if (welcomedSessionKeys.size > 300) {
    const oldestKey = welcomedSessionKeys.keys().next().value;
    if (oldestKey) welcomedSessionKeys.delete(oldestKey);
  }
}

export function isBotMentionMessage(text: string): boolean {
  const trimmed = text.trim();
  return /^(@ai|@gemini|@alpha\s*ai|\/ai)\b/i.test(trimmed);
}

export function stripBotMention(text: string): string {
  const cleaned = text.trim().replace(/^(@ai|@gemini|@alpha\s*ai|\/ai)\b[:,\s-]*/i, '').trim();
  return cleaned || text.trim();
}

export async function requestGeminiChat(params: {
  message: string;
  history: GeminiHistoryTurn[];
  mode: GeminiChatMode;
  context?: GeminiChatContext;
  signal?: AbortSignal;
}): Promise<{ reply: string; model: string }> {
  const base = resolveGeminiApiBase();
  const response = await fetch(`${base}/api/gemini/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      message: params.message,
      history: params.history.slice(-20),
      mode: params.mode,
      context: params.context || {},
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success || !data?.reply) {
    throw new Error(data?.error || `Gemini chat failed (HTTP ${response.status}).`);
  }
  return {
    reply: String(data.reply).trim(),
    model: String(data.model || ''),
  };
}

export async function requestGeminiWelcome(params: {
  userName: string;
  roomType: GeminiChatMode;
  roomTitle?: string;
  hostName?: string;
  isSelf?: boolean;
  vipTier?: number;
  signal?: AbortSignal;
}): Promise<{ text: string; model: string }> {
  const base = resolveGeminiApiBase();
  const response = await fetch(`${base}/api/gemini/welcome`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: params.signal,
    body: JSON.stringify({
      userName: params.userName,
      roomType: params.roomType,
      roomTitle: params.roomTitle,
      hostName: params.hostName,
      isSelf: Boolean(params.isSelf),
      vipTier: params.vipTier ?? 0,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success || !data?.text) {
    throw new Error(data?.error || `Gemini welcome failed (HTTP ${response.status}).`);
  }
  return {
    text: String(data.text).trim(),
    model: String(data.model || ''),
  };
}
