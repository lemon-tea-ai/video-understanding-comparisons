'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload,
  Play,
  Pause,
  Send,
  Sparkles,
  Video,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Zap,
  Brain,
} from 'lucide-react'
import clsx from 'clsx'

interface VideoMetadata {
  id: string
  filename: string
  size: number
  content_type: string
}

interface ModelResult {
  model_name: string
  model_id: string
  response: string
  error: string | null
  latency_ms: number | null
}

interface EvaluationScore {
  model_name: string
  score: number
  reasoning: string
  strengths: string[]
  weaknesses: string[]
}

interface CompareResponse {
  video_id: string
  prompt: string
  results: ModelResult[]
  evaluation: EvaluationScore[] | null
  overall_summary: string | null
}

const suggestedPrompts = [
  "Describe what is happening in this video in detail",
  "What are the main objects and people visible in this video?",
  "Summarize the key events in chronological order",
  "What is the mood or atmosphere of this video?",
  "Identify any text, logos, or brands visible in the video",
]

const AVAILABLE_MODELS = [
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "Latest pro model" },
  { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Latest flash model" },
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Previous gen pro" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Previous gen flash" },
]

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null)
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [selectedModels, setSelectedModels] = useState<Set<string>>(
    new Set(AVAILABLE_MODELS.map(m => m.id))
  )
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (timelineRef.current && videoRef.current) {
      const rect = timelineRef.current.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const percentage = clickX / rect.width
      videoRef.current.currentTime = percentage * duration
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Clean up old URL
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl)
    }

    setVideoFile(file)
    setVideoUrl(URL.createObjectURL(file))
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    setError(null)
    setCompareResult(null)
    setVideoId(null)

    // Upload to backend
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('http://localhost:8000/api/video/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to upload video')
      }

      const data: VideoMetadata = await response.json()
      setVideoId(data.id)
    } catch (err) {
      setError('Failed to upload video. Make sure the backend is running.')
      console.error(err)
    } finally {
      setIsUploading(false)
    }
  }

  const toggleModelSelection = (modelId: string) => {
    setSelectedModels(prev => {
      const next = new Set(prev)
      if (next.has(modelId)) {
        // Don't allow deselecting all models
        if (next.size > 1) {
          next.delete(modelId)
        }
      } else {
        next.add(modelId)
      }
      return next
    })
  }

  const selectAllModels = () => {
    setSelectedModels(new Set(AVAILABLE_MODELS.map(m => m.id)))
  }

  const handleCompare = async () => {
    if (!videoId || !prompt.trim() || selectedModels.size === 0) return

    setIsComparing(true)
    setError(null)
    setCompareResult(null)

    try {
      const response = await fetch('http://localhost:8000/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          prompt: prompt,
          models: Array.from(selectedModels),
        }),
      })

      if (!response.ok) {
        throw new Error('Comparison failed')
      }

      const data: CompareResponse = await response.json()
      setCompareResult(data)
      
      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      setError('Comparison failed. Check the backend and try again.')
      console.error(err)
    } finally {
      setIsComparing(false)
    }
  }

  const toggleModelExpand = (modelName: string) => {
    setExpandedModels(prev => {
      const next = new Set(prev)
      if (next.has(modelName)) {
        next.delete(modelName)
      } else {
        next.add(modelName)
      }
      return next
    })
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-compare-success'
    if (score >= 6) return 'text-compare-accent'
    if (score >= 4) return 'text-compare-warning'
    return 'text-compare-error'
  }

  const getScoreBarColor = (score: number) => {
    if (score >= 8) return 'bg-compare-success'
    if (score >= 6) return 'bg-compare-accent'
    if (score >= 4) return 'bg-compare-warning'
    return 'bg-compare-error'
  }

  const getEvaluationForModel = (modelName: string): EvaluationScore | undefined => {
    return compareResult?.evaluation?.find(e => e.model_name === modelName)
  }

  return (
    <main className="min-h-screen grid-bg">
      {/* Background orbs */}
      <div className="orb-1 top-[-200px] right-[-100px] -z-10" />
      <div className="orb-2 bottom-[-150px] left-[-100px] -z-10" />

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-8"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-compare-accent to-compare-secondary flex items-center justify-center glow-accent">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              <span className="gradient-text">Video Understanding</span>
              <span className="text-compare-muted ml-2 text-lg font-normal">Comparisons</span>
            </h1>
            <p className="text-compare-muted text-sm">Compare Gemini models on video analysis tasks</p>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Video Upload & Preview */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Video Preview */}
            <div className="glass rounded-2xl overflow-hidden">
              <div className="aspect-video bg-compare-bg flex items-center justify-center relative">
                {videoUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="w-full h-full object-contain"
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onEnded={() => setIsPlaying(false)}
                    />
                    <div 
                      className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={togglePlayPause}
                    >
                      <div className="w-16 h-16 rounded-full bg-compare-bg/80 backdrop-blur flex items-center justify-center">
                        {isPlaying ? (
                          <Pause className="w-6 h-6 text-compare-accent" />
                        ) : (
                          <Play className="w-6 h-6 text-compare-accent ml-1" />
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center px-8">
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      className="w-20 h-20 mx-auto rounded-2xl bg-compare-elevated border border-compare-border flex items-center justify-center mb-4"
                    >
                      <Video className="w-10 h-10 text-compare-accent/50" />
                    </motion.div>
                    <p className="text-compare-text font-medium mb-1">No video loaded</p>
                    <p className="text-compare-muted text-sm">Upload a video to get started</p>
                  </div>
                )}
              </div>

              {/* Timeline */}
              {videoUrl && (
                <div className="px-4 py-3 border-t border-compare-border bg-compare-surface/50">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={togglePlayPause}
                      className="w-8 h-8 rounded-lg bg-compare-elevated hover:bg-compare-border flex items-center justify-center transition-colors"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4 text-compare-text" />
                      ) : (
                        <Play className="w-4 h-4 text-compare-text ml-0.5" />
                      )}
                    </button>

                    <span className="text-xs text-compare-muted font-mono w-10">
                      {formatTime(currentTime)}
                    </span>

                    <div
                      ref={timelineRef}
                      onClick={handleTimelineClick}
                      className="flex-1 h-2 bg-compare-elevated rounded-full cursor-pointer group relative"
                    >
                      <div
                        className="h-full bg-compare-accent rounded-full relative transition-all"
                        style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                      >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    <span className="text-xs text-compare-muted font-mono w-10 text-right">
                      {formatTime(duration)}
                    </span>
                  </div>
                </div>
              )}

              {/* Upload Button */}
              <div className="p-4 border-t border-compare-border">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="video/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={clsx(
                    "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all",
                    isUploading
                      ? "bg-compare-elevated text-compare-muted cursor-not-allowed"
                      : "bg-compare-elevated hover:bg-compare-border text-compare-text"
                  )}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      {videoFile ? 'Change Video' : 'Upload Video'}
                    </>
                  )}
                </button>
                {videoFile && !isUploading && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-compare-muted">
                    {videoId ? (
                      <CheckCircle2 className="w-4 h-4 text-compare-success" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-compare-warning" />
                    )}
                    <span className="truncate">{videoFile.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-compare-accent" />
                Understanding Prompt
              </h2>
              
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt for video understanding..."
                className="w-full h-32 bg-compare-surface border border-compare-border rounded-xl px-4 py-3 text-sm placeholder:text-compare-muted focus:outline-none focus:border-compare-accent/50 focus:ring-1 focus:ring-compare-accent/20 transition-all resize-none"
              />

              {/* Suggested Prompts */}
              <div className="mt-4">
                <p className="text-xs text-compare-muted mb-2 uppercase tracking-wider">Suggestions</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedPrompts.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(suggestion)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-compare-surface border border-compare-border hover:border-compare-accent/50 text-compare-muted hover:text-compare-text transition-all"
                    >
                      {suggestion.slice(0, 40)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Selection */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-compare-muted uppercase tracking-wider">Select Models</p>
                  <button
                    onClick={selectAllModels}
                    className="text-xs text-compare-accent hover:text-compare-accent-soft transition-colors"
                  >
                    Select All
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {AVAILABLE_MODELS.map((model) => {
                    const isSelected = selectedModels.has(model.id)
                    return (
                      <button
                        key={model.id}
                        onClick={() => toggleModelSelection(model.id)}
                        className={clsx(
                          "p-3 rounded-xl border text-left transition-all",
                          isSelected
                            ? "bg-compare-accent/10 border-compare-accent/50 text-compare-text"
                            : "bg-compare-surface border-compare-border text-compare-muted hover:border-compare-muted"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={clsx(
                            "w-4 h-4 rounded border-2 flex items-center justify-center transition-all",
                            isSelected
                              ? "bg-compare-accent border-compare-accent"
                              : "border-compare-muted"
                          )}>
                            {isSelected && (
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{model.name}</p>
                            <p className="text-xs text-compare-muted">{model.description}</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Compare Button */}
              <button
                onClick={handleCompare}
                disabled={!videoId || !prompt.trim() || isComparing || selectedModels.size === 0}
                className={clsx(
                  "w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold transition-all",
                  videoId && prompt.trim() && !isComparing && selectedModels.size > 0
                    ? "bg-gradient-to-r from-compare-accent to-compare-secondary text-white glow-accent hover:opacity-90"
                    : "bg-compare-elevated text-compare-muted cursor-not-allowed"
                )}
              >
                {isComparing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Running Comparison...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Compare {selectedModels.size} Model{selectedModels.size !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* Right Panel - Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            ref={resultsRef}
          >
            <div className="glass rounded-2xl p-6 min-h-[600px]">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-compare-secondary" />
                Comparison Results
              </h2>

              {error && (
                <div className="mb-4 p-4 rounded-xl bg-compare-error/10 border border-compare-error/20 text-compare-error text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}

              {!compareResult && !isComparing && (
                <div className="h-[500px] flex items-center justify-center text-center">
                  <div>
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-compare-elevated border border-compare-border flex items-center justify-center mb-4">
                      <Zap className="w-8 h-8 text-compare-muted" />
                    </div>
                    <p className="text-compare-text font-medium mb-1">No results yet</p>
                    <p className="text-compare-muted text-sm">Upload a video and enter a prompt to compare models</p>
                  </div>
                </div>
              )}

              {isComparing && (
                <div className="h-[500px] flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-compare-accent animate-spin mx-auto mb-4" />
                    <p className="text-compare-text font-medium mb-1">Analyzing with all models...</p>
                    <p className="text-compare-muted text-sm">This may take a minute</p>
                  </div>
                </div>
              )}

              {compareResult && (
                <div className="space-y-4">
                  {/* Overall Summary */}
                  {compareResult.overall_summary && (
                    <div className="p-4 rounded-xl bg-compare-secondary/10 border border-compare-secondary/20">
                      <h3 className="font-semibold text-compare-secondary mb-2">Overall Summary</h3>
                      <p className="text-sm text-compare-text">{compareResult.overall_summary}</p>
                    </div>
                  )}

                  {/* Model Results */}
                  <AnimatePresence>
                    {compareResult.results.map((result, index) => {
                      const evaluation = getEvaluationForModel(result.model_name)
                      const isExpanded = expandedModels.has(result.model_name)
                      
                      return (
                        <motion.div
                          key={result.model_name}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="glass-elevated rounded-xl overflow-hidden"
                        >
                          {/* Header */}
                          <div 
                            className="p-4 flex items-center justify-between cursor-pointer hover:bg-compare-elevated/50 transition-colors"
                            onClick={() => toggleModelExpand(result.model_name)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={clsx(
                                "w-10 h-10 rounded-lg flex items-center justify-center",
                                result.error ? "bg-compare-error/20" : "bg-compare-accent/20"
                              )}>
                                {result.error ? (
                                  <AlertCircle className="w-5 h-5 text-compare-error" />
                                ) : (
                                  <Brain className="w-5 h-5 text-compare-accent" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-semibold text-compare-text">{result.model_name}</h3>
                                <div className="flex items-center gap-2 text-xs text-compare-muted">
                                  {result.latency_ms && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {(result.latency_ms / 1000).toFixed(1)}s
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                              {evaluation && (
                                <div className="text-right">
                                  <div className={clsx("text-2xl font-bold", getScoreColor(evaluation.score))}>
                                    {evaluation.score}/10
                                  </div>
                                </div>
                              )}
                              {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-compare-muted" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-compare-muted" />
                              )}
                            </div>
                          </div>

                          {/* Score Bar */}
                          {evaluation && (
                            <div className="px-4 pb-2">
                              <div className="h-2 bg-compare-surface rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${evaluation.score * 10}%` }}
                                  transition={{ duration: 0.5, delay: index * 0.1 }}
                                  className={clsx("h-full rounded-full score-bar", getScoreBarColor(evaluation.score))}
                                />
                              </div>
                            </div>
                          )}

                          {/* Expanded Content */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-4 pt-2 border-t border-compare-border space-y-4">
                                  {/* Response */}
                                  {result.error ? (
                                    <div className="p-3 rounded-lg bg-compare-error/10 text-compare-error text-sm">
                                      Error: {result.error}
                                    </div>
                                  ) : (
                                    <div>
                                      <h4 className="text-xs uppercase tracking-wider text-compare-muted mb-2">Response</h4>
                                      <p className="text-sm text-compare-text whitespace-pre-wrap">{result.response}</p>
                                    </div>
                                  )}

                                  {/* Evaluation Details */}
                                  {evaluation && (
                                    <>
                                      <div>
                                        <h4 className="text-xs uppercase tracking-wider text-compare-muted mb-2">Reasoning</h4>
                                        <p className="text-sm text-compare-text">{evaluation.reasoning}</p>
                                      </div>

                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <h4 className="text-xs uppercase tracking-wider text-compare-success mb-2">Strengths</h4>
                                          <ul className="space-y-1">
                                            {evaluation.strengths.map((s, i) => (
                                              <li key={i} className="text-sm text-compare-text flex items-start gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-compare-success flex-shrink-0 mt-0.5" />
                                                {s}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                        <div>
                                          <h4 className="text-xs uppercase tracking-wider text-compare-warning mb-2">Weaknesses</h4>
                                          <ul className="space-y-1">
                                            {evaluation.weaknesses.map((w, i) => (
                                              <li key={i} className="text-sm text-compare-text flex items-start gap-2">
                                                <AlertCircle className="w-4 h-4 text-compare-warning flex-shrink-0 mt-0.5" />
                                                {w}
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  )
}

