/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-39895644'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "ca54219699c7be8f60936fd899f8810f"
  }, {
    "url": "assets/gifts/sample_alpha_crown.svg",
    "revision": null
  }, {
    "url": "assets/index-oDUtd_lR.js",
    "revision": null
  }, {
    "url": "assets/index-Bulg11gx.css",
    "revision": null
  }, {
    "url": "assets/vendor-react-Cq3OBtcB.js",
    "revision": null
  }, {
    "url": "assets/vendor-firebase-Dkh5Udrv.js",
    "revision": null
  }, {
    "url": "alpha-mate-logo-emblem.png",
    "revision": "3b07e131b2dec0e4f71d72b20d4e2c8c"
  }, {
    "url": "alpha-mate-logo-emblem.webp",
    "revision": "2a180f117961b2dfbb334c82aaa57faa"
  }, {
    "url": "alpha-mate-logo-full.png",
    "revision": "fc0a0c50bdb2bf223397f69217e2c0ef"
  }, {
    "url": "alpha-mate-logo-full.webp",
    "revision": "c11b59944c62db49b5b0a25c3e845946"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "16f06d9fec1ba8387911107a2af854de"
  }, {
    "url": "pwa-192x192.png",
    "revision": "a6e80597ff150108cd35c1f3cc22c4ef"
  }, {
    "url": "pwa-512x512.png",
    "revision": "3ebb34fcf76a09623d9ccdca1a6ef6bd"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "d49829e3a3e4ecf2c3370f504581c4bb"
  }, {
    "url": "manifest.webmanifest",
    "revision": "66508ca141d2a72558393959685c311e"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/api\//, /^\/ws/, /^\/__/, /^\/uploads\/gifts\//]
  }));
  workbox.registerRoute(({
    url
  }) => /^\/api\/(agora|sfu|webrtc|auth|account|reels\/upload|realtime|admin|gemini)/.test(url.pathname), new workbox.NetworkOnly(), 'GET');
  workbox.registerRoute(({
    url
  }) => /^\/api\/music\/(search|trending)/.test(url.pathname), new workbox.StaleWhileRevalidate({
    "cacheName": "alphamate-music-api-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 60,
      maxAgeSeconds: 600
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    url,
    request
  }) => url.origin === self.location.origin && url.pathname.startsWith("/assets/") && (request.destination === "script" || request.destination === "style"), new workbox.CacheFirst({
    "cacheName": "alphamate-lazy-chunks-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 120,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    url
  }) => url.pathname.startsWith("/__sw_cache__/profile-snippets/"), new workbox.CacheFirst({
    "cacheName": "alphamate-profile-snippets-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 250,
      maxAgeSeconds: 604800
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/(lh[0-9]+\.googleusercontent\.com|firebasestorage\.googleapis\.com|storage\.googleapis\.com|images\.unsplash\.com|.*\.r2\.dev)\/.*/i, new workbox.StaleWhileRevalidate({
    "cacheName": "alphamate-profile-avatars-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 160,
      maxAgeSeconds: 1209600
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(({
    url,
    request
  }) => url.origin === self.location.origin && !url.pathname.startsWith("/assets/aistudio/") && (url.pathname.startsWith("/assets/backgrounds/") || request.destination === "image" || request.destination === "font"), new workbox.CacheFirst({
    "cacheName": "alphamate-ui-assets-v1",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 80,
      maxAgeSeconds: 2592000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.googleapis\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "google-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');
  workbox.registerRoute(/^https:\/\/fonts\.gstatic\.com\/.*/i, new workbox.CacheFirst({
    "cacheName": "gstatic-fonts-cache",
    plugins: [new workbox.ExpirationPlugin({
      maxEntries: 10,
      maxAgeSeconds: 31536000
    }), new workbox.CacheableResponsePlugin({
      statuses: [0, 200]
    })]
  }), 'GET');

}));
