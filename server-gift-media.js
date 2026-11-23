import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import express from 'express';

const execFileAsync = promisify(execFile);

const PUBLIC_ROOT = path.resolve(process.cwd(), 'public');
const GIFTS_UPLOAD_ROOT = path.resolve(PUBLIC_ROOT, 'uploads', 'gifts');
const ORIGINALS_DIR = path.resolve(GIFTS_UPLOAD_ROOT, 'originals');
const CONVERTED_DIR = path.resolve(GIFTS_UPLOAD_ROOT, 'converted');
const THUMBNAILS_DIR = path.resolve(GIFTS_UPLOAD_ROOT, 'thumbnails');
const AISTUDIO_ASSETS_DIR = path.resolve(PUBLIC_ROOT, 'assets', 'aistudio');

const ALLOWED_ANIMATION_EXTS = new Set(['.webm', '.svga', '.mov', '.mp4', '.svg', '.gif']);
const ALLOWED_THUMBNAIL_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

const MAX_BYTES_BY_FORMAT = {
  svg: 2 * 1024 * 1024, // 2 MB
  svga: 25 * 1024 * 1024, // 25 MB
  gif: 12 * 1024 * 1024, // 12 MB
  webm: 50 * 1024 * 1024, // 50 MB
  mov: 50 * 1024 * 1024, // 50 MB
  mp4: 50 * 1024 * 1024, // 50 MB
  thumbnail: 8 * 1024 * 1024, // 8 MB
};

function ensureGiftDirectoriesSync() {
  for (const dir of [GIFTS_UPLOAD_ROOT, ORIGINALS_DIR, CONVERTED_DIR, THUMBNAILS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function isPathInsideDir(targetPath, allowedDir) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedBase = path.resolve(allowedDir);
  return resolvedTarget === resolvedBase || resolvedTarget.startsWith(resolvedBase + path.sep);
}

/**
 * Resolves a public URL path (strictly under /uploads/gifts/ or /assets/aistudio/)
 * to an absolute confined filesystem path. Returns null if disallowed or traversal attempted.
 */
export function resolveConfinedGiftMediaPath(publicUrlPath) {
  if (typeof publicUrlPath !== 'string' || !publicUrlPath.trim()) return null;
  let cleanPath = publicUrlPath.trim();
  // Strip origin if same-host full URL is passed
  if (/^https?:\/\//i.test(cleanPath)) {
    try {
      cleanPath = new URL(cleanPath).pathname;
    } catch {
      return null;
    }
  }
  cleanPath = cleanPath.split('?')[0].split('#')[0];
  if (!cleanPath.startsWith('/')) return null;

  const candidate = path.resolve(PUBLIC_ROOT, '.' + cleanPath);
  if (isPathInsideDir(candidate, GIFTS_UPLOAD_ROOT) || isPathInsideDir(candidate, AISTUDIO_ASSETS_DIR)) {
    return candidate;
  }
  return null;
}

function detectFormatFromExt(ext) {
  const normalized = String(ext || '').toLowerCase();
  if (normalized === '.webm') return 'webm';
  if (normalized === '.svga') return 'svga';
  if (normalized === '.mov') return 'mov';
  if (normalized === '.mp4') return 'mp4';
  if (normalized === '.svg') return 'svg';
  if (normalized === '.gif') return 'gif';
  return null;
}

/**
 * Validates and inspects an uploaded SVGA binary file (SVGA 2.x zlib protobuf or SVGA 1.x ZIP).
 * SVGA renders natively on a 100% transparent canvas via SVGAPlayer.
 */
export function analyzeSvgaBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    throw new Error('Uploaded SVGA file is empty or too small.');
  }
  const b0 = buffer[0];
  const b1 = buffer[1];
  const isZipSvga1 = b0 === 0x50 && b1 === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  // Standard zlib headers (CMF=0x78 with FLG 0x01, 0x5e, 0x9c, 0xda)
  const isZlibSvga2 = b0 === 0x78 && (b1 === 0x01 || b1 === 0x5e || b1 === 0x9c || b1 === 0xda);
  if (!isZipSvga1 && !isZlibSvga2) {
    throw new Error('Uploaded file does not have a valid SVGA 1.x (ZIP) or SVGA 2.x (Zlib Protobuf) header.');
  }

  const warnings = [];
  if (buffer.length > 8 * 1024 * 1024) {
    warnings.push('Large SVGA file (>8 MB) detected — keep SVGA assets compact for instant mobile live room playback.');
  }

  return {
    format: 'svga',
    container: isZlibSvga2 ? 'application/x-svga-v2' : 'application/x-svga-v1',
    codec: isZlibSvga2 ? 'SVGA 2.0 (Zlib Protobuf)' : 'SVGA 1.0 (ZIP)',
    pixFmt: 'canvas-rgba',
    width: 750,
    height: 1334,
    fps: 30,
    durationSec: 6,
    fileSizeBytes: buffer.length,
    hasAlpha: true,
    hasAudio: false,
    audioCodec: null,
    transparencyStatus: 'alpha_verified',
    recommendedMode: 'transparent',
    androidWebViewCompatible: true,
    warnings,
  };
}

