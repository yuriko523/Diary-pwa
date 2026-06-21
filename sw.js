/**
 * sw.js — Service Worker
 *
 * 策略：install 时预缓存所有静态资源，activate 时清理旧缓存。
 * 离线时所有页面和资源仍可用（数据读写不依赖网络）。
 */

const CACHE_NAME = 'diary-static-v2'
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/storage.js',
  '/js/markdown.js',
  '/js/diary.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// 安装：预缓存
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS)
    })
  )
  self.skipWaiting()
})

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    })
  )
  self.clients.claim()
})

// 拦截请求：Cache-first
self.addEventListener('fetch', event => {
  // 只缓存同源 GET 请求
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // 动态缓存新请求
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})
