/**
 * app.js — 随手记主控制器（V2）
 *
 * 布局：首页 = 列表/月视图 tab + FAB，编辑器 = 全屏页
 */
;(async function() {
'use strict'

// ─── 状态 ───
const state = {
  entries: [],
  editingEntry: null,     // 编辑器中正在编辑的条目（null=新建）
  editingDate: null,      // 编辑器当前日期
  currentPage: 'main',    // 'main' | 'editor' | 'settings'
  currentTab: 'list',     // 'list' | 'calendar'
  filterTag: null,
  theme: 'light',
  searchQuery: '',
  calYear: 0,
  calMonth: 0,
}

const $ = id => document.getElementById(id)
const dom = {}

function cacheDom() {
  dom.header = document.querySelector('.header')
  dom.themeBtn = $('themeBtn')
  dom.settingsBtn = $('settingsBtn')
  dom.trashBtn = $('trashBtn')

  dom.tabList = $('tabList')
  dom.tabCalendar = $('tabCalendar')

  dom.searchInput = $('searchInput')
  dom.searchClear = $('searchClear')

  dom.diaryList = $('diaryList')
  dom.emptyState = $('emptyState')

  dom.calPrev = $('calPrev')
  dom.calNext = $('calNext')
  dom.calTitle = $('calTitle')
  dom.calGrid = $('calGrid')

  dom.fab = $('fabBtn')
  dom.toast = $('toast')

  // 编辑器
  dom.editorBack = $('editorBack')
  dom.editorSave = $('editorSave')
  dom.editorDate = $('editorDate')
  dom.toolbar = $('toolbar')
  dom.textarea = $('diaryTextarea')
  dom.preview = $('preview')
  dom.tagInput = $('tagInput')
  dom.tagAddBtn = $('tagAddBtn')
  dom.tagSelector = $('tagSelector')

  // 设置页
  dom.settingsBack = $('settingsBack')
  dom.trashList = $('trashList')
  dom.emptyTrash = $('emptyTrash')
  dom.exportJsonBtn = $('exportJsonBtn')
  dom.exportMdBtn = $('exportMdBtn')
  dom.importBtn = $('importBtn')
  dom.importFile = $('importFile')

  dom.pages = {
    main: $('pageMain'),
    editor: $('pageEditor'),
    settings: $('pageSettings'),
  }
}

// ════════════════════════════════════════
//  初始化
// ════════════════════════════════════════

async function init() {
  try {
    cacheDom()
    await loadData()
    renderToolbar()
    bindEvents()
    switchPage('main')
    switchTab('list')
    renderCalendar()
    Diary.purgeTrash()
  } catch (e) {
    console.error('Init 失败:', e)
    const errDiv = document.createElement('div')
    errDiv.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#c0392b;color:white;padding:16px;font-size:13px;z-index:9999;font-family:monospace;white-space:pre-wrap;'
    errDiv.textContent = '❌ 错误: ' + (e.message || e) + '\n' + (e.stack || '')
    document.body.appendChild(errDiv)
  }
}

async function loadData() {
  state.entries = await Diary.getAll()
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ════════════════════════════════════════
//  页面切换
// ════════════════════════════════════════

function switchPage(page) {
  state.currentPage = page
  Object.keys(dom.pages).forEach(k => {
    dom.pages[k].classList.toggle('active', k === page)
  })
  // FAB only visible on main page
  dom.fab.style.display = page === 'main' ? '' : 'none'
  // 编辑器保存状态重置
  if (page !== 'editor') {
    dom.editorSave.textContent = '💾 保存'
    dom.editorSave.className = 'editor-save-btn'
    dom.editorSave.disabled = false
  }
  if (page === 'main') {
    renderList()
    if (state.currentTab === 'calendar') renderCalendar()
  }
  if (page === 'settings') renderTrash()
}

// ════════════════════════════════════════
//  Tab 切换
// ════════════════════════════════════════

function switchTab(tab) {
  state.currentTab = tab
  dom.tabList.classList.toggle('active', tab === 'list')
  dom.tabCalendar.classList.toggle('active', tab === 'calendar')
  document.getElementById('viewList').classList.toggle('active', tab === 'list')
  document.getElementById('viewCalendar').classList.toggle('active', tab === 'calendar')
  if (tab === 'list') renderList()
  if (tab === 'calendar') renderCalendar()
}

// ════════════════════════════════════════
//  渲染日记列表
// ════════════════════════════════════════

function renderList(entries) {
  const list = entries || state.entries
  const q = state.searchQuery.toLowerCase().trim()
  let filtered = list
  if (q) {
    filtered = list.filter(e =>
      e.content.toLowerCase().includes(q) ||
      (e.title && e.title.toLowerCase().includes(q)) ||
      (e.tags && e.tags.some(t => t.toLowerCase().includes(q)))
    )
  }
  if (state.filterTag) {
    filtered = filtered.filter(e => e.tags && e.tags.includes(state.filterTag))
  }

  if (!filtered.length) {
    dom.diaryList.innerHTML = ''
    dom.emptyState.style.display = ''
    return
  }
  dom.emptyState.style.display = 'none'

  dom.diaryList.innerHTML = filtered.map(e => {
    const summary = (e.content || '').replace(/[#*`>\-\[\]()]/g, '').substring(0, 100)
    const tags = (e.tags || []).map(t => `<span>${t}</span>`).join('')
    return `
      <div class="diary-item" data-id="${e.id}" data-date="${e.date}">
        <div class="item-date">${e.date}</div>
        <div class="item-title">${e.title || '无题'}</div>
        <div class="item-summary">${summary || '(空)'}</div>
        ${tags ? `<div class="item-tags">${tags}</div>` : ''}
      </div>
    `
  }).join('')
}

// ════════════════════════════════════════
//  日历（内嵌月视图）
// ════════════════════════════════════════

function renderCalendar() {
  const now = new Date()
  const y = state.calYear || now.getFullYear()
  const m = state.calMonth !== undefined ? state.calMonth : now.getMonth()
  state.calYear = y; state.calMonth = m

  const months = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
  dom.calTitle.textContent = `${y}年 ${months[m]}`

  const firstDay = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const today = todayStr()

  // 有日记的日期
  const hasEntry = {}
  state.entries.forEach(e => { hasEntry[e.date] = true })

  const cells = []
  const wds = ['日','一','二','三','四','五','六']
  wds.forEach(w => cells.push(`<div class="cal-weekday">${w}</div>`))

  // 上月填充
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push('<div class="cal-day other-month"></div>')
  }
  // 当月
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const isToday = ds === today
    const hasDot = hasEntry[ds]
    cells.push(`<div class="cal-day${isToday?' today':''}" data-date="${ds}">
      ${d}${hasDot ? '<div class="cal-dot"></div>' : ''}
    </div>`)
  }

  dom.calGrid.innerHTML = cells.join('')

  // 点击日期
  dom.calGrid.querySelectorAll('.cal-day:not(.other-month)').forEach(el => {
    el.onclick = () => {
      const date = el.dataset.date
      if (date) {
        // 先切到列表 tab 并跳转到该日
        switchTab('list')
        // 过滤显示该日日记
        const dayEntries = state.entries.filter(e => e.date === date)
        if (dayEntries.length) {
          renderList(dayEntries)
        } else {
          // 该日无日记 → 打开编辑器新建
          openEditor(null, date)
        }
        toast(`📅 ${date}`)
      }
    }
  })
}

// ════════════════════════════════════════
//  编辑器
// ════════════════════════════════════════

function openEditor(entry, date) {
  state.editingEntry = entry || null
  state.editingDate = date || todayStr()
  dom.editorDate.textContent = state.editingDate

  if (entry) {
    dom.textarea.value = entry.content || ''
    dom.editorSave.textContent = '💾 保存'
    dom.editorSave.className = 'editor-save-btn'
  } else {
    dom.textarea.value = ''
    dom.editorSave.textContent = '💾 保存'
    dom.editorSave.className = 'editor-save-btn'
  }
  updatePreview()
  renderTags(entry ? (entry.tags || []) : [])
  switchPage('editor')
  dom.textarea.focus()
}

function updatePreview() {
  dom.preview.innerHTML = Markdown.render(dom.textarea.value)
}

function getCurrentTags() {
  return [...currentTags]
}
let currentTags = []

function renderTags(tags) {
  currentTags = [...tags]
  dom.tagSelector.innerHTML = ''
  tags.forEach(t => {
    const span = document.createElement('span')
    span.className = 'tag-chip active'
    span.innerHTML = `${t} <span class="remove">✕</span>`
    span.onclick = () => {
      currentTags = currentTags.filter(x => x !== t)
      renderTags(currentTags)
    }
    dom.tagSelector.appendChild(span)
  })
}

async function addTag(tag) {
  tag = tag.trim()
  if (!tag || currentTags.includes(tag)) return
  currentTags.push(tag)
  renderTags(currentTags)
  dom.tagInput.value = ''
  await Diary.mergeTags([tag])
}

async function saveEntry() {
  const content = dom.textarea.value.trim()
  if (!content) { toast('写点内容再保存吧'); return }

  dom.editorSave.textContent = '保存中…'
  dom.editorSave.className = 'editor-save-btn saving'
  dom.editorSave.disabled = true

  const tags = getCurrentTags()
  const date = state.editingDate

  try {
    if (state.editingEntry) {
      // 更新现有条目
      await Diary.update(state.editingEntry.id, { content, tags, updatedAt: new Date().toISOString() })
      const idx = state.entries.findIndex(e => e.id === state.editingEntry.id)
      if (idx !== -1) {
        state.entries[idx].content = content
        state.entries[idx].tags = tags
        state.entries[idx].updatedAt = new Date().toISOString()
        state.entries[idx].date = date
      }
    } else {
      // 新建
      const id = Diary.generateId(date)
      const entry = {
        id, date,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        title: '',
        content, tags,
        mood: null,
      }
      await Diary.add(entry)
      state.entries.unshift(entry)
      state.editingEntry = entry
    }

    dom.editorSave.textContent = '✅ 已保存'
    dom.editorSave.className = 'editor-save-btn saved'
    toast('已保存')
    // 延迟一下自动返回
    setTimeout(() => closeEditor(), 600)
  } catch (e) {
    dom.editorSave.textContent = '💾 保存'
    dom.editorSave.className = 'editor-save-btn'
    dom.editorSave.disabled = false
    toast('保存失败')
    console.error(e)
  }
}

function closeEditor() {
  dom.editorSave.textContent = '💾 保存'
  dom.editorSave.className = 'editor-save-btn'
  dom.editorSave.disabled = false
  state.editingEntry = null
  switchPage('main')
  renderList()
  if (state.currentTab === 'calendar') renderCalendar()
}

// ════════════════════════════════════════
//  格式工具栏
// ════════════════════════════════════════

function renderToolbar() {
  const btns = Markdown.getToolbarButtons()
  dom.toolbar.innerHTML = btns.map(b =>
    `<button data-fmt="${b.id}" title="${b.title}">${b.label}</button>`
  ).join('')
}

// ════════════════════════════════════════
//  搜索
// ════════════════════════════════════════

function doSearch() {
  state.searchQuery = dom.searchInput.value
  if (state.currentTab !== 'list') switchTab('list')
  renderList()
}

function resetSearch() {
  dom.searchInput.value = ''
  state.searchQuery = ''
  renderList()
}

// ════════════════════════════════════════
//  主题
// ════════════════════════════════════════

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', state.theme)
  localStorage.setItem('diary:theme', state.theme)
  dom.themeBtn.textContent = state.theme === 'light' ? '🌙' : '☀️'
}

function loadTheme() {
  const saved = localStorage.getItem('diary:theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  state.theme = saved || (prefersDark ? 'dark' : 'light')
  document.documentElement.setAttribute('data-theme', state.theme)
  dom.themeBtn.textContent = state.theme === 'light' ? '🌙' : '☀️'
}

// ════════════════════════════════════════
//  回收站
// ════════════════════════════════════════

async function renderTrash() {
  const trash = await Diary.getTrash()
  if (!trash.length) {
    dom.trashList.innerHTML = ''
    dom.emptyTrash.style.display = ''
    return
  }
  dom.emptyTrash.style.display = 'none'
  dom.trashList.innerHTML = trash.map(e => {
    const summary = (e.content || '').replace(/[#*`>\-\[\]()]/g, '').substring(0, 80)
    return `
      <div class="diary-item" data-id="${e.id}">
        <div class="item-date">${e.date}</div>
        <div class="item-summary">${summary || '(空)'}</div>
        <div style="display:flex;gap:8px;margin-top:6px;justify-content:flex-end;">
          <button class="settings-btn" style="color:var(--accent);" data-action="restore" data-id="${e.id}">↩ 恢复</button>
          <button class="settings-btn" style="color:var(--danger);" data-action="permadelete" data-id="${e.id}">🗑 永久删除</button>
        </div>
      </div>
    `
  }).join('')
}

// ════════════════════════════════════════
//  导出 / 导入
// ════════════════════════════════════════

function exportJSON() {
  const data = { version: 1, exportedAt: new Date().toISOString(), entries: state.entries }
  const tagSet = new Set()
  state.entries.forEach(e => (e.tags || []).forEach(t => tagSet.add(t)))
  data.tags = [...tagSet]
  downloadFile(JSON.stringify(data, null, 2), `随手记-备份-${todayStr()}.json`, 'application/json')
  toast('JSON 已导出')
}

async function exportMarkdown() {
  if (!state.entries.length) { toast('没有可导出的日记'); return }
  const lines = state.entries.map(e => {
    const tags = (e.tags || []).join(', ')
    return `# ${e.title || e.date}\n\n${e.content}\n\n---\n*${e.date}${tags ? ' | ' + tags : ''}*\n\n`
  }).join('\n')
  downloadFile(lines, `随手记-日记-${todayStr()}.md`, 'text/markdown')
  toast('Markdown 已导出')
}

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function handleImport(file) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result)
      if (!data.entries || !Array.isArray(data.entries)) { toast('格式错误'); return }
      const mode = confirm('点击"确定"合并导入，点击"取消"覆盖现有数据。')
      if (mode) {
        const existingIds = new Set(state.entries.map(en => en.id))
        const newEntries = data.entries.filter(en => !existingIds.has(en.id))
        state.entries = [...state.entries, ...newEntries].sort((a, b) => b.date.localeCompare(a.date))
      } else {
        state.entries = data.entries.sort((a, b) => b.date.localeCompare(a.date))
      }
      await Diary.saveAll(state.entries)
      renderList()
      toast(`导入成功（${data.entries.length} 篇）`)
    } catch (err) {
      toast('导入失败：文件格式错误'); console.error(err)
    }
  }
  reader.readAsText(file)
  dom.importFile.value = ''
}

// ════════════════════════════════════════
//  删除日记
// ════════════════════════════════════════

async function deleteEntry(id) {
  if (!confirm('确定要删除这篇日记吗？')) return
  await Diary.remove(id)
  state.entries = state.entries.filter(e => e.id !== id)
  renderList()
  toast('已移至回收站')
}

// ════════════════════════════════════════
//  Toast
// ════════════════════════════════════════

function toast(msg) {
  const el = document.createElement('div')
  el.className = 'toast'
  el.textContent = msg
  dom.toast.appendChild(el)
  setTimeout(() => {
    el.classList.add('removing')
    setTimeout(() => el.remove(), 250)
  }, 2000)
}

// ════════════════════════════════════════
//  事件绑定
// ════════════════════════════════════════

function bindEvents() {
  // ── Tab 切换 ──
  dom.tabList.addEventListener('click', () => switchTab('list'))
  dom.tabCalendar.addEventListener('click', () => switchTab('calendar'))

  // ── 日历导航 ──
  dom.calPrev.addEventListener('click', () => {
    state.calMonth--
    if (state.calMonth < 0) { state.calMonth = 11; state.calYear-- }
    renderCalendar()
  })
  dom.calNext.addEventListener('click', () => {
    state.calMonth++
    if (state.calMonth > 11) { state.calMonth = 0; state.calYear++ }
    renderCalendar()
  })

  // ── FAB ──
  dom.fab.addEventListener('click', () => openEditor(null))

  // ── 编辑器 ──
  dom.editorBack.addEventListener('click', closeEditor)
  dom.editorSave.addEventListener('click', saveEntry)

  dom.textarea.addEventListener('input', updatePreview)

  // 工具栏
  dom.toolbar.addEventListener('click', e => {
    const btn = e.target.closest('[data-fmt]')
    if (!btn) return
    const fmt = btn.dataset.fmt
    const config = Markdown.getToolbarButtons().find(b => b.id === fmt)
    if (config) Markdown.applyFormat(dom.textarea, config)
  })

  // 标签
  dom.tagAddBtn.addEventListener('click', () => addTag(dom.tagInput.value))
  dom.tagInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addTag(dom.tagInput.value) }
  })

  // ── 搜索 ──
  dom.searchInput.addEventListener('input', doSearch)
  dom.searchClear.addEventListener('click', resetSearch)

  // ── 主题 ──
  dom.themeBtn.addEventListener('click', toggleTheme)

  // ── 设置 / 回收站 ──
  dom.settingsBtn.addEventListener('click', () => switchPage('settings'))
  dom.settingsBack.addEventListener('click', () => switchPage('main'))
  dom.trashBtn.addEventListener('click', () => switchPage('settings'))

  // ── 导出/导入 ──
  dom.exportJsonBtn.addEventListener('click', exportJSON)
  dom.exportMdBtn.addEventListener('click', exportMarkdown)
  dom.importBtn.addEventListener('click', () => dom.importFile.click())
  dom.importFile.addEventListener('change', e => handleImport(e.target.files[0]))

  // ── 回收站操作 ──
  dom.trashList.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]')
    if (!btn) return
    const id = btn.dataset.id
    if (btn.dataset.action === 'restore') {
      const entry = await Diary.restore(id)
      if (entry) { state.entries.unshift(entry); renderTrash(); renderList(); toast('已恢复') }
    } else if (btn.dataset.action === 'permadelete') {
      if (confirm('确定要永久删除吗？')) {
        await Diary.permanentDelete(id); renderTrash(); toast('已永久删除')
      }
    }
  })

  // ── 点击日记条目 → 编辑 ──
  dom.diaryList.addEventListener('click', e => {
    const item = e.target.closest('.diary-item')
    if (!item || e.target.closest('[data-action]')) return
    const id = item.dataset.id
    const entry = state.entries.find(en => en.id === id)
    if (entry) openEditor(entry)
  })

  // ── 键盘 ──
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (state.currentPage === 'editor') saveEntry()
    }
    if (e.key === 'Escape') {
      if (state.currentPage === 'editor') closeEditor()
      if (state.currentPage === 'settings') switchPage('main')
    }
  })
}

// ════════════════════════════════════════
//  启动
// ════════════════════════════════════════

loadTheme()
init()
})()
