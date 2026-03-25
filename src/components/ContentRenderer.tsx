import katex from 'katex'
import 'katex/dist/katex.min.css'
import CodeBlock from './CodeBlock'

interface ContentRendererProps {
  content: string
  className?: string
  /** When true, suppresses block-level wrappers (for use inside <p> tags or inline contexts) */
  inline?: boolean
}

type Segment =
  | { type: 'text'; value: string }
  | { type: 'math-inline'; value: string }
  | { type: 'math-block'; value: string }
  | { type: 'code'; value: string; language: string }
  | { type: 'bold'; value: string }

type Block =
  | { type: 'code'; language: string; value: string }
  | { type: 'math-block'; value: string }
  | { type: 'text'; value: string }

/**
 * Splits content into atomic blocks BEFORE any inline parsing.
 * Only code fences and block math are extracted as atomic units.
 * All other text (including bold, inline math, etc.) stays as a plain text block
 * so it can be processed line-by-line without fragmenting sentences.
 */
function splitIntoBlocks(content: string): Block[] {
  const blocks: Block[] = []
  const BLOCK_REGEX = /```(\w+)?\n?([\s\S]*?)```|\$\$([\s\S]+?)\$\$/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = BLOCK_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    if (match[2] !== undefined || match[1] !== undefined) {
      // Code fence: group 1 = language, group 2 = body
      blocks.push({ type: 'code', language: match[1]?.trim() || 'python', value: match[2] ?? '' })
    } else if (match[3] !== undefined) {
      // Block math: group 3
      blocks.push({ type: 'math-block', value: match[3] })
    }
    lastIndex = BLOCK_REGEX.lastIndex
  }

  if (lastIndex < content.length) {
    blocks.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return blocks
}

/**
 * Renders inline content within a single list item or paragraph line.
 * Re-uses parseSegments so bold/math/code inside list items work correctly.
 */
function renderInline(text: string, key: string): React.ReactNode {
  const segments = parseSegments(text)
  return (
    <span key={key}>
      {segments.map((seg, i) => {
        if (seg.type === 'bold') {
          return <strong key={i} className="text-white font-semibold">{seg.value}</strong>
        }
        if (seg.type === 'math-inline') {
          return (
            <span key={i} dangerouslySetInnerHTML={{ __html: renderKatex(seg.value, false) }} />
          )
        }
        if (seg.type === 'math-block') {
          return (
            <span key={i} dangerouslySetInnerHTML={{ __html: renderKatex(seg.value, false) }} />
          )
        }
        if (seg.type === 'code') {
          return (
            <code key={i} className="bg-[#0d1117] text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono">
              {seg.value.trim()}
            </code>
          )
        }
        // plain text
        return <span key={i}>{seg.value}</span>
      })}
    </span>
  )
}

/**
 * Processes a plain text block line-by-line, grouping list lines into
 * <ul>/<ol> and rendering each paragraph line with renderInline() so
 * bold/math/code stay inline within the same sentence.
 *
 * This is the LINE-FIRST architecture: structure (list vs paragraph) is
 * detected on the full raw line BEFORE any inline formatting is applied,
 * so bold markers never fragment a sentence into separate block elements.
 */
function renderTextLines(text: string, blockKey: number): React.ReactNode[] {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = (idx: number) => {
    if (listItems.length === 0) return
    if (listType === 'ul') {
      result.push(
        <ul key={`${blockKey}-ul-${idx}`} className="list-disc list-outside ml-5 space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="text-[#cbd5e1] leading-relaxed">
              {renderInline(item, `${blockKey}-ul-${idx}-${i}`)}
            </li>
          ))}
        </ul>
      )
    } else {
      result.push(
        <ol key={`${blockKey}-ol-${idx}`} className="list-decimal list-outside ml-5 space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i} className="text-[#cbd5e1] leading-relaxed">
              {renderInline(item, `${blockKey}-ol-${idx}-${i}`)}
            </li>
          ))}
        </ol>
      )
    }
    listItems = []
    listType = null
  }

  lines.forEach((line, idx) => {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)/)
    const numberedMatch = line.match(/^\s*\d+\.\s+(.+)/)
    if (bulletMatch) {
      if (listType === 'ol') flushList(idx)
      listType = 'ul'
      listItems.push(bulletMatch[1])
    } else if (numberedMatch) {
      if (listType === 'ul') flushList(idx)
      listType = 'ol'
      listItems.push(numberedMatch[1])
    } else {
      flushList(idx)
      if (line.trim()) {
        result.push(
          <p key={`${blockKey}-p-${idx}`} className="leading-relaxed">
            {renderInline(line, `${blockKey}-p-${idx}`)}
          </p>
        )
      } else if (result.length > 0) {
        result.push(<div key={`${blockKey}-sp-${idx}`} className="h-2" />)
      }
    }
  })
  flushList(lines.length)

  return result
}

