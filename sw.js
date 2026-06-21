/**
 * sw.js — Service Worker（自动适配子目录部署）
 *
 * 自动检测部署路径（支持根目录 / GitHub Pages 子目录），
 * 所有资源路径基于 SW 自身位置计算，无需硬编码。
 */

const CACHE_NAME = 'diary-static-v4'

// 自动计算部署根路径（例如 / 或 /Diary-pwa/）
const BASE = self.location.pathname.replace(/\/sw\.js$/, '') || ''
const ASSETS = [
  BASE + '/index.html',
  BASE + '/css/style.css',
  BASE + '/js/storage.js',
  BASE + '/js/markdown.js',
  BASE + '/js/diary.js',
  BASE + '/js/app-latest.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon.svg',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
].filter(Boolean)

// 安装：预缓存静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url).catch(() => {})))
    )
  )
  self.skipWaiting()
})

// 激活：清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// 拦截请求：Cache-first
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  // 如果请求的是部署根路径（/ 或 /Diary-pwa/），指向 index.html
  let url = event.request.url
  const path = new URL(url).pathname.replace(/\/$/, '')
  const indexPath = BASE + '/index.html'
  if (path === BASE || path === BASE + '') {
    url = self.location.origin + indexPath
  }

  event.respondWith(
    caches.match(url).then(cached =>
      cached || fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(url, clone))
        }
        return response
      })
    ).catch(() => fetch(event.request))
  )
})
