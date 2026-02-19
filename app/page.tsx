'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  MAX_STYLES,
  STYLE_DEF,
  COLOR_MAP,
  CREDIT_COST,
  CREDITS_PER_VIDEO,
  getEnemyAvatar,
  inferEnemyGender,
  RELATION_OPTIONS,
  type UserConfig,
} from '@/lib/constants'
import { getRandomAd, getRequiredWatchDuration, type AdVideo } from '@/lib/ads'

type Message =
  | { id: string; type: 'enemy'; text: string }
  | { id: string; type: 'loading' }
  | { id: string; type: 'ai'; data: Record<string, string> }
  | { id: string; type: 'ai-simple'; text: string }

const initialConfig: UserConfig = {
  gender: '未知',
  age: '',
  status: '只想躺平',
  enemy: '亲戚',
  enemyGender: '女',
}

/** Star/sparkle icon for credits (AI-style). */
function CreditIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6L5.7 21l2.3-7-6-4.6h7.6L12 2z" />
    </svg>
  )
}

/** Video/play icon for "watch ad". */
function VideoIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5zm2 3.07l6.57 3.87L10 15.93V8.07z" />
      <path d="M4 6h2v12H4zm14 0h2v12h-2z" />
    </svg>
  )
}

export default function ChatPage() {
  const [userConfig, setUserConfig] = useState<UserConfig>(initialConfig)
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(
    new Set(['normal', 'savage', 'funny', 'philosopher'])
  )
  const [messages, setMessages] = useState<Message[]>([])
  const [showWelcome, setShowWelcome] = useState(true)
  const [configOpen, setConfigOpen] = useState(false)
  const [styleDrawerOpen, setStyleDrawerOpen] = useState(false)
  const [tweakModal, setTweakModal] = useState<{
    elementId: string
    text: string
  } | null>(null)
  const [tweakInput, setTweakInput] = useState('')
  const [tweakSubmitting, setTweakSubmitting] = useState(false)
  const [sending, setSending] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)
  const [lowCreditsPopup, setLowCreditsPopup] = useState(false)
  const [videoAdModal, setVideoAdModal] = useState<AdVideo | null>(null)
  const [adCountdown, setAdCountdown] = useState(0)
  const [videoAdRewardGranted, setVideoAdRewardGranted] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)
  const adGrantedRef = useRef(false)
  const prevAdCountdownRef = useRef(-1)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const userInputRef = useRef<HTMLTextAreaElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    fetch('/api/credits', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { credits?: number }) => setCredits(d.credits ?? 0))
      .catch(() => setCredits(0))
  }, [])

  // Video ad: required watch time countdown; after that grant credits and allow close (video keeps playing)
  useEffect(() => {
    if (!videoAdModal) {
      adGrantedRef.current = false
      setVideoAdRewardGranted(false)
      return
    }
    prevAdCountdownRef.current = getRequiredWatchDuration() // avoid granting on open when state is still 0
    setVideoMuted(false) // start with sound (user already clicked to watch)
    const duration = getRequiredWatchDuration()
    setAdCountdown(duration)
    setVideoAdRewardGranted(false)
    videoRef.current?.play().catch(() => {})
    const id = setInterval(() => {
      setAdCountdown((c) => (c <= 1 ? 0 : c - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [videoAdModal])
  useEffect(() => {
    // Only grant when countdown actually reached 0 from 1 (not the initial 0 before state updates)
    const prev = prevAdCountdownRef.current
    prevAdCountdownRef.current = adCountdown
    if (!videoAdModal || adCountdown !== 0 || prev !== 1) return
    if (adGrantedRef.current) return
    adGrantedRef.current = true
    fetch('/api/credits', { method: 'POST', credentials: 'include' })
      .then((r) => r.json())
      .then((d: { credits?: number }) => {
        setCredits(d.credits ?? 0)
        setVideoAdRewardGranted(true)
      })
      .catch(() => setVideoAdModal(null))
  }, [videoAdModal, adCountdown])

  const overlayVisible = configOpen || styleDrawerOpen

  const updateConfigFromUI = useCallback(
    (form: { gender?: string; age?: string; status?: string; enemy?: string }) => {
      setUserConfig((prev) => {
        const next = { ...prev, ...form }
        if (form.enemy !== undefined) next.enemyGender = inferEnemyGender(form.enemy)
        return next
      })
    },
    []
  )

  const toggleStyle = useCallback((key: string) => {
    setSelectedStyles((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size > 1) next.delete(key)
      } else if (next.size < MAX_STYLES) next.add(key)
      return next
    })
  }, [])

  const buildPrompt = useCallback(() => {
    const styleInstructions = Array.from(selectedStyles)
      .map((key) => `"${key}": ${STYLE_DEF[key].desc}`)
      .join(',\n')
    return `You are a Malaysian CNY relative-defense assistant. Context: User(${userConfig.status}, ${userConfig.age || '未知'}yo) vs ${userConfig.enemy}(${userConfig.enemyGender}). Output: JSON with keys: { ${styleInstructions} }. 主要用中文（普通话），不要用广东话。可少量夹杂英文/Manglish。Variety in sentence structures. Only JSON.`
  }, [userConfig, selectedStyles])

  const sendMessage = useCallback(async () => {
    const text = userInputRef.current?.value.trim()
    if (!text || sending) return
    setShowWelcome(false)
    setMessages((m) => [...m, { id: `e-${Date.now()}`, type: 'enemy', text }])
    if (userInputRef.current) {
      userInputRef.current.value = ''
      userInputRef.current.style.height = 'auto'
    }
    setSending(true)
    const loadingId = `load-${Date.now()}`
    setMessages((m) => [...m, { id: loadingId, type: 'loading' }])
    setTimeout(() => {
      chatContainerRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' })
    }, 50)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: buildPrompt(), userMessage: text }),
        credentials: 'include',
      })
      const json = (await res.json()) as {
        content?: Record<string, string>
        error?: string
        remaining?: number
      }
      if (res.status === 402) {
        setCredits(json.remaining ?? 0)
        setLowCreditsPopup(true)
        setMessages((m) =>
          m.filter((x) => x.id !== loadingId).concat({
            id: `ai-${Date.now()}`,
            type: 'ai-simple',
            text: json.error ?? 'Credits 不够了，用完了。',
          })
        )
        return
      }
      if (json.remaining !== undefined) setCredits(json.remaining)
      setMessages((m) =>
        m.filter((x) => x.id !== loadingId).concat(
          json.content
            ? { id: `ai-${Date.now()}`, type: 'ai' as const, data: json.content }
            : { id: `ai-${Date.now()}`, type: 'ai-simple' as const, text: '哎呀，诸葛亮暂时短路了，请重试。' }
        )
      )
    } catch {
      setMessages((m) =>
        m.filter((x) => x.id !== loadingId).concat({
          id: `ai-${Date.now()}`,
          type: 'ai-simple',
          text: '哎呀，诸葛亮暂时短路了，请重试。',
        })
      )
    } finally {
      setSending(false)
      setTimeout(() => chatContainerRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }), 100)
    }
  }, [sending, buildPrompt])

  const submitTweak = useCallback(async () => {
    if (!tweakModal || !tweakInput.trim() || tweakSubmitting) return
    setTweakSubmitting(true)
    try {
      const res = await fetch('/api/tweak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: tweakModal.text,
          instruction: tweakInput.trim(),
        }),
        credentials: 'include',
      })
      const json = (await res.json()) as { text?: string; error?: string; remaining?: number }
      if (res.status === 402) {
        setCredits(json.remaining ?? 0)
        setLowCreditsPopup(true)
        return
      }
      if (json.remaining !== undefined) setCredits(json.remaining)
      if (json.text) {
        const el = document.getElementById(tweakModal.elementId)
        if (el) el.textContent = json.text
        setTweakModal(null)
        setTweakInput('')
      } else alert('出错了。')
    } catch {
      alert('出错了。')
    } finally {
      setTweakSubmitting(false)
    }
  }, [tweakModal, tweakInput, tweakSubmitting])

  const copyText = useCallback((text: string, el: HTMLElement) => {
    const done = () => {
      el.style.backgroundColor = '#dcfce7'
      setTimeout(() => (el.style.backgroundColor = ''), 300)
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done))
    } else fallbackCopy(text, done)
  }, [])

  const styleCount = selectedStyles.size
  const enemyAvatar = getEnemyAvatar(userConfig.enemy, userConfig.enemyGender)
  const maxReached = styleCount >= MAX_STYLES

  return (
    <div className="h-screen flex flex-col relative bg-[#f0f2f5]">
      {/* Header */}
      <header className="w-full flex justify-between items-center px-4 py-3 bg-white/80 backdrop-blur-md border-b border-gray-200 z-20 shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-red-500 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-red-500/30 shadow-lg">
            🧧
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-gray-800 leading-none">
              胡言乱语文学
            </h1>
            <p className="text-[10px] text-gray-500 font-medium">通关所有新年灵魂拷问</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {credits !== null && (
            <button
              type="button"
              onClick={() => setLowCreditsPopup(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-colors text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100 cursor-pointer"
            >
              <CreditIcon className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-bold tabular-nums">{credits}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfigOpen((o) => !o)}
            className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 px-3.5 py-2 rounded-full text-xs font-bold text-gray-700 transition-all shadow-sm active:scale-95"
          >
            <span className="text-base">⚙️</span>
            <span>备战设定</span>
          </button>
        </div>
      </header>

      {/* Tweak modal */}
      {tweakModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setTweakModal(null)}
            aria-hidden
          />
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative shadow-2xl z-10 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-1">✨ 帮我改一下</h3>
            <p className="text-xs text-gray-500 mb-4">觉得这句不够好？告诉军师怎么改：</p>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">
                原话
              </p>
              <p className="text-sm text-gray-700 italic line-clamp-3">{tweakModal.text}</p>
            </div>
            <input
              type="text"
              value={tweakInput}
              onChange={(e) => setTweakInput(e.target.value)}
              placeholder="例：再凶一点 / 简短点 / 口语化一点"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-100 focus:outline-none text-gray-800 mb-4 transition-all"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setTweakModal(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitTweak}
                disabled={tweakSubmitting}
                className="px-4 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-600 text-white font-bold transition-colors flex items-center gap-2 shadow-lg shadow-red-500/30 disabled:opacity-50"
              >
                {tweakSubmitting ? '修改中...' : '重新生成'}
                <span className="inline-flex items-center gap-0.5 opacity-90">
                  <CreditIcon className="w-3.5 h-3.5" />
                  <span className="tabular-nums">{CREDIT_COST}</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Low credits popup — not enough credits, offer watch ad */}
      {lowCreditsPopup && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setLowCreditsPopup(false)}
            aria-hidden
          />
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative shadow-2xl z-10 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              {credits !== null && credits < CREDIT_COST ? '积分不够了' : '赚取积分'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">看一段短视频即可获得 {CREDITS_PER_VIDEO} 积分，可重复观看。</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLowCreditsPopup(false)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors font-medium"
              >
                稍后再说
              </button>
              <button
                type="button"
                onClick={() => {
                  setVideoAdModal(getRandomAd())
                  setLowCreditsPopup(false)
                }}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm bg-red-500 hover:bg-red-600 text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/30"
              >
                <VideoIcon className="w-5 h-5" />
                赚取积分
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video ad modal — uncloseable until required watch time (countdown), then can close; video plays in full */}
      {videoAdModal && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4">
          <div className="w-full max-w-lg flex flex-col items-center">
            <div className="relative w-full rounded-xl overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                src={videoAdModal.src}
                className="w-full h-full object-contain"
                playsInline
                muted={videoMuted}
              />
              <div className="absolute top-2 right-2">
                <button
                  type="button"
                  onClick={() => setVideoMuted((m) => !m)}
                  className="text-white bg-black/50 hover:bg-black/70 p-2 rounded-lg transition-colors flex items-center justify-center"
                  aria-label={videoMuted ? '打开声音' : '关闭声音'}
                >
                  <span aria-hidden>{videoMuted ? '🔇' : '🔊'}</span>
                </button>
              </div>
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center flex-wrap gap-2">
                {videoAdRewardGranted ? (
                  <button
                    type="button"
                    onClick={() => setVideoAdModal(null)}
                    className="text-white/80 hover:text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    关闭
                  </button>
                ) : (
                  <span className="text-white/90 text-sm font-medium bg-black/50 px-2 py-1 rounded">
                    观看 {adCountdown}s 后可获得积分
                  </span>
                )}
                {videoAdModal.link && (
                  <a
                    href={videoAdModal.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-col items-center justify-center text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-sm font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all hover:scale-[1.02]"
                  >
                    <span>马上报名</span>
                    <span className="text-xs font-medium opacity-95">免费VIP培训</span>
                  </a>
                )}
              </div>
            </div>
            <p className="text-white/70 text-xs mt-3">
              {videoAdRewardGranted
                ? `已获得 ${CREDITS_PER_VIDEO} 积分，可关闭或继续观看`
                : `观看满 ${getRequiredWatchDuration()} 秒后将获得 ${CREDITS_PER_VIDEO} 积分`}
            </p>
          </div>
        </div>
      )}

      {/* Config panel */}
      <div
        className={`absolute top-[60px] left-0 w-full bg-white border-b border-gray-100 z-30 shadow-xl rounded-b-3xl overflow-hidden transition-all ${
          configOpen ? '' : 'hidden'
        }`}
      >
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto hide-scrollbar">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1 h-4 bg-red-500 rounded-full" />
              我方属性
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={userConfig.gender}
                onChange={(e) => updateConfigFromUI({ gender: e.target.value })}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:border-red-500 focus:outline-none text-gray-700 font-medium"
              >
                <option value="未知">⚧️ 性别 (保密)</option>
                <option value="男">👦 男 (Ah Boy)</option>
                <option value="女">👧 女 (Ah Girl)</option>
              </select>
              <div className="relative">
                <input
                  type="number"
                  value={userConfig.age}
                  onChange={(e) => updateConfigFromUI({ age: e.target.value })}
                  placeholder="年龄"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:border-red-500 focus:outline-none text-gray-700 placeholder-gray-400 font-medium"
                />
                <span className="absolute right-3 top-3 text-xs text-gray-400 pointer-events-none">
                  岁
                </span>
              </div>
              <select
                value={userConfig.status}
                onChange={(e) => updateConfigFromUI({ status: e.target.value })}
                className="col-span-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm focus:border-red-500 focus:outline-none text-gray-700 font-medium"
              >
                <option value="只想躺平">🛌 只想躺平 (不要烦我)</option>
                <option value="单身打工族">💼 单身打工族 (没钱没对象)</option>
                <option value="单身学生">🎓 单身学生 (还在读书)</option>
                <option value="已婚未育">💍 已婚未育 (二人世界)</option>
                <option value="已婚有娃">👶 已婚有娃 (带娃很累)</option>
              </select>
            </div>
          </div>
          <hr className="border-gray-100" />
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1 h-4 bg-purple-500 rounded-full" />
                敌方身份
              </h3>
              <span className="text-xl">{enemyAvatar}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {RELATION_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => updateConfigFromUI({ enemy: r })}
                  className="px-4 py-2 bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-xl text-xs font-medium text-gray-600 transition-all active:scale-95 shadow-sm"
                >
                  {r === '隔壁老王' ? '老王' : r}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={userConfig.enemy}
              onChange={(e) => updateConfigFromUI({ enemy: e.target.value })}
              placeholder="输入称呼 (系统自动识别性别)..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-red-500 focus:outline-none text-gray-700 placeholder-gray-400 font-medium"
            />
          </div>
          <button
            type="button"
            onClick={() => setConfigOpen(false)}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-gray-200 active:scale-95 transition-all"
          >
            保存设定
          </button>
        </div>
      </div>

      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/20 z-20 backdrop-blur-[2px] transition-opacity ${
          overlayVisible ? '' : 'hidden'
        }`}
        onClick={() => {
          setConfigOpen(false)
          setStyleDrawerOpen(false)
        }}
        aria-hidden
      />

      {/* Chat — scrollable; min-h-0 so flex child can shrink and scroll */}
      <main
        ref={chatContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-8 hide-scrollbar chat-main-pb"
        onClick={() => setStyleDrawerOpen(false)}
      >
        {showWelcome && (
          <div className="flex flex-col items-center mt-6 mb-8 text-center space-y-6">
            <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center text-5xl shadow-2xl shadow-red-100 border-4 border-white relative rotate-3 transform transition hover:rotate-0 hover:scale-105 duration-300">
              🧙‍♂️
              <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-yellow-950 text-xs font-bold px-3 py-1 rounded-full border-2 border-white shadow-sm">
                军师
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-gray-800 font-bold text-xl">老板，新年快乐！</h2>
              <p className="text-gray-500 text-sm max-w-[260px] mx-auto leading-relaxed">
                遇到三姑六婆刁难不要慌，把问题丢给我。
              </p>
            </div>
            <div className="w-full max-w-sm px-2">
              <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest mb-3">
                常见地雷 (点击开怼)
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {['几时要结婚？', '工钱多少啊？', '有对象了吗？', '几时买屋子？'].map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (userInputRef.current) {
                        userInputRef.current.value = q
                        sendMessage()
                      }
                    }}
                    className="quick-chip bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all active:scale-95"
                  >
                    {['💍 几时结婚？', '💰 工钱多少？', '👫 有对象吗？', '🏠 几时买房？'][i]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          if (msg.type === 'enemy') {
            return (
              <div key={msg.id} className="flex items-end gap-3 msg-enter-left">
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-white flex items-center justify-center text-4xl shadow-md shrink-0 avatar-box z-10">
                  {enemyAvatar}
                </div>
                <div className="bg-white border border-gray-100 text-gray-800 px-5 py-4 rounded-3xl rounded-bl-none shadow-sm max-w-[75%] text-sm leading-relaxed mb-1">
                  <p className="text-[10px] text-gray-400 mb-1 font-bold">{userConfig.enemy}</p>
                  {msg.text.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </div>
            )
          }
          if (msg.type === 'loading') {
            return (
              <div key={msg.id} className="flex flex-row-reverse items-end gap-3 msg-enter-right mt-4">
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-white flex items-center justify-center text-4xl shadow-md shrink-0 avatar-box z-10">
                  🧙‍♂️
                </div>
                <div className="bg-red-50 border border-red-100 px-5 py-4 rounded-3xl rounded-br-none shadow-sm flex items-center gap-2 mb-1">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full typing-dot" />
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full typing-dot" />
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full typing-dot" />
                  </div>
                  <span className="text-xs text-red-400 font-medium">军师正在想...</span>
                </div>
              </div>
            )
          }
          if (msg.type === 'ai-simple') {
            return (
              <div
                key={msg.id}
                className="flex flex-row-reverse items-end gap-3 msg-enter-right mt-4"
              >
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-white flex items-center justify-center text-4xl shadow-md shrink-0 avatar-box z-10">
                  🧙‍♂️
                </div>
                <div className="bg-white border border-gray-200 px-5 py-4 rounded-3xl rounded-br-none shadow-sm text-sm text-gray-600">
                  {msg.text}
                </div>
              </div>
            )
          }
          // ai
          return (
            <div key={msg.id} className="flex flex-col items-end gap-2 w-full mt-4">
              <div className="flex flex-row-reverse items-center gap-3 w-full msg-enter-right">
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-white flex items-center justify-center text-4xl shadow-md shrink-0 avatar-box z-10">
                  🧙‍♂️
                </div>
                <div className="text-xs text-gray-400 mr-1 bg-white/50 px-2 py-1 rounded-lg">
                  军师出招：
                </div>
              </div>
              <div className="w-full pl-12 pr-1 space-y-3">
            {Object.entries(msg.data).map(([key, text]: [string, string]) => {
              const style = STYLE_DEF[key] || { label: '❓ 未知', color: 'gray' }
                  const colors = COLOR_MAP[style.color] || COLOR_MAP.gray
                  const elementId = `card-${msg.id}-${key}`
                  return (
                    <div
                      key={key}
                      className={`card-pop bg-white border-l-4 ${colors.border} rounded-2xl p-4 relative shadow-sm border border-gray-100 group cursor-pointer`}
                      onClick={(e) => copyText(text, e.currentTarget as HTMLElement)}
                    >
                      <button
                        type="button"
                        className="absolute right-2 top-2 px-2 py-1 rounded-lg bg-yellow-500/10 text-yellow-700 text-[10px] font-black flex items-center gap-1 active:scale-90 transition-all border border-yellow-500/20"
                        onClick={(e) => {
                          e.stopPropagation()
                          setTweakModal({ elementId, text })
                          setTweakInput('')
                        }}
                      >
                        <span>✨ 优化</span>
                      </button>
                      <div className="flex justify-between items-center mb-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${colors.badge}`}
                        >
                          {style.label}
                        </span>
                        <span className="text-[10px] text-gray-400 mr-12">点击复制</span>
                      </div>
                      <p id={elementId} className="text-base text-gray-800 leading-relaxed font-medium">
                        {text}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </main>

      {/* Style drawer */}
      <div
        className={`fixed bottom-0 left-0 w-full bg-white border-t border-gray-100 rounded-t-[2rem] z-40 flex flex-col max-h-[75vh] shadow-[0_-10px_60px_rgba(0,0,0,0.1)] ${
          styleDrawerOpen ? '' : 'hidden'
        }`}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white rounded-t-[2rem] sticky top-0 z-10">
          <div>
            <h3 className="font-bold text-gray-800 text-base">选择回怼风格</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              最多选 4 个 (<span className="font-bold text-red-500">{styleCount}</span>/4)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setStyleDrawerOpen(false)}
            className="bg-gray-100 p-2 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto hide-scrollbar bg-gray-50/50">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(STYLE_DEF).map(([key, val]) => {
              const isActive = selectedStyles.has(key)
              const disabled = maxReached && !isActive
              const colors = COLOR_MAP[val.color]
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (disabled) return
                    toggleStyle(key)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && !disabled && toggleStyle(key)}
                  className={`relative p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center gap-3 select-none active:scale-95 shadow-sm ${
                    isActive
                      ? `${colors.bg} ${colors.border} ring-1 ring-inset ${colors.text}`
                      : `bg-white border-gray-100 hover:border-gray-200 ${disabled ? 'opacity-40 grayscale cursor-not-allowed' : ''}`
                  }`}
                >
                  <div className="text-3xl">{val.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-bold text-sm ${isActive ? colors.text : 'text-gray-700'}`}
                    >
                      {val.label}
                    </div>
                    <div
                      className={`text-[10px] truncate ${isActive ? colors.text : 'text-gray-400'}`}
                    >
                      {val.desc}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="h-8" />
        </div>
      </div>

      {/* Footer — fixed at bottom so chatbox is always visible on mobile */}
      <footer className="fixed inset-x-0 bottom-0 w-full bg-white/95 backdrop-blur-xl border-t border-gray-200 z-30 flex flex-col shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <div
          className="w-full px-4 py-2 border-b border-gray-100 flex justify-between items-center bg-white cursor-pointer shrink-0"
          onClick={() => setStyleDrawerOpen(true)}
        >
          <div className="flex flex-wrap items-center gap-2 overflow-hidden flex-1 mr-2 min-w-0">
            {Array.from(selectedStyles).map((key) => {
              const def = STYLE_DEF[key]
              const colors = COLOR_MAP[def.color]
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${colors.bg} ${colors.text} border ${colors.border} text-[10px] font-medium`}
                >
                  <span>{def.icon}</span> {def.label.split(' ')[1]}
                </span>
              )
            })}
          </div>
          <span className="flex items-center gap-1.5 text-[11px] font-bold bg-yellow-50 hover:bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full transition-colors border border-yellow-200 shrink-0">
            <span>🎨 调整风格</span>
            <span className="bg-white text-yellow-600 px-1.5 rounded-full text-[10px] shadow-sm">
              {styleCount}
            </span>
          </span>
        </div>
        <div className="p-3 pb-safe max-w-2xl mx-auto flex items-end gap-2 w-full bg-white shrink-0">
          <div className="relative flex-1">
            <textarea
              ref={userInputRef}
              rows={1}
              placeholder="输入亲戚的问题..."
              className="w-full bg-gray-100 text-gray-800 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 resize-none max-h-32 hide-scrollbar placeholder-gray-400 transition-all border border-transparent"
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement
                t.style.height = ''
                t.style.height = t.scrollHeight + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={sendMessage}
            disabled={sending}
            className="bg-red-500 hover:bg-red-600 text-white w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all disabled:opacity-50 disabled:grayscale shrink-0 shadow-lg shadow-red-900/30 active:scale-95"
          >
            <svg
              className="w-5 h-5 ml-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold opacity-90">
              <CreditIcon className="w-3 h-3" />
              <span className="tabular-nums">{CREDIT_COST}</span>
            </span>
          </button>
        </div>
      </footer>
    </div>
  )
}

function fallbackCopy(text: string, cb: () => void) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  try {
    if (document.execCommand('copy')) cb()
  } catch {}
  document.body.removeChild(ta)
}
