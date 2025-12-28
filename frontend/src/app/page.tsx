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
  X,
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

interface BatchCompareResponse {
  comparisons: CompareResponse[]
  total_videos: number
  total_prompts: number
  total_combinations: number
}

interface UploadedVideo {
  id: string
  file: File
  url: string
}

const suggestedPrompts = [
  "Please provide a detailed second-by-second analysis of this video capturing both visual and audio elements with precise timestamps. For visuals, describe the camera work including angles, movements, and framing choices. Detail all subjects in frame noting their appearance, clothing, positioning, facial expressions, body language, and actions. Describe the environment including setting, background elements, lighting conditions, and atmospheric effects. Note the visual style including color grading, text overlays with exact wording, transitions between scenes, special effects, and focus changes. For audio, transcribe all dialogue exactly with speaker identification, tone, and delivery style. Identify all sound effects including ambient sounds, foley, and impacts with their timing relative to visual actions. Describe any music including genre, instrumentation, tempo, mood, and volume changes. Note audio technical elements like spatial positioning and effects. Use timestamps in MM:SS format. Structure your response chronologically with each time segment covering visual description, audio description, and notable elements. Include overall analysis of narrative arc, how visual cuts align with audio beats, emotional progression throughout, technical production quality, and the apparent purpose or context of the video. Be exhaustive and specific in capturing every detail.",
  "Analyze this video from a professional video editing perspective. Identify the best hook or opening moment that would grab viewer attention. Mark timestamps where the video could be trimmed to create highlight reels or shorter versions. Identify and timestamp all filler words, awkward pauses, repeated takes, or redundant content that should be cut. Note any sections with dead air or low energy that could be removed. Highlight the most engaging moments that should be preserved. Suggest B-roll opportunities or cutaway points. Identify transitions that work well and those that could be improved. Note any pacing issues - sections that drag or feel rushed. Recommend an optimal runtime and structure for maximum engagement. Provide specific trim suggestions with in/out points (MM:SS format) for creating a polished final cut.",
  "Provide precise trimming recommendations for this video. Identify the strongest opening hook with exact in-point timestamp (MM:SS format). Mark all sections to cut including filler words (um, uh, like), awkward pauses over 2 seconds, repeated content, and low-value segments with exact in/out points. Suggest trim points that maintain natural speech rhythm and avoid jarring cuts. Recommend where to trim for different video lengths: full version, 60-second cut, 30-second cut, and 15-second highlight. Identify the most quotable or shareable moments worth isolating. Suggest which segments could be rearranged for better flow. Provide frame-accurate cut points that respect word boundaries and breathing room. Recommend optimal ending point that leaves viewers satisfied.",
  "Provide audio improvement suggestions for this video. Identify timestamps where audio levels should be adjusted (too loud/quiet), recommend compression or normalization settings. Suggest noise reduction for background noise, echo, or artifacts with specific timestamps (MM:SS format). Propose fixes for dialogue clarity issues. Recommend volume adjustments where music overpowers speech or vice versa. Identify audio-visual sync issues and suggest corrections. Propose where to add or enhance sound effects for better impact. Suggest improvements for audio transitions to make them smoother. Recommend overall mixing adjustments to achieve professional audio balance.",
  "Provide text and caption optimization suggestions for this video. List where captions should be added, removed, or retimed with timestamps (MM:SS format). Suggest optimal caption duration for each text element. Recommend font size, color, and placement improvements for better readability. Propose fixes for any typos or grammatical errors. Suggest repositioning text overlays that obstruct important visuals. Recommend animation timing and style improvements for text elements. Provide suggestions for enhancing lower thirds, titles, and end screens. Propose additional text overlays or graphics that would improve viewer understanding and engagement.",
  "Provide transition and pacing improvement suggestions for this video. Recommend which transitions should be changed and to what type (cut, dissolve, wipe, etc) with timestamps (MM:SS format). Suggest where cuts should be tightened or lengthened for better flow. Identify sections that need re-pacing - recommend speeding up slow sections or adding breathing room to rushed parts. Propose alternative transition styles that better match the mood. Suggest restructuring or reordering segments for better narrative flow. Recommend where to add or remove beats to improve rhythm. Provide specific timing adjustments to align scene changes with audio beats.",
  "Provide color grading and visual enhancement suggestions for this video. Recommend color correction adjustments for specific scenes with timestamps (MM:SS format). Suggest fixes for exposure issues - propose settings for overexposed or underexposed sections. Recommend white balance corrections. Suggest color grading to enhance mood and create visual consistency. Propose sharpening or softening adjustments for better image quality. Recommend fixes for visual artifacts or compression issues. Suggest ways to create a cohesive visual style throughout. Provide specific LUT or color adjustment recommendations for achieving professional polish.",
  "Provide B-roll and supplementary footage suggestions for this video. Recommend specific B-roll shots to add at each timestamp (MM:SS format) with detailed descriptions of what footage would work best. Suggest creative visual alternatives for static or repetitive sections. Propose cutaway options to maintain viewer engagement. Recommend types of supplementary footage that would enhance the story for talking head sections. Suggest replacement footage for existing B-roll that doesn't match the narrative. Provide duration recommendations for each B-roll insert. Propose creative visual solutions to improve pacing and storytelling.",
  "Provide thumbnail creation and optimization suggestions for this video. Recommend the 3-5 best frames for thumbnails with specific timestamps (MM:SS format) and explain why each would be effective. Suggest crops, zooms, or framing adjustments to enhance thumbnail impact. Recommend text overlays with specific wording and placement. Suggest color adjustments or filters to increase visual appeal and click-worthiness. Propose graphic elements or effects to add. Recommend which facial expressions or moments to feature. Suggest ways to ensure thumbnails accurately represent content while maximizing engagement. Provide A/B testing alternatives for different audience segments.",
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
  
  // Batch mode state
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([])
  const [selectedPrompts, setSelectedPrompts] = useState<Set<string>>(new Set())
  const [isBatchMode, setIsBatchMode] = useState(false)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null)
  const [batchResult, setBatchResult] = useState<BatchCompareResponse | null>(null)
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
    const files = e.target.files
    if (!files || files.length === 0) return

    if (isBatchMode) {
      // Handle multiple file upload for batch mode
      await handleBatchFileUpload(files)
    } else {
      // Handle single file upload
      const file = files[0]
      
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
      setBatchResult(null)
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
  }

  const handleBatchFileUpload = async (files: FileList) => {
    setIsUploading(true)
    setError(null)
    
    const newVideos: UploadedVideo[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('http://localhost:8000/api/video/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        const data: VideoMetadata = await response.json()
        newVideos.push({
          id: data.id,
          file: file,
          url: URL.createObjectURL(file)
        })
      } catch (err) {
        console.error(`Error uploading ${file.name}:`, err)
        setError(`Failed to upload ${file.name}`)
      }
    }
    
    setUploadedVideos(prev => [...prev, ...newVideos])
    setIsUploading(false)
  }

  const removeVideo = (videoId: string) => {
    setUploadedVideos(prev => {
      const video = prev.find(v => v.id === videoId)
      if (video) {
        URL.revokeObjectURL(video.url)
      }
      return prev.filter(v => v.id !== videoId)
    })
  }

  const togglePromptSelection = (promptText: string) => {
    setSelectedPrompts(prev => {
      const next = new Set(prev)
      if (next.has(promptText)) {
        next.delete(promptText)
      } else {
        next.add(promptText)
      }
      return next
    })
  }

  const handleBatchCompare = async () => {
    if (uploadedVideos.length === 0 || selectedPrompts.size === 0 || selectedModels.size === 0) return

    setIsComparing(true)
    setError(null)
    setBatchResult(null)
    setCompareResult(null)

    const timeoutMinutes = 30 // 30 minutes for batch

    try {
      // Create an AbortController with extended timeout for batch processing
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeoutMinutes * 60 * 1000)

      const response = await fetch('http://localhost:8000/api/batch-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_ids: uploadedVideos.map(v => v.id),
          prompts: Array.from(selectedPrompts),
          models: Array.from(selectedModels),
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Batch comparison failed')
      }

      const data: BatchCompareResponse = await response.json()
      setBatchResult(data)
      
      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError(`Request timed out after ${timeoutMinutes} minutes. Try with fewer videos or prompts.`)
        } else {
          setError(err.message || 'Batch comparison failed. Check the backend and try again.')
        }
      } else {
        setError('Batch comparison failed. Check the backend and try again.')
      }
      console.error(err)
    } finally {
      setIsComparing(false)
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
      // Create an AbortController with a 10-minute timeout for long-running analysis
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000) // 10 minutes

      const response = await fetch('http://localhost:8000/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_id: videoId,
          prompt: prompt,
          models: Array.from(selectedModels),
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Comparison failed')
      }

      const data: CompareResponse = await response.json()
      setCompareResult(data)
      
      // Scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Request timed out after 10 minutes. Try with a shorter video or simpler prompt.')
        } else {
          setError(err.message || 'Comparison failed. Check the backend and try again.')
        }
      } else {
        setError('Comparison failed. Check the backend and try again.')
      }
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
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              <span className="gradient-text">Video Understanding</span>
              <span className="text-compare-muted ml-2 text-lg font-normal">Comparisons</span>
            </h1>
            <p className="text-compare-muted text-sm">Compare Gemini models on video analysis tasks</p>
          </div>
          
          {/* Batch Mode Toggle */}
          <button
            onClick={() => {
              setIsBatchMode(!isBatchMode)
              setCompareResult(null)
              setBatchResult(null)
              setError(null)
            }}
            className={clsx(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              isBatchMode
                ? "bg-compare-accent text-white"
                : "bg-compare-surface text-compare-text hover:bg-compare-border"
            )}
          >
            {isBatchMode ? 'Single Mode' : 'Batch Mode'}
          </button>
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
                  multiple={isBatchMode}
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
                      {isBatchMode 
                        ? (uploadedVideos.length > 0 ? 'Add More Videos' : 'Upload Videos') 
                        : (videoFile ? 'Change Video' : 'Upload Video')}
                    </>
                  )}
                </button>
                {!isBatchMode && videoFile && !isUploading && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-compare-muted">
                    {videoId ? (
                      <CheckCircle2 className="w-4 h-4 text-compare-success" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-compare-warning" />
                    )}
                    <span className="truncate">{videoFile.name}</span>
                  </div>
                )}
                {isBatchMode && uploadedVideos.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                    {uploadedVideos.map((video) => (
                      <div key={video.id} className="flex items-center gap-2 text-sm p-2 bg-compare-surface rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-compare-success flex-shrink-0" />
                        <span className="truncate flex-1 text-compare-muted">{video.file.name}</span>
                        <button
                          onClick={() => removeVideo(video.id)}
                          className="p-1 hover:bg-compare-border rounded transition-colors"
                        >
                          <X className="w-4 h-4 text-compare-muted" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Prompt Input */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-compare-accent" />
                Understanding Prompt{isBatchMode && 's'}
              </h2>
              
              {!isBatchMode ? (
                <>
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
                </>
              ) : (
                <div>
                  <p className="text-sm text-compare-muted mb-3">Select prompts to run on all videos:</p>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {suggestedPrompts.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => togglePromptSelection(suggestion)}
                        className={clsx(
                          "w-full text-left text-sm px-4 py-3 rounded-lg border transition-all",
                          selectedPrompts.has(suggestion)
                            ? "bg-compare-accent/10 border-compare-accent text-compare-text"
                            : "bg-compare-surface border-compare-border text-compare-muted hover:border-compare-accent/50 hover:text-compare-text"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={clsx(
                            "w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors",
                            selectedPrompts.has(suggestion)
                              ? "bg-compare-accent border-compare-accent"
                              : "border-compare-border"
                          )}>
                            {selectedPrompts.has(suggestion) && (
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            )}
                          </div>
                          <span className="line-clamp-2">{suggestion.slice(0, 120)}...</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedPrompts.size > 0 && (
                    <p className="text-xs text-compare-muted mt-3">
                      {selectedPrompts.size} prompt{selectedPrompts.size !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              )}

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
                onClick={isBatchMode ? handleBatchCompare : handleCompare}
                disabled={
                  isBatchMode 
                    ? (uploadedVideos.length === 0 || selectedPrompts.size === 0 || isComparing || selectedModels.size === 0)
                    : (!videoId || !prompt.trim() || isComparing || selectedModels.size === 0)
                }
                className={clsx(
                  "w-full mt-6 flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold transition-all",
                  (isBatchMode 
                    ? (uploadedVideos.length > 0 && selectedPrompts.size > 0 && !isComparing && selectedModels.size > 0)
                    : (videoId && prompt.trim() && !isComparing && selectedModels.size > 0))
                    ? "bg-gradient-to-r from-compare-accent to-compare-secondary text-white glow-accent hover:opacity-90"
                    : "bg-compare-elevated text-compare-muted cursor-not-allowed"
                )}
              >
                {isComparing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {isBatchMode ? 'Running Batch...' : 'Running Comparison...'}
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    {isBatchMode 
                      ? `Run ${uploadedVideos.length} × ${selectedPrompts.size} = ${uploadedVideos.length * selectedPrompts.size} Comparisons`
                      : `Compare ${selectedModels.size} Model${selectedModels.size !== 1 ? 's' : ''}`
                    }
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

              {!compareResult && !batchResult && !isComparing && (
                <div className="h-[500px] flex items-center justify-center text-center">
                  <div>
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-compare-elevated border border-compare-border flex items-center justify-center mb-4">
                      <Zap className="w-8 h-8 text-compare-muted" />
                    </div>
                    <p className="text-compare-text font-medium mb-1">No results yet</p>
                    <p className="text-compare-muted text-sm">
                      {isBatchMode 
                        ? 'Upload videos and select prompts to run batch comparison'
                        : 'Upload a video and enter a prompt to compare models'
                      }
                    </p>
                  </div>
                </div>
              )}

              {isComparing && (
                <div className="h-[500px] flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 text-compare-accent animate-spin mx-auto mb-4" />
                    <p className="text-compare-text font-medium mb-1">
                      {isBatchMode ? 'Running batch analysis...' : 'Analyzing with all models...'}
                    </p>
                    <p className="text-compare-muted text-sm">This may take a few minutes</p>
                  </div>
                </div>
              )}

              {/* Batch Results */}
              {batchResult && (
                <div className="space-y-6">
                  {/* Batch Summary */}
                  <div className="p-4 rounded-xl bg-compare-secondary/10 border border-compare-secondary/20">
                    <h3 className="font-semibold text-compare-secondary mb-2">Batch Summary</h3>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-compare-muted">Videos</p>
                        <p className="text-compare-text font-semibold">{batchResult.total_videos}</p>
                      </div>
                      <div>
                        <p className="text-compare-muted">Prompts</p>
                        <p className="text-compare-text font-semibold">{batchResult.total_prompts}</p>
                      </div>
                      <div>
                        <p className="text-compare-muted">Total Comparisons</p>
                        <p className="text-compare-text font-semibold">{batchResult.total_combinations}</p>
                      </div>
                    </div>
                  </div>

                  {/* Individual Comparisons */}
                  {batchResult.comparisons.map((comparison, index) => (
                    <div key={index} className="p-4 rounded-xl bg-compare-surface border border-compare-border">
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Video className="w-4 h-4 text-compare-accent" />
                          <h4 className="font-semibold text-compare-text">Video {index + 1}</h4>
                          <span className="text-xs text-compare-muted">({comparison.video_id})</span>
                        </div>
                        <p className="text-sm text-compare-muted line-clamp-2">{comparison.prompt}</p>
                      </div>

                      {comparison.overall_summary && (
                        <div className="mb-4 p-3 rounded-lg bg-compare-secondary/10 border border-compare-secondary/20">
                          <p className="text-xs text-compare-secondary font-semibold mb-1">Summary</p>
                          <p className="text-xs text-compare-text">{comparison.overall_summary}</p>
                        </div>
                      )}

                      {/* Model Results Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        {comparison.results.map((result) => {
                          const evaluation = comparison.evaluation?.find(e => e.model_name === result.model_name)
                          return (
                            <div key={result.model_name} className="p-3 rounded-lg bg-compare-elevated border border-compare-border">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-semibold text-sm text-compare-text">{result.model_name}</h5>
                                {evaluation && (
                                  <div className={clsx(
                                    "px-2 py-0.5 rounded-full text-xs font-bold",
                                    getScoreColor(evaluation.score)
                                  )}>
                                    {evaluation.score}/10
                                  </div>
                                )}
                              </div>
                              {result.error ? (
                                <p className="text-xs text-compare-error">{result.error}</p>
                              ) : (
                                <>
                                  <p className="text-xs text-compare-muted line-clamp-3 mb-2">{result.response}</p>
                                  {evaluation && (
                                    <div className="text-xs">
                                      <p className="text-compare-success">✓ {evaluation.strengths[0]}</p>
                                      {evaluation.weaknesses[0] && (
                                        <p className="text-compare-warning">! {evaluation.weaknesses[0]}</p>
                                      )}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Single Comparison Result */}
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

