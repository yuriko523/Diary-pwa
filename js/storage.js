/**
 * storage.js — 三段式持久化存储
 *
 * 写入策略：
 *   ① localStorage（小数据，<5MB）
 *   ② Cache API（大数据，几百 MB，MIUI 兼容）
 *   ③ IndexedDB（预留兜底）
 *
 * 读取策略同上反向。
 *
 * ⏳ 加密预留：save() 的 data 入参和 load() 的返回值是天然的 hook 点，
 *    以后加密层包装 Storage.save / Storage.load 即可，本文件无需修改。
 */

const Storage = {
  CACHE_NAME: 'diary-data',

  /**
   * 保存数据（自动三段式降级）
   * @param {string} key   存储键名
   * @param {*}      data  任意 JSON 可序列化数据
   * @returns {boolean} 是否写入成功
   */
  async save(key, data) {
    const raw = JSON.stringify(data)

    // 1. localStorage
    try {
      localStorage.setItem(key, raw)
      return true
    } catch (e) {
      if (e.name !== 'QuotaExceededError') throw e
      // QuotaExceeded → 降级到 Cache API
    }

    // 2. Cache API
    try {
      const cache = await caches.open(this.CACHE_NAME)
      await cache.put(key, new Response(raw, {
        headers: { 'Content-Type': 'application/json' }
      }))
      return true
    } catch (e) {
      console.error('[Storage] Cache 写入失败:', e)
    }

    // 3. IndexedDB（预留）
    return false
  },

  /**
   * 读取数据
   * @param {string} key
   * @returns {* | null}
   */
  async load(key) {
    // 1. localStorage
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      try { return JSON.parse(raw) } catch (_) {}
    }

    // 2. Cache API
    try {
      const cache = await caches.open(this.CACHE_NAME)
      const resp = await cache.match(key)
      if (resp) {
        const text = await resp.text()
        return JSON.parse(text)
      }
    } catch (_) {}

    // 3. IndexedDB（预留）
    return null
  },

  /**
   * 删除指定 key
   */
  async remove(key) {
    localStorage.removeItem(key)
    try {
      const cache = await caches.open(this.CACHE_NAME)
      await cache.delete(key)
    } catch (_) {}
  },

  /**
   * 清除所有应用数据（保留缓存仓库本身）
   */
  async clear() {
    const keys = ['diary:entries', 'diary:trash', 'diary:tags', 'diary:theme', 'diary:settings']
    for (const k of keys) localStorage.removeItem(k)
    await caches.delete(this.CACHE_NAME)
  }
}
