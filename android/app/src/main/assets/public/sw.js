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
define(['./workbox-cd5fc262'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "d49829e3a3e4ecf2c3370f504581c4bb"
  }, {
    "url": "pwa-512x512.png",
    "revision": "3ebb34fcf76a09623d9ccdca1a6ef6bd"
  }, {
    "url": "pwa-192x192.png",
    "revision": "a6e80597ff150108cd35c1f3cc22c4ef"
  }, {
    "url": "index.html",
    "revision": "73d0e0e448bd322910591f7648fb9428"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "16f06d9fec1ba8387911107a2af854de"
  }, {
    "url": "alpha-mate-logo-full.png",
    "revision": "40d0b112957655c8d144692efe51e7c7"
  }, {
    "url": "alpha-mate-logo-emblem.png",
    "revision": "45dade0a92bcdcb98247c7d99e688d30"
  }, {
    "url": "assets/workbox-window.prod.es5-Bd17z0YL.js",
    "revision": null
  }, {
    "url": "assets/web-DOKEs38S.js",
    "revision": null
  }, {
    "url": "assets/web-CHA3LUfC.js",
    "revision": null
  }, {
    "url": "assets/index-JFITwbAb.js",
    "revision": null
  }, {
    "url": "assets/index-CFHXN_PE.css",
    "revision": null
  }, {
    "url": "assets/AgoraRTC_N-production-C-2YC49q.js",
    "revision": null
  }, {
    "url": "assets/gifts/sample_alpha_crown.svg",
    "revision": null
  }, {
    "url": "assets/gifts/gift_6370.png",
    "revision": null
  }, {
    "url": "assets/gifts/gift_6331.png",
    "revision": null
  }, {
    "url": "assets/gifts/gift_5651.png",
    "revision": null
  }, {
    "url": "alpha-mate-logo-emblem.png",
    "revision": "45dade0a92bcdcb98247c7d99e688d30"
  }, {
    "url": "alpha-mate-logo-full.png",
    "revision": "40d0b112957655c8d144692efe51e7c7"
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
  }) => /^\/api\/(agora|sfu|webrtc|auth|account|reels\/upload|realtime|admin)/.test(url.pathname), new workbox.NetworkOnly(), 'GET');
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
