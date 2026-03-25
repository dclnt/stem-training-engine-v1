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

/** Renders a plain-text block with support for bullet (-) and numbered (1.) list lines. */
function renderTextBlock(text: string, key: number): React.ReactNode {
  const lines = text.split('\n')
  const result: React.ReactNode[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  const flushList = (idx: number) => {
    if (listItems.length === 0) return
    if (listType === 'ul') {
      result.push(
        <ul key={`${key}-ul-${idx}`} className="list-disc list-outside ml-5 space-y-1 my-2">
          {listItems.map((item, i) => <li key={i} className="text-[#cbd5e1] leading-relaxed">{item}</li>)}
        </ul>
      )
    } else {
      result.push(
        <ol key={`${key}-ol-${idx}`} className="list-decimal list-outside ml-5 space-y-1 my-2">
          {listItems.map((item, i) => <li key={i} className="text-[#cbd5e1] leading-relaxed">{item}</li>)}
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
        result.push(<span key={`${key}-t-${idx}`} className="block">{line}</span>)
      } else if (result.length > 0) {
        result.push(<span key={`${key}-br-${idx}`} className="block h-2" />)
      }
    }
  })
  flushList(lines.length)

  return <span key={key}>{result}</span>
}

/**
 * Parses a content string into typed segments.
 * Handles (in order):
 *   1. ```lang\n...\n```  — code fences
 *   2. $$...$$            — block math
 *   3. $...$              — inline math
 *   4. **...**            — bold
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

  const segments = parseSegments(content)
  const hasBlock = !inline && segments.some(s => s.type === 'math-block' || s.type === 'code')

  const rendered = segments.map((seg, i) => {
    switch (seg.type) {
      case 'code':
        if (inline) {
          // In inline mode, render code as a simple styled span
          return (
            <code key={i} className="bg-[#0d1117] text-emerald-300 px-1.5 py-0.5 rounded text-sm font-mono">
              {seg.value.trim()}
            </code>
          )
        }
        return <CodeBlock key={i} code={seg.value} language={seg.language} />

      case 'math-block':
        if (inline) {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: renderKatex(seg.value, false) }}
            />
          )
        }
        return (
          <div
            key={i}
            className="my-3 overflow-x-auto text-center"
            dangerouslySetInnerHTML={{ __html: renderKatex(seg.value, true) }}
          />
        )

      case 'math-inline':
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderKatex(seg.value, false) }}
          />
        )

      case 'bold':
        return (
          <strong key={i} className="text-white font-semibold">
            {seg.value}
          </strong>
        )

      case 'text':
      default:
        if (inline) return <span key={i}>{seg.value}</span>
        return renderTextBlock(seg.value, i)
    }
  })

  if (hasBlock) {
    return <div className={className}>{rendered}</div>
  }

  return <span className={className}>{rendered}</span>
}
