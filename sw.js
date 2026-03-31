// ====================================================
// FreshDash Pro - Service Worker
// توصيل فرش - خدمة العمل في الخلفية
// ====================================================

const CACHE_NAME = 'freshdash-v1';
const BASE_PATH = '/Shokry';

const STATIC_ASSETS = [
  BASE_PATH + '/',
  BASE_PATH + '/index.html',
  BASE_PATH + '/style.css',
  BASE_PATH + '/app.js',
  BASE_PATH + '/manifest.json',
  BASE_PATH + '/icons/icon-192.png',
  BASE_PATH + '/icons/icon-512.png'
];

// ===== التثبيت: تخزين الملفات الأساسية =====
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      // نستخدم addAll بشكل آمن - إذا فشل ملف لا يوقف الباقي
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(e => console.warn('[SW] Failed to cache:', url)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ===== التفعيل: حذف الكاش القديم =====
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
      );
    }).then(() => self.clients.claim())
  );
});

// ===== الاعتراض: خدمة الطلبات =====
self.addEventListener('fetch', event => {
  // تجاهل طلبات غير GET
  if (event.request.method !== 'GET') return;

  // تجاهل طلبات Firebase وخارجية
  const url = new URL(event.request.url);
  if (!url.origin.includes('github.io') && !url.pathname.startsWith(BASE_PATH)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // إرجاع الكاش + تحديث في الخلفية
        fetch(event.request).then(fresh => {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, fresh));
        }).catch(() => {});
        return cached;
      }

      // طلب من الشبكة + حفظ في الكاش
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      }).catch(() => {
        // صفحة offline احتياطية
        if (event.request.destination === 'document') {
          return caches.match(BASE_PATH + '/index.html');
        }
      });
    })
  );
});

// ===== استقبال Push Notifications =====
self.addEventListener('push', event => {
  let data = { title: 'توصيل فرش', body: 'لديك إشعار جديد', icon: BASE_PATH + '/icons/icon-192.png' };
  
  if (event.data) {
    try { data = { ...data, ...event.data.json() }; } 
    catch(e) { data.body = event.data.text(); }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || BASE_PATH + '/icons/icon-192.png',
      badge: BASE_PATH + '/icons/icon-72.png',
      dir: 'rtl',
      lang: 'ar',
      vibrate: [200, 100, 200],
      tag: 'freshdash-notification',
      renotify: true,
      data: data
    })
  );
});

// ===== النقر على الإشعار =====
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        return clientList[0].focus();
      }
      return clients.openWindow(BASE_PATH + '/');
    })
  );
});
