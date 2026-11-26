import { escapeHtml } from './utils.js'

function renderInline(escapedText) {
  const codeSpans = []
  let output = escapedText.replace(/`([^`\n]+)`/g, (_match, code) => {
    codeSpans.push(code)
    return `\u0000${codeSpans.length - 1}\u0000`
  })

  output = output.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
    if (!/^(https?:\/\/|mailto:)/i.test(url)) return match
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
  })

  output = output.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  output = output.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  output = output.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  output = output.replace(/(^|[\s(])_([^_\n]+)_/g, '$1<em>$2</em>')

  output = output.replace(/\u0000(\d+)\u0000/g, (_match, index) => {
    return `<code>${codeSpans[Number(index)]}</code>`
  })

  return output
}

function isBlockStart(line) {
  return (
    /^\s*$/.test(line) ||
    /^```/.test(line) ||
    /^#{1,6}\s+/.test(line) ||
    /^\s*>\s?/.test(line) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    /^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)
  )
}

/** Renders a safe subset of Markdown (escaping all raw HTML first). */
export function renderMarkdown(source) {
  if (!source || !source.trim()) {
    return '<p class="empty-preview">Sin contenido todavía.</p>'
  }

  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const html = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (/^\s*$/.test(line)) {
      index += 1
      continue
    }

    const fence = line.match(/^```\s*([A-Za-z0-9_+-]*)\s*$/)
    if (fence) {
      const code = []
      index += 1
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      const language = fence[1] ? ` class="language-${fence[1]}"` : ''
      html.push(`<pre><code${language}>${escapeHtml(code.join('\n'))}</code></pre>`)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${renderInline(escapeHtml(heading[2].trim()))}</h${level}>`)
      index += 1
      continue
    }

    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      html.push('<hr>')
      index += 1
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = []
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(renderInline(escapeHtml(lines[index].replace(/^\s*>\s?/, ''))))
        index += 1
      }
      html.push(`<blockquote><p>${quote.join('<br>')}</p></blockquote>`)
      continue
    }

    const unordered = line.match(/^\s*[-*+]\s+(.*)$/)
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    if (unordered || ordered) {
      const tag = unordered ? 'ul' : 'ol'
      const pattern = unordered ? /^\s*[-*+]\s+(.*)$/ : /^\s*\d+[.)]\s+(.*)$/
      const items = []
      while (index < lines.length) {
        const item = lines[index].match(pattern)
        if (!item) break
        items.push(`<li>${renderInline(escapeHtml(item[1]))}</li>`)
        index += 1
      }
      html.push(`<${tag}>${items.join('')}</${tag}>`)
      continue
    }

    const paragraph = [line]
    index += 1
    while (index < lines.length && !isBlockStart(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    html.push(`<p>${paragraph.map((part) => renderInline(escapeHtml(part))).join(' ')}</p>`)
  }

  return html.join('\n')
}
