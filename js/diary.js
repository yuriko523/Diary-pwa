/**
 * diary.js — 日记数据层（CRUD + 标签 + 搜索 + 回收站）
 *
 * 数据结构：
 * {
 *   id:        "2026-06-21-1430",    // 日期-时间戳
 *   date:      "2026-06-21",
 *   createdAt: "2026-06-21T14:30:00+08:00",
 *   updatedAt: "2026-06-21T15:00:00+08:00",
 *   title:     "",
 *   content:   "## 今天...",
 *   tags:      ["生活", "工作"],
 *   mood:      null                   // 预留
 * }
 */

const Diary = {
  /** 获取全部日记（按日期倒序） */
  async getAll() {
    const entries = (await Storage.load('diary:entries')) || []
    return entries.sort((a, b) => new Date(b.date) - new Date(a.date))
  },

  /** 保存全部日记 */
  async saveAll(entries) {
    return await Storage.save('diary:entries', entries)
  },

  /** 按 date 获取 */
  async getByDate(date) {
    const all = await this.getAll()
    return all.filter(e => e.date === date)
  },

  /** 新增 */
  async add(entry) {
    const entries = await this.getAll()
    entries.unshift(entry)
    await this.saveAll(entries)
    // 更新标签库
    if (entry.tags && entry.tags.length) {
      await this.mergeTags(entry.tags)
    }
    return entry
  },

  /** 更新 */
  async update(id, updates) {
    const entries = await this.getAll()
    const idx = entries.findIndex(e => e.id === id)
    if (idx === -1) return null
    entries[idx] = { ...entries[idx], ...updates, updatedAt: new Date().toISOString() }
    await this.saveAll(entries)
    // 更新标签库
    if (updates.tags) await this.mergeTags(updates.tags)
    return entries[idx]
  },

  /** 删除 → 移入回收站 */
  async remove(id) {
    const entries = await this.getAll()
    const entry = entries.find(e => e.id === id)
    if (!entry) return null
    // 进回收站
    const trash = (await Storage.load('diary:trash')) || []
    trash.unshift({ ...entry, deletedAt: new Date().toISOString() })
    await Storage.save('diary:trash', trash)
    // 从日记列表移除
    const filtered = entries.filter(e => e.id !== id)
    await this.saveAll(filtered)
    return entry
  },

  // ─── 搜索 ───

  /** 全文搜索（关键词 / 日期 / 标签） */
  async search(query) {
    if (!query || !query.trim()) return this.getAll()
    const q = query.toLowerCase().trim()
    const all = await this.getAll()
    return all.filter(e =>
      e.content.toLowerCase().includes(q) ||
      (e.title && e.title.toLowerCase().includes(q)) ||
      (e.tags && e.tags.some(t => t.toLowerCase().includes(q)))
    )
  },

  // ─── 标签 ───

  /** 获取所有已使用的标签 */
  async getTags() {
    return (await Storage.load('diary:tags')) || []
  },

  /** 合并标签到标签库 */
  async mergeTags(tags) {
    if (!tags || !tags.length) return
    const existing = await this.getTags()
    let changed = false
    for (const t of tags) {
      if (!existing.includes(t)) {
        existing.push(t)
        changed = true
      }
    }
    if (changed) await Storage.save('diary:tags', existing)
  },

  /** 按标签筛选 */
  async getByTag(tag) {
    const all = await this.getAll()
    if (!tag) return all
    return all.filter(e => e.tags && e.tags.includes(tag))
  },

  // ─── 回收站 ───

  /** 获取回收站 */
  async getTrash() {
    return (await Storage.load('diary:trash')) || []
  },

  /** 从回收站恢复 */
  async restore(id) {
    const trash = await this.getTrash()
    const idx = trash.findIndex(e => e.id === id)
    if (idx === -1) return null
    const entry = trash[idx]
    trash.splice(idx, 1)
    await Storage.save('diary:trash', trash)
    // 放回日记
    delete entry.deletedAt
    await this.add(entry)
    return entry
  },

  /** 永久删除 */
  async permanentDelete(id) {
    const trash = await this.getTrash()
    const filtered = trash.filter(e => e.id !== id)
    if (filtered.length !== trash.length) {
      await Storage.save('diary:trash', filtered)
      return true
    }
    return false
  },

  /** 清理过期回收站（超过 30 天） */
  async purgeTrash() {
    const trash = await this.getTrash()
    const now = Date.now()
    const kept = trash.filter(e => {
      const deletedAt = new Date(e.deletedAt).getTime()
      return (now - deletedAt) < 30 * 24 * 60 * 60 * 1000
    })
    if (kept.length !== trash.length) {
      await Storage.save('diary:trash', kept)
    }
  },

  // ─── 工具 ───

  /** 生成新 ID */
  generateId(dateStr) {
    const now = new Date()
    const ts = String(now.getHours()).padStart(2, '0')
              + String(now.getMinutes()).padStart(2, '0')
    return `${dateStr}-${ts}`
  },

  /** 格式化日期 */
  formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${dateStr} ${weekdays[d.getDay()]}`
  }
}
