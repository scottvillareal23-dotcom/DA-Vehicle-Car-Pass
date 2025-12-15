// Service Worker for PWA functionality and offline support

const CACHE_NAME = 'da-vehicle-pass-v2.0.0';
const API_CACHE = 'da-api-cache-v2.0.0';

// Files to cache for offline use
const STATIC_CACHE_URLS = [
  '/',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Department_of_Agriculture_of_the_Philippines.svg/490px-Department_of_Agriculture_of_the_Philippines.svg.png'
];

// API endpoints to cache for offline use
const API_CACHE_URLS = [
  '/api/auth/me',
  '/api/dashboard-stats',
  '/api/vehicles',
  '/api/visitors'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('SW: Installing service worker');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('SW: Caching static files');
        return cache.addAll(STATIC_CACHE_URLS.filter(url => url.startsWith('/')));
      }),
      caches.open(API_CACHE).then((cache) => {
        console.log('SW: API cache opened');
        return Promise.resolve();
      })
    ])
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('SW: Activating service worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
            console.log('SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle requests with cache strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
  }
  // Handle static resources
  else {
    event.respondWith(handleStaticRequest(request));
  }
});

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // For POST requests (registration, scan), always try network first
  if (request.method === 'POST') {
    try {
      const response = await fetch(request);
      
      // Store successful POST data for sync when online
      if (response.ok) {
        const clonedResponse = response.clone();
        const data = await clonedResponse.json();
        
        // Store offline data for sync
        if (url.pathname.includes('/visitor-registration') || 
            url.pathname.includes('/scan')) {
          await storeOfflineData(url.pathname, await request.clone().json(), data);
        }
      }
      
      return response;
    } catch (error) {
      // If network fails, store for later sync
      console.log('SW: Network failed, storing for offline sync');
      await storeOfflineData(url.pathname, await request.clone().json());
      
      return new Response(JSON.stringify({
        success: true,
        offline: true,
        message: 'Data stored for sync when online'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  // For GET requests, try network first, then cache
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      // Cache successful responses
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline message if no cache available
    return new Response(JSON.stringify({
      error: 'Offline - No cached data available',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle static requests with cache-first strategy
async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return cache.match('/');
    }
    
    throw error;
  }
}

// Store offline data for later synchronization
async function storeOfflineData(endpoint, requestData, responseData = null) {
  try {
    const offlineData = {
      endpoint,
      requestData,
      responseData,
      timestamp: new Date().toISOString(),
      synced: false
    };
    
    // Store in IndexedDB for persistence
    const db = await openDB();
    const transaction = db.transaction(['offline_data'], 'readwrite');
    const store = transaction.objectStore('offline_data');
    
    await store.add(offlineData);
    console.log('SW: Stored offline data for sync');
  } catch (error) {
    console.error('SW: Error storing offline data:', error);
  }
}

// Open IndexedDB for offline data storage
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('DAVehiclePassDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('offline_data')) {
        const store = db.createObjectStore('offline_data', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        store.createIndex('endpoint', 'endpoint', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };
  });
}

// Handle background sync for offline data
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-data') {
    console.log('SW: Background sync triggered');
    event.waitUntil(syncOfflineData());
  }
});

// Sync offline data when connection is restored
async function syncOfflineData() {
  try {
    const db = await openDB();
    const transaction = db.transaction(['offline_data'], 'readwrite');
    const store = transaction.objectStore('offline_data');
    
    const unsyncedData = await store.index('synced').getAll(false);
    
    for (const item of unsyncedData) {
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await getAuthToken()}`
          },
          body: JSON.stringify({
            visitor_registrations: item.endpoint.includes('visitor-registration') ? [item.requestData] : [],
            entry_exit_logs: item.endpoint.includes('scan') ? [item.requestData] : []
          })
        });
        
        if (response.ok) {
          // Mark as synced
          item.synced = true;
          await store.put(item);
          console.log('SW: Synced offline data item');
        }
      } catch (error) {
        console.error('SW: Error syncing item:', error);
      }
    }
  } catch (error) {
    console.error('SW: Error during sync:', error);
  }
}

// Get auth token from storage
async function getAuthToken() {
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // Request token from active client
      return new Promise((resolve) => {
        clients[0].postMessage({ type: 'GET_AUTH_TOKEN' });
        
        // Listen for response
        self.addEventListener('message', function handler(event) {
          if (event.data.type === 'AUTH_TOKEN_RESPONSE') {
            self.removeEventListener('message', handler);
            resolve(event.data.token);
          }
        });
      });
    }
  } catch (error) {
    console.error('SW: Error getting auth token:', error);
  }
  
  return null;
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body,
      icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Department_of_Agriculture_of_the_Philippines.svg/192x192px-Department_of_Agriculture_of_the_Philippines.svg.png',
      badge: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Department_of_Agriculture_of_the_Philippines.svg/96x96px-Department_of_Agriculture_of_the_Philippines.svg.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Open App',
          icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Department_of_Agriculture_of_the_Philippines.svg/96x96px-Department_of_Agriculture_of_the_Philippines.svg.png'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('SW: Service worker script loaded');