/**
 * Parses a content string into typed segments.
 * Handles (in order):
 *   1. ```lang\n...\n```  — code fences
 *   2. $$...$$            — block math
 *   3. $...$              — inline math
 *   4. **...**            — bold
 *
 * NOTE: This is used only by renderInline() (for processing individual lines)
 * and by the inline mode of ContentRenderer. It is NOT called at the top level
 * of block mode — splitIntoBlocks() handles the top level instead.
 */
function parseSegments(content: string): Segment[] {
  const segments: Segment[] = []
  // Regex: code fence | block math | inline math | bold
  const REGEX = /```(\w+)?\n?([\s\S]*?)```|\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\*\*(.+?)\*\*/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = REGEX.exec(content)) !== null) {
    // Push any plain text before this match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }

    if (match[2] !== undefined || match[1] !== undefined) {
      // Code fence: group 1 = language, group 2 = code body
      const lang = match[1]?.trim() || 'python'
      const code = match[2] ?? ''
      segments.push({ type: 'code', value: code, language: lang })
    } else if (match[3] !== undefined) {
      // Block math: group 3
      segments.push({ type: 'math-block', value: match[3] })
    } else if (match[4] !== undefined) {
      // Inline math: group 4
      segments.push({ type: 'math-inline', value: match[4] })
    } else if (match[5] !== undefined) {
      // Bold: group 5
      segments.push({ type: 'bold', value: match[5] })
    }

    lastIndex = REGEX.lastIndex
  }

  // Push any remaining plain text
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return segments
}

function renderKatex(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, { displayMode, throwOnError: false, output: 'html' })
  } catch {
    return latex
  }
}

export default function ContentRenderer({ content, className, inline = false }: ContentRendererProps) {
  if (!content) return null

  // ── Inline mode ──────────────────────────────────────────────────────────
  // Unchanged behaviour: render segments directly without block-level wrappers.
  if (inline) {
    const segments = parseSegments(content)
    return (
      <span className={className}>
        {segments.map((seg, i) => {
          if (seg.type === 'bold') {
            return <strong key={i} className="text-white font-semibold">{seg.value}</strong>
          }
          if (seg.type === 'math-inline' || seg.type === 'math-block') {
            return <span key={i} dangerouslySetInnerHTML={{ __html: renderKatex(seg.value, false) }} />
          }
          if (seg.type === 'code') {
            return (
              <code key={i} className="bg-[#0d1117] text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono">
                {seg.value.trim()}
              </code>
            )
          }
          return <span key={i}>{seg.value}</span>
        })}
      </span>
    )
  }

  // ── Block mode: LINE-FIRST architecture ───────────────────────────────────
  // 1. splitIntoBlocks extracts code fences and block math as atomic units.
  //    All other text (including bold, inline math, etc.) stays as one text block.
  // 2. Each text block is split into lines.
  // 3. Each line is classified (bullet / numbered / paragraph) BEFORE inline
  //    formatting is applied, so bold markers never fragment a sentence.
  const blocks = splitIntoBlocks(content)
  const rendered: React.ReactNode[] = []

  blocks.forEach((block, i) => {
    if (block.type === 'code') {
      rendered.push(<CodeBlock key={i} code={block.value} language={block.language} />)
    } else if (block.type === 'math-block') {
      rendered.push(
        <div
          key={i}
          className="my-3 overflow-x-auto text-center"
          dangerouslySetInnerHTML={{ __html: renderKatex(block.value, true) }}
        />
      )
    } else {
      // text block: process line by line
      const lines = renderTextLines(block.value, i)
      rendered.push(...lines)
    }
  })

  return <div className={className}>{rendered}</div>
}
