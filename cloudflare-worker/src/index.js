/**
 * Alpha Mate Reels API — Cloudflare Worker
 * Integrates Cloudflare R2 object storage with Firebase Authentication
 * 
 * Bucket: "alpha-mate-reels" (Binding: REELS_BUCKET)
 * Custom Domain: "https://media.alphamate.app"
 * Max Video Size: 100 MB with Server-Side Streamed Size Enforcement
 */

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const R2_PUBLIC_DOMAIN = 'https://media.alphamate.app';

const SUPPORTED_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/x-matroska',
]);

const MIME_EXTENSION_MAP = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v',
  'video/x-matroska': 'mkv',
};

// CORS Helper Headers
function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Content-Length, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResponse(data, status = 200, request = null) {
  const cors = request ? getCorsHeaders(request) : { 'Access-Control-Allow-Origin': '*' };
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...cors,
    },
  });
}

/**
 * Verify Firebase ID Token using Google Identity Toolkit API
 * Delegates Firebase ID token verification to the Railway backend (RAILWAY_API_URL)
 */
async function verifyFirebaseToken(idToken, env) {
  const railwayBase = (env.RAILWAY_API_URL || '').replace(/\/$/, '');
  if (!railwayBase) throw new Error('RAILWAY_API_URL variable missing in Cloudflare Worker.');
  const response = await fetch(`${railwayBase}/api/auth/verify`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/json' },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success || !data.user?.uid) {
    throw new Error(data.error || 'Invalid or expired Firebase ID token');
  }
  return data.user;
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(request) {
  const authHeader = request.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7).trim();
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // Handle CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCorsHeaders(request),
      });
    }

    // Root Health / Status check
    if (url.pathname === '/' || url.pathname === '/health') {
      return jsonResponse({
        success: true,
        service: 'Alpha Mate Reels API & WebRTC Signaling Helper',
        status: 'online',
        maxUploadSizeBytes: MAX_VIDEO_SIZE_BYTES,
        customDomain: R2_PUBLIC_DOMAIN,
        endpoints: ['/upload', '/reels/:key', '/turn-credentials', '/health'],
      }, 200, request);
    }

    // =========================================================================
    // GET or POST /turn-credentials — Ephemeral / Configured Cloudflare TURN ICE Servers
    // Provides relay connectivity for users on restricted mobile carrier networks (Symmetric NAT / CGNAT)
    // =========================================================================
    if (url.pathname === '/turn-credentials' && (method === 'GET' || method === 'POST')) {
      const turnKeyId = env.CLOUDFLARE_TURN_TOKEN_ID || env.CLOUDFLARE_TURN_KEY_ID;
      const turnApiToken = env.CLOUDFLARE_TURN_API_TOKEN;

      // 1. If Cloudflare Realtime TURN credentials are set, request fresh ephemeral credentials
      if (turnKeyId && turnApiToken) {
        try {
          const cfTurnRes = await fetch(
            `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(turnKeyId)}/credentials/generate-ice-servers`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${turnApiToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ ttl: 86400 }),
            }
          );

          if (cfTurnRes.ok) {
            const cfData = await cfTurnRes.json();
            const iceServersPayload = cfData.iceServers;
            const normalizedServers = Array.isArray(iceServersPayload)
              ? iceServersPayload
              : [iceServersPayload];

            return jsonResponse({
              success: true,
              source: 'cloudflare-calls-api',
              iceServers: [
                { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
                ...normalizedServers,
              ],
              ttl: 86400,
            }, 200, request);
          } else {
            console.warn('Cloudflare Calls TURN API error response:', await cfTurnRes.text());
          }
        } catch (err) {
          console.warn('Failed to reach Cloudflare Calls TURN API:', err);
        }
      }

      // 2. Static Cloudflare TURN configuration or fallback
      const defaultTurnUrls = [
        'turn:turn.cloudflare.com:3478?transport=udp',
        'turn:turn.cloudflare.com:3478?transport=tcp',
        'turns:turn.cloudflare.com:5349?transport=tcp',
      ];
      const configuredTurnUrl = env.CLOUDFLARE_TURN_URL;
      const turnUrls = configuredTurnUrl
        ? configuredTurnUrl.split(',').map((u) => u.trim())
        : defaultTurnUrls;
      const turnUsername = env.CLOUDFLARE_TURN_USERNAME;
      const turnCredential = env.CLOUDFLARE_TURN_CREDENTIAL;

      const iceServers = [
        {
          urls: [
            'stun:stun.cloudflare.com:3478',
            'stun:stun.l.google.com:19302',
            'stun:stun1.l.google.com:19302',
            'stun:stun2.l.google.com:19302',
          ],
        },
      ];

      if (turnUsername && turnCredential) {
        iceServers.push({
          urls: turnUrls,
          username: turnUsername,
          credential: turnCredential,
        });
      }

      return jsonResponse({
        success: true,
        source: turnUsername && turnCredential ? 'cloudflare-turn-static' : 'stun-fallback',
        iceServers,
        ttl: 86400,
        configured: !!(turnUsername && turnCredential),
      }, 200, request);
    }

    // Verify R2 Bucket Binding for Reel endpoints
    if (!env.REELS_BUCKET) {
      return jsonResponse({
        error: 'R2 binding REELS_BUCKET missing in Worker environment',
      }, 500, request);
    }

    // =========================================================================
    // POST /upload — Streamed Raw Video Upload
    // =========================================================================
    if (method === 'POST' && url.pathname === '/upload') {
      // 1. Verify Authentication
      const idToken = extractBearerToken(request);
      if (!idToken) {
        return jsonResponse({ error: 'Missing or malformed Authorization header. Expected Bearer token.' }, 401, request);
      }

      let authUser;
      try {
        authUser = await verifyFirebaseToken(idToken, env);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const status = msg.includes('RAILWAY_API_URL variable missing') ? 500 : 401;
        return jsonResponse({ error: msg }, status, request);
      }

      // 2. Validate MIME type
      const rawContentType = request.headers.get('Content-Type') || '';
      const contentType = rawContentType.split(';')[0].trim().toLowerCase();

      if (!SUPPORTED_MIME_TYPES.has(contentType)) {
        return jsonResponse({
          error: `Unsupported video format: "${contentType}". Supported formats: MP4, WebM, MOV.`,
        }, 415, request);
      }

      // 3. Fast preliminary check on Content-Length header (if present)
      const contentLengthHeader = request.headers.get('Content-Length');
      if (contentLengthHeader) {
        const declaredLength = parseInt(contentLengthHeader, 10);
        if (!isNaN(declaredLength) && declaredLength > MAX_VIDEO_SIZE_BYTES) {
          return jsonResponse({
            error: `Payload Too Large: Declared size ${declaredLength} bytes exceeds the 100 MB limit (${MAX_VIDEO_SIZE_BYTES} bytes).`,
          }, 413, request);
        }
      }

      // 4. Verify request body exists
      if (!request.body) {
        return jsonResponse({ error: 'Request body cannot be empty. Send raw video file bytes.' }, 400, request);
      }

      // 5. Server-Side Streamed Size Enforcement (Counting TransformStream)
      let totalBytesRead = 0;
      let limitExceeded = false;

      const sizeGuardStream = new TransformStream({
        transform(chunk, controller) {
          totalBytesRead += chunk.byteLength;
          if (totalBytesRead > MAX_VIDEO_SIZE_BYTES) {
            limitExceeded = true;
            controller.error(new Error(`Payload Too Large: Streamed video size exceeded 100 MB limit (${MAX_VIDEO_SIZE_BYTES} bytes)`));
            return;
          }
          controller.enqueue(chunk);
        },
      });

      // 6. Generate secure, unique object key partitioned by user UID
      const extension = MIME_EXTENSION_MAP[contentType] || 'mp4';
      const randomSuffix = crypto.randomUUID().slice(0, 12);
      const timestamp = Date.now();
      const videoKey = `reels/${authUser.uid}/${timestamp}_${randomSuffix}.${extension}`;

      try {
        const guardedStream = request.body.pipeThrough(sizeGuardStream);

        // Upload directly into Cloudflare R2
        await env.REELS_BUCKET.put(videoKey, guardedStream, {
          httpMetadata: {
            contentType,
            cacheControl: 'public, max-age=31536000, immutable',
          },
          customMetadata: {
            uid: authUser.uid,
            uploadedAt: new Date().toISOString(),
            originalFormat: contentType,
          },
        });

        const publicVideoUrl = `${R2_PUBLIC_DOMAIN}/${videoKey}`;

        return jsonResponse({
          success: true,
          videoKey,
          videoUrl: publicVideoUrl,
          size: totalBytesRead,
          contentType,
          uid: authUser.uid,
          createdAt: new Date().toISOString(),
        }, 201, request);
      } catch (err) {
        // If size limit was exceeded, cleanup any partial data in bucket
        if (limitExceeded) {
          await env.REELS_BUCKET.delete(videoKey).catch(() => {});
          return jsonResponse({
            error: `Payload Too Large: Video exceeds maximum allowed size of 100 MB.`,
          }, 413, request);
        }

        console.error('R2 upload failed:', err);
        return jsonResponse({
          error: `Failed to upload video to R2 storage: ${err instanceof Error ? err.message : String(err)}`,
        }, 500, request);
      }
    }

    // =========================================================================
    // DELETE /reels/:encodedKey — Authenticated Reel Deletion
    // =========================================================================
    if (method === 'DELETE' && url.pathname.startsWith('/reels/')) {
      const idToken = extractBearerToken(request);
      if (!idToken) {
        return jsonResponse({ error: 'Missing or malformed Authorization header. Expected Bearer token.' }, 401, request);
      }

      let authUser;
      try {
        authUser = await verifyFirebaseToken(idToken, env);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const status = msg.includes('RAILWAY_API_URL variable missing') ? 500 : 401;
        return jsonResponse({ error: msg }, status, request);
      }

      // Extract and decode key
      const encodedKey = url.pathname.substring('/reels/'.length);
      const videoKey = decodeURIComponent(encodedKey);

      if (!videoKey) {
        return jsonResponse({ error: 'Missing videoKey in delete path' }, 400, request);
      }

      // Verify Object Exists and Check Ownership
      const existingObject = await env.REELS_BUCKET.head(videoKey);
      if (!existingObject) {
        return jsonResponse({ error: 'Reel object not found in R2 bucket' }, 404, request);
      }

      // STRICT OWNERSHIP CHECK:
      // Must either start with reels/${uid}/ OR customMetadata.uid must match authUser.uid
      const isOwnerByPath = videoKey.startsWith(`reels/${authUser.uid}/`);
      const isOwnerByMeta = existingObject.customMetadata?.uid === authUser.uid;

      if (!isOwnerByPath && !isOwnerByMeta) {
        return jsonResponse({
          error: 'Forbidden: You do not have permission to delete this reel. Only the owner can delete their reels.',
        }, 403, request);
      }

      try {
        await env.REELS_BUCKET.delete(videoKey);
        return jsonResponse({
          success: true,
          message: 'Reel deleted from R2 bucket successfully',
          videoKey,
        }, 200, request);
      } catch (err) {
        console.error('Failed to delete object from R2:', err);
        return jsonResponse({
          error: `Failed to delete reel from R2 storage: ${err instanceof Error ? err.message : String(err)}`,
        }, 500, request);
      }
    }

    return jsonResponse({ error: 'Not Found' }, 404, request);
  },
};
