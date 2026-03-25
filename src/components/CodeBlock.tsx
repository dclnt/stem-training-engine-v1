import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
}

export default function CodeBlock({ code, language = 'python', className }: CodeBlockProps) {
  const lines = code.trim().split('\n').length
  return (
    <div className={`rounded-xl overflow-hidden my-3 text-sm font-mono ${className ?? ''}`}>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{ margin: 0, borderRadius: 0, background: '#0d1117', padding: '1rem' }}
        showLineNumbers={lines > 3}
        wrapLongLines
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  )
}
