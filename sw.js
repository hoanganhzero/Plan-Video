// Service worker: lưu sẵn ứng dụng để mở nhanh và dùng được khi mất mạng.
// Đổi VERSION mỗi khi phát hành để trình duyệt tải bản mới.
const VERSION = 'plan-video-v3';
const APP_FILES = [
  './',
  'index.html',
  'css/style.css',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'js/app.js',
  'js/templates.js',
  'js/prompt-builder.js',
  'js/projects.js',
  'js/social.js',
  'js/gemini.js',
  'js/dubbing.js',
  'js/dub-ui.js',
  'js/montage.js',
  'js/montage-ui.js',
  'js/ui-utils.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Ưu tiên mạng (luôn có bản mới nhất), mất mạng thì dùng bản đã lưu.
// Chỉ xử lý file của chính ứng dụng; gọi Gemini API đi thẳng ra mạng.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match('index.html'))),
  );
});
