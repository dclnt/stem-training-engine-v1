import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlayCircle, Link, FileText, Upload, Zap, Loader, Image } from 'lucide-react'
import { llmService } from '../services/llmService'
import { useAppStore } from '../store/useAppStore'
import type { SourceInput, DepthLevel } from '../types'

const DEPTH_OPTIONS: { key: DepthLevel; label: string; desc: string; color: string }[] = [
  { key: 'beginner',     label: 'Beginner',     desc: "I'm new to this topic",    color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20' },
  { key: 'intermediate', label: 'Intermediate', desc: 'I have some background',   color: 'text-blue-400 border-blue-500/40 bg-blue-950/20' },
  { key: 'advanced',     label: 'Advanced',     desc: 'I know the domain well',   color: 'text-amber-400 border-amber-500/40 bg-amber-950/20' },
  { key: 'graduate',     label: 'Graduate',     desc: 'Expert-level training',    color: 'text-purple-400 border-purple-500/40 bg-purple-950/20' },
]

type TabKey = 'youtube' | 'url' | 'file' | 'text'

export default function HomePage() {
  const [tab, setTab] = useState<TabKey>('youtube')
  const [value, setValue] = useState('')
  const [filename, setFilename] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Drag-and-drop
  const [isDragging, setIsDragging] = useState(false)
  // File content & OCR
  const [fileContent, setFileContent] = useState('')
  const [ocrProgress, setOcrProgress] = useState(0)
  const [ocrRunning, setOcrRunning] = useState(false)
  const [isImageFile, setIsImageFile] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { addGraph, appSettings, setDepthLevel } = useAppStore(s => ({
    addGraph: s.addGraph,
    appSettings: s.appSettings,
    setDepthLevel: s.setDepthLevel,
  }))

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; placeholder: string }[] = [
    { key: 'youtube', label: 'YouTube', icon: <PlayCircle size={16} />, placeholder: 'https://youtube.com/watch?v=...' },
    { key: 'url', label: 'URL / Link', icon: <Link size={16} />, placeholder: 'https://example.com/lecture' },
    { key: 'file', label: 'File', icon: <FileText size={16} />, placeholder: '' },
    { key: 'text', label: 'Paste Text', icon: <Upload size={16} />, placeholder: 'Paste a lecture transcript, notes, or syllabus...' },
  ]

  async function handleGenerate() {
    if (!value.trim() && tab !== 'file') { setError('Please enter a source.'); return }
    if (tab === 'file' && !filename) { setError('Please select or drop a file.'); return }
    if (ocrRunning) { setError('Please wait for OCR to finish.'); return }
    setError('')
    setLoading(true)
    try {
      const source: SourceInput = {
        type: tab,
        value: tab === 'file' ? filename : value,
        filename,
        fileContent: tab === 'file' ? fileContent : (tab === 'text' ? value : undefined),
      }
      const graph = await llmService.generateSkillGraph(source, appSettings.depthLevel)
      addGraph(graph)
      navigate('/graph')
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(
        msg === 'API_KEY_MISSING'
          ? 'No API key detected. Add VITE_ANTHROPIC_API_KEY to your environment and restart the dev server.'
          : 'Failed to generate skill graph. Please check your source and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleFileSelect(file: File) {
    setFilename(file.name)
    setValue(file.name)
    setFileContent('')
    setOcrProgress(0)

    const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    const isImage = IMAGE_TYPES.includes(file.type)
    setIsImageFile(isImage)

    if (isImage) {
      setOcrRunning(true)
      try {
        const { createWorker } = await import('tesseract.js')
        const worker = await createWorker('eng', 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100))
            }
          },
        })
        const { data } = await worker.recognize(file)
        await worker.terminate()
        setFileContent(data.text)
      } catch (err) {
        console.warn('OCR failed:', err)
        setError('OCR failed — the image may not contain readable text.')
      } finally {
        setOcrRunning(false)
      }
    } else if (file.type === 'text/plain' || file.name.endsWith('.md')) {
      const reader = new FileReader()
      reader.onload = e => setFileContent((e.target?.result as string) ?? '')
      reader.readAsText(file)
    } else {
      // PDF / DOCX: content not extractable in-browser without extra libraries.
      // Claude will receive the filename as context and infer the topic.
      setFileContent('')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  function handleTabSwitch(key: TabKey) {
    setTab(key)
    setValue('')
    setFilename('')
    setFileContent('')
    setOcrProgress(0)
    setOcrRunning(false)
    setIsImageFile(false)
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-sm px-4 py-1.5 rounded-full mb-5">
            <Zap size={14} />
            <span>Kumon + Hanon + Cognitive Apprenticeship</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">
            STEM Training Engine
          </h1>
          <p className="text-[#94a3b8] text-lg max-w-lg mx-auto">
            Submit any learning source. The engine decomposes it into a mastery-gated skill graph and runs your three-layer training session.
          </p>
        </div>

        <div className="bg-[#1e293b] border border-[#334155] rounded-2xl p-6">
          {/* Tab bar */}
          <div className="flex gap-1 bg-[#0f172a] rounded-xl p-1 mb-6">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => handleTabSwitch(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 px-3 rounded-lg transition-all ${
                  tab === t.key
                    ? 'bg-blue-600 text-white font-medium shadow'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#1e293b]'
                }`}
              >
                {t.icon}
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* File drop zone */}
          {tab === 'file' ? (
            <div>
              <div
                onClick={() => fileRef.current?.click()}
                onDragEnter={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }}
                onDrop={e => {
                  e.preventDefault(); e.stopPropagation(); setIsDragging(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file) handleFileSelect(file)
                }}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500/80 bg-blue-950/20'
                    : 'border-[#334155] hover:border-blue-500/50'
                }`}
              >
                {isImageFile
                  ? <Image size={32} className="mx-auto text-blue-400 mb-3" />
                  : <FileText size={32} className="mx-auto text-[#475569] mb-3" />
                }
                {filename ? (
                  <div>
                    <p className="text-white font-medium">{filename}</p>
                    {fileContent && !ocrRunning && (
                      <p className="text-emerald-400 text-xs mt-1">
                        {isImageFile ? `OCR extracted ${fileContent.length} characters` : `${fileContent.length} characters read`}
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-[#94a3b8] mb-1">Drop a file or click to browse</p>
                    <p className="text-[#475569] text-xs">
                      PDF, TXT, MD, DOCX · PNG, JPG, WEBP (OCR)
                    </p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.md,.docx,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                />
              </div>

              {/* OCR progress bar */}
              {ocrRunning && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-[#64748b] mb-1">
                    <span>Reading image with OCR...</span>
                    <span>{ocrProgress}%</span>
                  </div>
                  <div className="w-full bg-[#0f172a] rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-200"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

          ) : tab === 'text' ? (
            <textarea
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={tabs.find(t => t.key === tab)?.placeholder}
              rows={6}
              className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-3 text-white placeholder-[#475569] focus:outline-none focus:border-blue-500/60 resize-none text-sm"
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              placeholder={tabs.find(t => t.key === tab)?.placeholder}
              className="w-full bg-[#0f172a] border border-[#334155] rounded-xl px-4 py-3 text-white placeholder-[#475569] focus:outline-none focus:border-blue-500/60 text-sm"
              onKeyDown={e => e.key === 'Enter' && handleGenerate()}
            />
          )}

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          {/* Depth Level selector */}
          <div className="mt-5">
            <p className="text-[#64748b] text-xs uppercase tracking-widest mb-2">Depth Level</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DEPTH_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setDepthLevel(opt.key)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    appSettings.depthLevel === opt.key
                      ? opt.color
                      : 'border-[#334155] text-[#64748b] hover:text-[#94a3b8] hover:border-[#475569]'
                  }`}
                >
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || ocrRunning}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                <span>Generating skill graph...</span>
              </>
            ) : ocrRunning ? (
              <>
                <Loader size={18} className="animate-spin" />
                <span>Running OCR...</span>
              </>
            ) : (
              <>
                <Zap size={18} />
                <span>Generate Skill Graph</span>
              </>
            )}
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Kumon Layer', desc: 'Skill graph + mastery gates', color: 'text-emerald-400' },
            { label: 'Hanon Layer', desc: 'Speed ramp + drill cycles', color: 'text-amber-400' },
            { label: 'CA Layer', desc: 'Expert modeling + reflection', color: 'text-purple-400' },
          ].map(item => (
            <div key={item.label} className="bg-[#1e293b]/50 border border-[#334155]/50 rounded-xl p-4">
              <p className={`font-semibold text-sm ${item.color}`}>{item.label}</p>
              <p className="text-[#64748b] text-xs mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