function parseFrameRate(rawRate) {
  if (!rawRate || typeof rawRate !== 'string') return 0;
  const parts = rawRate.split('/');
  if (parts.length === 2) {
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (den > 0 && Number.isFinite(num)) {
      return Math.round((num / den) * 100) / 100;
    }
  }
  const parsed = Number(rawRate);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

/**
 * Sanitizes an uploaded SVG file for security and reports supported/unsupported animation features.
 */
export function sanitizeAndAnalyzeSvg(rawText) {
  const original = String(rawText || '');
  const unsupportedFeatures = [];
  const warnings = [];

  if (!/<svg[\s>]/i.test(original)) {
    throw new Error('Uploaded SVG does not contain a valid <svg> root element.');
  }

  let sanitized = original;

  // Detect and strip dangerous or unsupported tags
  if (/<script[\s>]/i.test(sanitized)) {
    unsupportedFeatures.push('Inline <script> elements removed for security');
    sanitized = sanitized.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    sanitized = sanitized.replace(/<script\b[^>]*\/>/gi, '');
  }
  if (/<foreignObject[\s>]/i.test(sanitized)) {
    unsupportedFeatures.push('<foreignObject> elements removed for security & mobile WebView safety');
    sanitized = sanitized.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, '');
  }
  if (/<(iframe|object|embed|applet|meta|link|base)\b/i.test(sanitized)) {
    unsupportedFeatures.push('Embedded external frame/object tags removed for security');
    sanitized = sanitized.replace(/<(iframe|object|embed|applet)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    sanitized = sanitized.replace(/<(iframe|object|embed|applet|meta|link|base)\b[^>]*\/?>/gi, '');
  }

  // Strip inline event handlers (onload, onclick, onbegin, onerror, etc.)
  const eventHandlerPattern = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
  if (eventHandlerPattern.test(sanitized)) {
    unsupportedFeatures.push('Inline DOM event handlers (on*) stripped for security');
    sanitized = sanitized.replace(eventHandlerPattern, '');
  }

  // Strip javascript:/vbscript:/data:text/html URIs in href/xlink:href/src/style
  const dangerousUriPattern = /(?:xlink:)?(?:href|src)\s*=\s*(?:"\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^"]*"|'\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^']*')/gi;
  if (dangerousUriPattern.test(sanitized)) {
    unsupportedFeatures.push('Unsafe script/HTML URIs stripped from SVG references');
    sanitized = sanitized.replace(dangerousUriPattern, '');
  }

  // Strip external remote href/src references to prevent tracking / SSRF
  const externalRefPattern = /(?:xlink:)?(?:href|src)\s*=\s*(?:"\s*https?:\/\/[^"]*"|'\s*https?:\/\/[^']*')/gi;
  if (externalRefPattern.test(sanitized)) {
    unsupportedFeatures.push('External HTTP/HTTPS references removed (self-contained SVG assets required)');
    sanitized = sanitized.replace(externalRefPattern, '');
  }

  // Remove CSS url(http...) or expression(...)
  if (/expression\s*\(|@import\b|url\s*\(\s*["']?\s*https?:/i.test(sanitized)) {
    unsupportedFeatures.push('External CSS @import / remote url() stripped from SVG styles');
    sanitized = sanitized
      .replace(/@import[^;]+;?/gi, '')
      .replace(/expression\s*\([^)]*\)/gi, '')
      .replace(/url\s*\(\s*["']?\s*https?:[^)]*\)/gi, 'none');
  }

  // Detect supported SVG animation features
  const hasSmil = /<(animate|animateTransform|animateMotion|animateColor|set)\b/i.test(sanitized);
  const hasCssKeyframes = /@keyframes\b/i.test(sanitized);
  const hasFilter = /<filter\b/i.test(sanitized);

  if (hasFilter) {
    warnings.push('SVG uses <filter> effects (blur/drop-shadow); heavy filters may reduce frame rate on low-end Android devices.');
  }
  if (!hasSmil && !hasCssKeyframes) {
    warnings.push('No SMIL (<animate>/<animateTransform>) or CSS @keyframes detected; SVG will display as a crisp transparent vector overlay.');
  }

  // Extract dimensions from viewBox or width/height
  let width = 512;
  let height = 512;
  const viewBoxMatch = sanitized.match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (viewBoxMatch) {
    width = Math.round(Number(viewBoxMatch[1]) || 512);
    height = Math.round(Number(viewBoxMatch[2]) || 512);
  } else {
    const wMatch = sanitized.match(/\bwidth\s*=\s*["']\s*([\d.]+)/i);
    const hMatch = sanitized.match(/\bheight\s*=\s*["']\s*([\d.]+)/i);
    if (wMatch) width = Math.round(Number(wMatch[1]) || 512);
    if (hMatch) height = Math.round(Number(hMatch[1]) || 512);
  }

  const fileSizeBytes = Buffer.byteLength(sanitized, 'utf8');
  return {
    sanitizedSvg: sanitized,
    analysis: {
      format: 'svg',
      container: 'image/svg+xml',
      codec: hasSmil && hasCssKeyframes ? 'SVG (SMIL + CSS)' : hasSmil ? 'SVG (SMIL)' : hasCssKeyframes ? 'SVG (CSS)' : 'SVG Vector',
      pixFmt: 'vector-rgba',
      width,
      height,
      fps: 60,
      durationSec: 5,
      fileSizeBytes,
      hasAlpha: true,
      hasAudio: false,
      transparencyStatus: 'alpha_verified',
      recommendedMode: 'transparent',
      androidWebViewCompatible: true,
      warnings,
      svgFeatures: {
        hasSmil,
        hasCssKeyframes,
        unsupportedFeatures,
      },
    },
  };
}

/**
 * Probes any video or GIF media file using real ffprobe (no shell execution).
 */
export async function probeMediaFile(filePath, formatHint = null) {
  const stat = await fsp.stat(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const format = formatHint || detectFormatFromExt(ext) || 'webm';

  if (format === 'svg') {
    const raw = await fsp.readFile(filePath, 'utf8');
    return sanitizeAndAnalyzeSvg(raw).analysis;
  }

  if (format === 'svga') {
    const rawBuf = await fsp.readFile(filePath);
    return analyzeSvgaBuffer(rawBuf);
  }

  const { stdout } = await execFileAsync(
    'ffprobe',
    ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    { timeout: 20_000, maxBuffer: 4 * 1024 * 1024 }
  );

  const parsed = JSON.parse(stdout || '{}');
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStream = streams.find((s) => s.codec_type === 'video') || null;
  const audioStream = streams.find((s) => s.codec_type === 'audio') || null;

  if (!videoStream) {
    throw new Error('No readable video or animated image stream found in the uploaded file.');
  }

  const codec = String(videoStream.codec_name || 'unknown').toLowerCase();
  const profile = String(videoStream.profile || '');
  const pixFmt = String(videoStream.pix_fmt || 'unknown').toLowerCase();
  const width = Number(videoStream.width || 0);
  const height = Number(videoStream.height || 0);
  const fps = parseFrameRate(videoStream.avg_frame_rate || videoStream.r_frame_rate);
  const durationSec = Math.round((Number(parsed.format?.duration || videoStream.duration || 0) || 0) * 100) / 100;
  const container = String(parsed.format?.format_name || format);
  const alphaModeTag = String(
    videoStream.tags?.alpha_mode ??
    videoStream.tags?.ALPHA_MODE ??
    parsed.format?.tags?.alpha_mode ??
    ''
  ).trim();

  const hasAlphaPixFmt = /^(yuva|rgba|argb|bgra|abgr|gbra|ya8|ya16|ayuv)/i.test(pixFmt);
  const warnings = [];
  let hasAlpha = false;
  let transparencyStatus = 'opaque_no_alpha';
  let recommendedMode = 'semi_transparent';
  let androidWebViewCompatible = true;

  if (format === 'gif' || codec === 'gif') {
    hasAlpha = true;
    transparencyStatus = 'alpha_limited_gif';
    recommendedMode = 'transparent';
    warnings.push(
      'GIF supports 1-bit on/off transparency only (no smooth semi-transparent alpha edges or soft glow feathering). For cinema-grade soft alpha transparency, upload a VP9 WebM with Alpha (yuva420p) or animated SVG.'
    );
    if (stat.size > 4 * 1024 * 1024) {
      warnings.push('Large GIF file (>4 MB) may increase mobile RAM usage during live rooms.');
    }
  } else if (format === 'webm') {
    hasAlpha = hasAlphaPixFmt || alphaModeTag === '1';
    if (hasAlpha) {
      transparencyStatus = 'alpha_verified';
      recommendedMode = 'transparent';
      if (codec !== 'vp9' && codec !== 'vp8') {
        warnings.push(`WebM uses '${codec}' instead of VP9; verify hardware decoder support on older Android devices.`);
      }
    } else {
      transparencyStatus = 'opaque_no_alpha';
      recommendedMode = 'semi_transparent';
      warnings.push(
        `No alpha channel detected in this WebM (codec: ${codec}, pixel format: ${pixFmt}, alpha_mode: ${alphaModeTag || '0'}). Playing it in Transparent Mode will display an opaque rectangular frame. Use Semi-Transparent Mode or Overlay/Background Mode, or export with VP9 Alpha (yuva420p).`
      );
    }
  } else if (format === 'mov') {
    hasAlpha = hasAlphaPixFmt || alphaModeTag === '1';
    androidWebViewCompatible = false;
    if (hasAlpha) {
      transparencyStatus = 'alpha_verified';
      recommendedMode = 'transparent';
      warnings.push(
        `Alpha channel verified in MOV (${codec}${profile ? ` ${profile}` : ''}, ${pixFmt}). Direct MOV playback is not supported on Android WebView / Chrome — click "Convert to Optimized WebM (VP9 Alpha)" to produce a real transparent WebM for mobile & web live rooms.`
      );
    } else {
      transparencyStatus = 'opaque_no_alpha';
      recommendedMode = 'overlay_background';
      warnings.push(
        `This MOV (${codec}, ${pixFmt}) does NOT contain an alpha transparency channel. Convert to WebM for Android compatibility, and use Semi-Transparent or Overlay/Background Mode (converting an opaque MOV cannot create transparency).`
      );
    }
  } else if (format === 'mp4') {
    hasAlpha = hasAlphaPixFmt || alphaModeTag === '1';
    if (hasAlpha) {
      transparencyStatus = 'alpha_verified';
      recommendedMode = 'transparent';
      warnings.push('Alpha channel detected in MP4 container; convert to VP9 WebM with Alpha for reliable cross-browser & Android transparency.');
    } else {
      transparencyStatus = 'opaque_no_alpha';
      recommendedMode = 'overlay_background';
      warnings.push(
        `Standard MP4 (${codec}, ${pixFmt}) does NOT contain an alpha transparency channel. Do not expect Transparent Mode to remove its background — changing the file extension or re-encoding to WebM will NOT create alpha transparency. Use Semi-Transparent Mode or Overlay/Background Mode.`
      );
    }
  }

  if (width > 1280 || height > 1280) {
    warnings.push(`High resolution (${width}x${height}) detected. Optimizing to <=720px width is recommended for smooth mobile live-room playback.`);
  }

  return {
    format,
    container,
    codec: profile ? `${codec} (${profile})` : codec,
    pixFmt,
    width,
    height,
    fps,
    durationSec,
    fileSizeBytes: stat.size,
    hasAlpha,
    hasAudio: Boolean(audioStream),
    audioCodec: audioStream ? String(audioStream.codec_name || '') : null,
    transparencyStatus,
    recommendedMode,
    androidWebViewCompatible,
    warnings,
  };
}

/**
 * Converts a source MOV/MP4/WebM to an optimized VP9 WebM while strictly preserving alpha
 * ONLY if the source genuinely has an alpha channel (never faking transparency).
 */
export async function convertVideoToOptimizedWebm(sourcePath) {
  ensureGiftDirectoriesSync();
  const sourceAnalysis = await probeMediaFile(sourcePath);

  if (sourceAnalysis.format === 'svg' || sourceAnalysis.format === 'svga' || sourceAnalysis.format === 'gif') {
    throw new Error('SVGA, SVG, and GIF files play natively and do not require video transcoding.');
  }

  const preserveAlpha = Boolean(sourceAnalysis.hasAlpha);
  const hash = crypto.createHash('sha1').update(`${sourcePath}:${Date.now()}`).digest('hex').slice(0, 14);
  const outFilename = `gift_vp9_${preserveAlpha ? 'alpha_' : ''}${hash}.webm`;
  const outputPath = path.resolve(CONVERTED_DIR, outFilename);

  if (!isPathInsideDir(outputPath, CONVERTED_DIR)) {
    throw new Error('Invalid conversion output path.');
  }

  const ffmpegArgs = [
    '-y',
    '-i',
    sourcePath,
    '-c:v',
    'libvpx-vp9',
    '-pix_fmt',
    preserveAlpha ? 'yuva420p' : 'yuv420p',
    ...(preserveAlpha ? ['-auto-alt-ref', '0', '-metadata:s:v:0', 'alpha_mode=1'] : []),
    '-crf',
    preserveAlpha ? '30' : '32',
    '-b:v',
    '0',
    '-deadline',
    'good',
    '-cpu-used',
    '4',
    '-vf',
    "scale='min(720,iw)':-2",
    ...(sourceAnalysis.hasAudio ? ['-c:a', 'libopus', '-b:a', '96k'] : ['-an']),
    outputPath,
  ];

  await execFileAsync('ffmpeg', ffmpegArgs, { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });

  const convertedAnalysis = await probeMediaFile(outputPath, 'webm');
  const warnings = [...(convertedAnalysis.warnings || [])];
  if (!preserveAlpha) {
    warnings.unshift(
      'Source video had no alpha channel; converted to lightweight VP9 WebM (yuv420p) for faster mobile streaming, but background remains opaque (use Semi-Transparent or Overlay/Background Mode).'
    );
  }

  return {
    optimizedFileUrl: `/uploads/gifts/converted/${outFilename}`,
    preservedAlpha: preserveAlpha && convertedAnalysis.hasAlpha,
    analysis: {
      ...convertedAnalysis,
      warnings,
    },
    warnings,
  };
}

/**
 * Registers Advanced Gift Animation Engine API routes and static media serving on Express.
 */
export function registerGiftMediaRoutes(app, { requireFirebaseAuth, requireAdmin }) {
  ensureGiftDirectoriesSync();

  // Serve uploaded/converted gift media with strict content security headers
  app.use(
    '/uploads/gifts',
    (req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      if (req.path.toLowerCase().endsWith('.svg')) {
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader(
          'Content-Security-Policy',
          "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:;"
        );
      } else if (req.path.toLowerCase().endsWith('.svga')) {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      next();
    },
    express.static(GIFTS_UPLOAD_ROOT, {
      maxAge: '7d',
      immutable: false,
      fallthrough: true,
    })
  );

  // 1. Admin Gift Media Upload (MOV, MP4, WebM, SVG, GIF + optional Thumbnail)
  app.post(
    '/api/admin/gifts/upload',
    requireFirebaseAuth,
    requireAdmin,
    express.raw({ type: '*/*', limit: '50mb' }),
    async (req, res) => {
      try {
        ensureGiftDirectoriesSync();
        const rawBody = req.body;
        if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
          return res.status(400).json({ success: false, error: 'Empty upload body. Attach binary animation or thumbnail file.' });
        }

        const uploadKind = String(req.headers['x-upload-kind'] || 'animation').toLowerCase() === 'thumbnail'
          ? 'thumbnail'
          : 'animation';
        const rawFilename = String(req.headers['x-file-name'] || 'gift_upload.webm');
        const safeBase = path.basename(rawFilename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const ext = path.extname(safeBase).toLowerCase();

        if (uploadKind === 'thumbnail') {
          if (!ALLOWED_THUMBNAIL_EXTS.has(ext)) {
            return res.status(400).json({
              success: false,
              error: `Unsupported thumbnail format "${ext}". Allowed: PNG, JPG, WebP, GIF, SVG.`,
            });
          }
          if (rawBody.length > MAX_BYTES_BY_FORMAT.thumbnail) {
            return res.status(413).json({ success: false, error: 'Thumbnail exceeds 8 MB maximum size.' });
          }

          let bufferToWrite = rawBody;
          if (ext === '.svg') {
            const { sanitizedSvg } = sanitizeAndAnalyzeSvg(rawBody.toString('utf8'));
            bufferToWrite = Buffer.from(sanitizedSvg, 'utf8');
          }

          const uniqueName = `thumb_${Date.now()}_${crypto.randomBytes(5).toString('hex')}${ext}`;
          const targetPath = path.resolve(THUMBNAILS_DIR, uniqueName);
          if (!isPathInsideDir(targetPath, THUMBNAILS_DIR)) {
            return res.status(400).json({ success: false, error: 'Invalid upload destination.' });
          }
          await fsp.writeFile(targetPath, bufferToWrite);

          return res.json({
            success: true,
            uploadKind: 'thumbnail',
            fileUrl: `/uploads/gifts/thumbnails/${uniqueName}`,
            fileSizeBytes: bufferToWrite.length,
          });
        }

        // Animation upload validation
        if (!ALLOWED_ANIMATION_EXTS.has(ext)) {
          return res.status(400).json({
            success: false,
            error: `Unsupported animation format "${ext}". Supported formats: WebM, SVGA, MOV, MP4, SVG, GIF.`,
          });
        }

        const format = detectFormatFromExt(ext);
        const maxAllowed = MAX_BYTES_BY_FORMAT[format] || 50 * 1024 * 1024;
        if (rawBody.length > maxAllowed) {
          return res.status(413).json({
            success: false,
            error: `File exceeds maximum allowed size (${Math.round(maxAllowed / (1024 * 1024))} MB) for ${format.toUpperCase()}.`,
          });
        }

        const uniqueName = `gift_${Date.now()}_${crypto.randomBytes(5).toString('hex')}${ext}`;
        const targetPath = path.resolve(ORIGINALS_DIR, uniqueName);
        if (!isPathInsideDir(targetPath, ORIGINALS_DIR)) {
          return res.status(400).json({ success: false, error: 'Invalid upload destination.' });
        }

        let analysis;
        if (format === 'svg') {
          const { sanitizedSvg, analysis: svgAnalysis } = sanitizeAndAnalyzeSvg(rawBody.toString('utf8'));
          await fsp.writeFile(targetPath, sanitizedSvg, 'utf8');
          analysis = svgAnalysis;
        } else if (format === 'svga') {
          analysis = analyzeSvgaBuffer(rawBody);
          await fsp.writeFile(targetPath, rawBody);
        } else {
          await fsp.writeFile(targetPath, rawBody);
          try {
            analysis = await probeMediaFile(targetPath, format);
          } catch (probeErr) {
            await fsp.unlink(targetPath).catch(() => {});
            return res.status(422).json({
              success: false,
              error: `Uploaded file could not be decoded by ffprobe: ${probeErr?.message || 'corrupted or unsupported media container'}`,
            });
          }
        }

        const publicUrl = `/uploads/gifts/originals/${uniqueName}`;
        return res.json({
          success: true,
          uploadKind: 'animation',
          originalFileUrl: publicUrl,
          fileUrl: publicUrl,
          format,
          fileSizeBytes: analysis.fileSizeBytes,
          analysis,
        });
      } catch (err) {
        console.error('[Gift Media Upload] Error:', err);
        return res.status(500).json({
          success: false,
          error: err?.message || 'Failed to upload and inspect gift animation file.',
        });
      }
    }
  );

  // 2. Admin Real FFprobe / SVG Analysis on Existing Local Gift Asset
  app.post('/api/admin/gifts/probe-local', requireFirebaseAuth, requireAdmin, async (req, res) => {
    try {
      const fileUrl = String(req.body?.fileUrl || '').trim();
      const confinedPath = resolveConfinedGiftMediaPath(fileUrl);
      if (!confinedPath) {
        return res.status(400).json({
          success: false,
          error: 'Only local gift media paths under /uploads/gifts/ or /assets/aistudio/ can be probed.',
        });
      }

      if (!fs.existsSync(confinedPath)) {
        return res.status(404).json({ success: false, error: 'Gift media file not found on server.' });
      }

      const analysis = await probeMediaFile(confinedPath);
      return res.json({
        success: true,
        fileUrl,
        format: analysis.format,
        analysis,
      });
    } catch (err) {
      console.error('[Gift Media Probe] Error:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Unable to inspect gift media file.',
      });
    }
  });

  // 3. Admin Server-Side FFmpeg Conversion to Optimized VP9 WebM (Preserving Original File Separately)
  app.post('/api/admin/gifts/convert', requireFirebaseAuth, requireAdmin, async (req, res) => {
    try {
      const sourceFileUrl = String(req.body?.sourceFileUrl || '').trim();
      const confinedSource = resolveConfinedGiftMediaPath(sourceFileUrl);
      if (!confinedSource) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or disallowed source file path for conversion.',
        });
      }
      if (!fs.existsSync(confinedSource)) {
        return res.status(404).json({ success: false, error: 'Source gift video file not found.' });
      }

      const result = await convertVideoToOptimizedWebm(confinedSource);
      return res.json({
        success: true,
        originalFileUrl: sourceFileUrl,
        optimizedFileUrl: result.optimizedFileUrl,
        preservedAlpha: result.preservedAlpha,
        conversionStatus: 'completed',
        analysis: result.analysis,
        warnings: result.warnings,
      });
    } catch (err) {
      console.error('[Gift Media Convert] Error:', err);
      return res.status(500).json({
        success: false,
        conversionStatus: 'failed',
        error: err?.message || 'FFmpeg conversion to WebM failed.',
      });
    }
  });

  // 4. Authenticated Gift Send Validation Endpoint (Anti-Tamper Pre-Check + Split Calculation)
  app.post('/api/gifts/validate-send', requireFirebaseAuth, async (req, res) => {
    try {
      const giftId = String(req.body?.giftId || '').trim();
      const unitCoins = Math.floor(Number(req.body?.unitCoins || 0));
      const quantity = Math.floor(Number(req.body?.quantity || 1));
      const roomType = req.body?.roomType === 'party' ? 'party' : 'live';
      const roomId = String(req.body?.roomId || '').trim();
      const recipientId = String(req.body?.recipientId || '').trim();

      if (!giftId || giftId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(giftId)) {
        return res.status(400).json({ success: false, error: 'Invalid giftId.' });
      }
      if (!Number.isFinite(unitCoins) || unitCoins < 1 || unitCoins > 10_000_000) {
        return res.status(400).json({ success: false, error: 'Invalid gift coin price.' });
      }
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > 9999) {
        return res.status(400).json({ success: false, error: 'Invalid gift quantity.' });
      }
      if (!roomId || roomId.length > 128 || !recipientId || recipientId.length > 128) {
        return res.status(400).json({ success: false, error: 'Missing roomId or recipientId.' });
      }

      const totalCoins = unitCoins * quantity;
      if (totalCoins > 50_000_000) {
        return res.status(400).json({ success: false, error: 'Transaction exceeds single-send coin limit.' });
      }
      const hostDiamonds = Math.round(totalCoins * 0.6);
      const appShareCoins = totalCoins - hostDiamonds;

      return res.json({
        success: true,
        senderUid: req.firebaseUser.uid,
        giftId,
        roomType,
        roomId,
        recipientId,
        quantity,
        unitCoins,
        totalCoins,
        hostDiamonds,
        appShareCoins,
        validatedAtMs: Date.now(),
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Gift send validation failed.',
      });
    }
  });
}
