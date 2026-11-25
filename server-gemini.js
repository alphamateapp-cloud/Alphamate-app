import { GoogleGenAI } from '@google/genai';

const INBOX_CHAT_MODEL = 'gemini-4-hydrogen';
const ROOM_FAST_MODEL = 'gemini-3.1-flash-lite';

const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_TURNS = 24;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_CHAT_REQ_PER_MIN = 60;
const MAX_WELCOME_REQ_PER_MIN = 45;

const rateBuckets = new Map();

function checkRateLimit(bucketKey, maxRequests) {
  const now = Date.now();
  const entry = rateBuckets.get(bucketKey);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(bucketKey, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getGeminiClient() {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    const err = new Error('Gemini AI is not configured on the server (missing GEMINI_API_KEY).');
    err.status = 503;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function cleanShortText(value, maxLen = 120) {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function normalizeHistory(rawHistory) {
  if (!Array.isArray(rawHistory)) return [];
  const normalized = [];
  for (const item of rawHistory.slice(-MAX_HISTORY_TURNS)) {
    if (!item || typeof item !== 'object') continue;
    const role = item.role === 'model' ? 'model' : item.role === 'user' ? 'user' : null;
    if (!role) continue;
    let text = '';
    if (typeof item.text === 'string') {
      text = item.text.trim();
    } else if (Array.isArray(item.parts)) {
      text = item.parts
        .map((p) => (typeof p?.text === 'string' ? p.text : ''))
        .join('\n')
        .trim();
    }
    if (!text) continue;
    normalized.push({
      role,
      parts: [{ text: text.slice(0, MAX_MESSAGE_CHARS) }],
    });
  }
  // Gemini multi-turn history should start with a user turn when possible; drop leading model welcome if followed by user turns
  while (normalized.length > 0 && normalized[0].role === 'model') {
    normalized.shift();
  }
  return normalized;
}

function buildSystemInstruction(mode, context = {}) {
  const userName = cleanShortText(context.userName, 60) || 'Friend';
  const roomTitle = cleanShortText(context.roomTitle, 80);
  const hostName = cleanShortText(context.hostName, 60);

  if (mode === 'live') {
    return [
      'You are Alpha AI, the friendly live-stream assistant inside the Alpha Mate social app.',
      `Current viewer/speaker: ${userName}.`,
      roomTitle ? `Live stream title: "${roomTitle}".` : '',
      hostName ? `Live host: ${hostName}.` : '',
      'Reply in 1 to 2 concise, warm, energetic sentences suited for a live broadcast chat feed.',
      'Match the language of the user (Hindi, Urdu, Roman Hindi/Urdu, or English naturally).',
      'Never use markdown tables, code blocks, or long lists. Keep responses safe, welcoming, and upbeat.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  if (mode === 'party') {
    return [
      'You are Alpha AI, the friendly voice-party room co-host inside the Alpha Mate app.',
      `Current member: ${userName}.`,
      roomTitle ? `Party room name: "${roomTitle}".` : '',
      hostName ? `Party host: ${hostName}.` : '',
      'Reply in 1 to 2 concise, lively sentences suitable for a voice party chat stream.',
      'Match the language of the user (Hindi, Urdu, Roman Hindi/Urdu, or English naturally).',
      'Keep replies fun, welcoming, and brief with no markdown formatting.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  return [
    'You are Alpha AI, the built-in personal assistant inside every user’s Alpha Mate Inbox.',
    `You are chatting directly with ${userName}.`,
    'Help users with anything they ask: chatting, creative ideas, fun conversations, and guidance on Alpha Mate features (Solo Live Streams, Voice Party Rooms, Virtual Gifts, VIP Levels, Coins/Diamonds, Reels, and Direct Chats).',
    'Match the user’s language naturally (Hindi, Urdu, Roman Hindi/Urdu, or English).',
    'Be warm, clear, helpful, and concise so messages read comfortably in a mobile chat inbox.',
    'Do not claim to modify account balances, coins, or private database records directly.',
  ].join(' ');
}

function extractErrorMessage(error, fallbackMessage) {
  const raw = String(error?.message || '').trim();
  if (!raw) return fallbackMessage;
  try {
    const parsed = JSON.parse(raw);
    const nestedMsg = parsed?.error?.message || parsed?.message;
    if (typeof nestedMsg === 'string' && nestedMsg.trim()) {
      return nestedMsg.trim();
    }
  } catch {
    // plain text message
  }
  return raw;
}

function extractUpstreamStatus(error) {
  const rawStatus = Number(error?.status || error?.statusCode || error?.code);
  if (Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599) {
    return rawStatus;
  }
  const msg = String(error?.message || '');
  if (/"code"\s*:\s*402|prepayment credits|billing/i.test(msg)) return 402;
  if (/API key|permission|unauthenticated|forbidden/i.test(msg)) return 403;
  if (/quota|rate limit|429|resource exhausted/i.test(msg)) return 429;
  if (/invalid argument|400/i.test(msg)) return 400;
  return 502;
}

export function registerGeminiRoutes(app) {
  app.post('/api/gemini/chat', async (req, res) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`chat:${ip}`, MAX_CHAT_REQ_PER_MIN)) {
      return res.status(429).json({
        success: false,
        error: 'Too many chat requests right now. Please wait a moment and try again.',
      });
    }

    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const message = String(body.message ?? '').trim().slice(0, MAX_MESSAGE_CHARS);
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message text is required.',
        });
      }

      const mode = body.mode === 'live' || body.mode === 'party' ? body.mode : 'inbox';
      const context = body.context && typeof body.context === 'object' ? body.context : {};
      const history = normalizeHistory(body.history);
      const model = mode === 'inbox' ? INBOX_CHAT_MODEL : ROOM_FAST_MODEL;
      const systemInstruction = buildSystemInstruction(mode, context);

      const ai = getGeminiClient();
      const chat = ai.chats.create({
        model,
        history,
        config: {
          systemInstruction,
        },
      });

      const response = await chat.sendMessage({ message });
      const reply = String(response?.text || '').trim();

      if (!reply) {
        return res.status(502).json({
          success: false,
          error: 'Gemini returned an empty response. Please try again.',
        });
      }

      return res.json({
        success: true,
        reply,
        model,
      });
    } catch (error) {
      const status = extractUpstreamStatus(error);
      const cleanError = extractErrorMessage(error, 'Unable to reach Gemini right now.');
      console.error('[Gemini /api/gemini/chat] Error:', cleanError);
      return res.status(status).json({
        success: false,
        error: cleanError,
      });
    }
  });

  app.post('/api/gemini/welcome', async (req, res) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`welcome:${ip}`, MAX_WELCOME_REQ_PER_MIN)) {
      return res.status(429).json({
        success: false,
        error: 'Welcome rate limit reached. Please wait a moment.',
      });
    }

    try {
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      const userName = cleanShortText(body.userName, 60) || 'Friend';
      const roomType =
        body.roomType === 'live' || body.roomType === 'party' ? body.roomType : 'inbox';
      const roomTitle = cleanShortText(body.roomTitle, 80);
      const hostName = cleanShortText(body.hostName, 60);
      const isSelf = Boolean(body.isSelf);
      const vipTier = Number.isFinite(Number(body.vipTier)) ? Math.max(0, Math.floor(Number(body.vipTier))) : 0;

      const systemInstruction =
        roomType === 'inbox'
          ? 'You are Alpha AI, the personal Gemini assistant in Alpha Mate Inbox. Write a short, warm 1-2 sentence welcome greeting for the user in friendly natural Hinglish/English (e.g., welcoming them to Alpha Mate and inviting them to ask anything about live rooms, party rooms, or anything else). Keep it under 28 words and plain text only.'
          : 'You are Alpha AI, the friendly host assistant in Alpha Mate Live & Party rooms. Write ONE short, warm, natural welcome line (under 20 words, plain text, no hashtags, no markdown) greeting the user who just joined the room. Use warm Hinglish/English style suitable for South Asian & global live communities.';

      let prompt = '';
      if (roomType === 'inbox') {
        prompt = `Welcome ${userName}${vipTier > 0 ? ` (VIP ${vipTier})` : ''} to their Alpha Mate Inbox AI chat for the first time.`;
      } else if (roomType === 'live') {
        prompt = isSelf
          ? `Welcome ${userName}${vipTier > 0 ? ` (VIP ${vipTier})` : ''} who just entered the live stream${roomTitle ? ` "${roomTitle}"` : ''}${hostName ? ` hosted by ${hostName}` : ''}.`
          : `Welcome viewer ${userName}${vipTier > 0 ? ` (VIP ${vipTier})` : ''} who just joined ${hostName ? `${hostName}'s` : 'the'} live stream${roomTitle ? ` "${roomTitle}"` : ''}.`;
      } else {
        prompt = isSelf
          ? `Welcome ${userName}${vipTier > 0 ? ` (VIP ${vipTier})` : ''} who just joined the voice party room${roomTitle ? ` "${roomTitle}"` : ''}${hostName ? ` hosted by ${hostName}` : ''}.`
          : `Welcome guest ${userName}${vipTier > 0 ? ` (VIP ${vipTier})` : ''} who just entered the party room${roomTitle ? ` "${roomTitle}"` : ''}${hostName ? ` with host ${hostName}` : ''}.`;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: ROOM_FAST_MODEL,
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const text = String(response?.text || '').trim();
      if (!text) {
        return res.status(502).json({
          success: false,
          error: 'Gemini returned an empty welcome message.',
        });
      }

      return res.json({
        success: true,
        text,
        model: ROOM_FAST_MODEL,
      });
    } catch (error) {
      const status = extractUpstreamStatus(error);
      const cleanError = extractErrorMessage(error, 'Unable to generate welcome greeting right now.');
      console.error('[Gemini /api/gemini/welcome] Error:', cleanError);
      return res.status(status).json({
        success: false,
        error: cleanError,
      });
    }
  });
}
