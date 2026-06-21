/**
 * markdown.js — 轻量 Markdown 渲染器 + 格式工具栏
 *
 * 支持语法：标题(#)、粗体(**)、斜体(*)、列表(- / 1.)、
 *          引用(>)、行内代码(`)、代码块(```)、链接([text](url))
 *
 * 不依赖任何外部库。
 */

const Markdown = {
  /**
   * 将 Markdown 文本渲染为 HTML
   * @param {string} md
   * @returns {string}
   */
  render(md) {
    if (!md) return ''
    let html = md

    // 转义 HTML 特殊字符（防 XSS）
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    // 代码块（必须在其他行处理之前）
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code${lang ? ` class="lang-${lang}"` : ''}>${code.trim()}</code></pre>`
    })

    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

    // 链接 [text](url)
    html = html.replace(/\[([^\]]+)]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')

    // 粗体 **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

    // 斜体 *text*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

    // 行 → 分行处理
    const lines = html.split('\n')
    const result = []
    let inBlockquote = false
    let inList = false
    let inOrderedList = false
    let inParagraph = false

    function closeParagraph() {
      if (inParagraph) { result.push('</p>'); inParagraph = false }
    }
    function closeList() {
      if (inList) { result.push('</ul>'); inList = false }
    }
    function closeOrderedList() {
      if (inOrderedList) { result.push('</ol>'); inOrderedList = false }
    }
    function closeBlockquote() {
      if (inBlockquote) { result.push('</blockquote>'); inBlockquote = false }
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()

      // 空行
      if (!trimmed) {
        closeParagraph()
        closeList()
        closeOrderedList()
        closeBlockquote()
        continue
      }

      // 标题
      if (/^#{1,3}\s/.test(trimmed)) {
        closeParagraph(); closeList(); closeOrderedList(); closeBlockquote()
        const level = trimmed.match(/^(#+)/)[1].length
        result.push(`<h${level}>${trimmed.replace(/^#+\s/, '')}</h${level}>`)
        continue
      }

      // 引用
      if (/^>\s?/.test(trimmed)) {
        closeParagraph(); closeList(); closeOrderedList()
        if (!inBlockquote) { result.push('<blockquote>'); inBlockquote = true }
        result.push(trimmed.replace(/^>\s?/, ''))
        if (i + 1 >= lines.length || !lines[i + 1].trim().startsWith('>')) {
          result.push('</blockquote>'); inBlockquote = false
        }
        continue
      }

      // 无序列表
      if (/^[-*+]\s/.test(trimmed)) {
        closeParagraph(); closeOrderedList(); closeBlockquote()
        if (!inList) { result.push('<ul>'); inList = true }
        result.push(`<li>${trimmed.replace(/^[-*+]\s/, '')}</li>`)
        if (i + 1 >= lines.length || !/^[-*+]\s/.test(lines[i + 1].trim())) {
          result.push('</ul>'); inList = false
        }
        continue
      }

      // 有序列表
      if (/^\d+\.\s/.test(trimmed)) {
        closeParagraph(); closeList(); closeBlockquote()
        if (!inOrderedList) { result.push('<ol>'); inOrderedList = true }
        result.push(`<li>${trimmed.replace(/^\d+\.\s/, '')}</li>`)
        if (i + 1 >= lines.length || !/^\d+\.\s/.test(lines[i + 1].trim())) {
          result.push('</ol>'); inOrderedList = false
        }
        continue
      }

      // 普通段落
      if (!inParagraph) {
        closeList(); closeOrderedList(); closeBlockquote()
        result.push('<p>')
        inParagraph = true
      } else {
        result.push('<br>')
      }
      result.push(trimmed)
    }
    closeParagraph()
    closeList()
    closeOrderedList()
    closeBlockquote()

    return result.join('\n')
  },

  /**
   * 获取格式工具栏按钮配置
   */
  getToolbarButtons() {
    return [
      { id: 'bold',      label: 'B',   title: '粗体',    prefix: '**',  suffix: '**',    wrap: true },
      { id: 'italic',    label: 'I',   title: '斜体',    prefix: '*',   suffix: '*',     wrap: true },
      { id: 'heading1',  label: 'H1',  title: '一级标题', prefix: '# ',  suffix: '',      wrap: false },
      { id: 'heading2',  label: 'H2',  title: '二级标题', prefix: '## ', suffix: '',      wrap: false },
      { id: 'heading3',  label: 'H3',  title: '三级标题', prefix: '### ',suffix: '',      wrap: false },
      { id: 'list',      label: '•',   title: '无序列表', prefix: '- ',  suffix: '',      wrap: false },
      { id: 'olist',     label: '1.',  title: '有序列表', prefix: '1. ', suffix: '',      wrap: false },
      { id: 'quote',     label: '❝',  title: '引用',    prefix: '> ',  suffix: '',      wrap: false },
      { id: 'code',      label: '</>', title: '行内代码', prefix: '`',   suffix: '`',     wrap: true },
      { id: 'link',      label: '🔗',  title: '链接',    prefix: '[',   suffix: '](url)', wrap: true },
    ]
  },

  /**
   * 对 textarea 选中文本应用格式
   * @param {HTMLTextAreaElement} textarea
   * @param {object} btn - 按钮配置
   */
  applyFormat(textarea, btn) {
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selected = text.substring(start, end)

    let replacement
    let cursorOffset

    if (btn.wrap) {
      // 包裹模式：**选中文本**
      replacement = btn.prefix + selected + btn.suffix
      cursorOffset = replacement.length
    } else {
      // 前缀模式：# 选中文本
      // 先检查当前行是否已有此前缀
      const lineStart = text.lastIndexOf('\n', start - 1) + 1
      const line = text.substring(lineStart, end || start)
      if (line.startsWith(btn.prefix.trim())) {
        // 已有前缀 → 去掉
        replacement = line.replace(btn.prefix, '')
        // 重新拼接
        const before = text.substring(0, lineStart)
        const after = text.substring(end)
        textarea.value = before + replacement + after
        textarea.selectionStart = textarea.selectionEnd = lineStart + replacement.length
      } else {
        replacement = btn.prefix + line
        const before = text.substring(0, lineStart)
        const after = text.substring(end)
        textarea.value = before + replacement + after
        const newEnd = lineStart + replacement.length
        textarea.selectionStart = start + btn.prefix.length
        textarea.selectionEnd = newEnd
      }
      textarea.dispatchEvent(new Event('input'))
      return
    }

    const before = text.substring(0, start)
    const after = text.substring(end)
    textarea.value = before + replacement + after
    textarea.selectionStart = start
    textarea.selectionEnd = start + cursorOffset
    textarea.focus()
    textarea.dispatchEvent(new Event('input'))
  }
}
