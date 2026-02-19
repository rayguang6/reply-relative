export const MAX_STYLES = 4

/** Cost in credits per action (send message, tweak/regenerate). Must match lib/credits.ts COST_PER_ACTION. */
export const CREDIT_COST = 10
/** Credits granted per completed ad watch. Must match lib/credits.ts CREDITS_PER_VIDEO. */
export const CREDITS_PER_VIDEO = 30

export const STYLE_DEF: Record<
  string,
  { label: string; desc: string; color: string; icon: string }
> = {
  normal: { label: '🍵 正常', desc: '礼貌/得体/敷衍', color: 'green', icon: '🍵' },
  savage: { label: '🔥 怼人', desc: '阴阳怪气/回呛', color: 'purple', icon: '🔥' },
  funny: { label: '🤡 幽默', desc: '机智/搞笑', color: 'blue', icon: '🤡' },
  nonsense: { label: '😵 发疯', desc: '答非所问/无厘头', color: 'yellow', icon: '😵' },
  haolian: { label: '✨ 炫耀', desc: '凡尔赛/Hao Lian', color: 'pink', icon: '✨' },
  victim: { label: '🥺 卖惨', desc: '哭穷/Kena Sai', color: 'teal', icon: '🥺' },
  philosopher: { label: '🧘 佛系', desc: '大师/废话文学', color: 'indigo', icon: '🧘' },
  greentea: { label: '🍵 绿茶', desc: '心机/暗讽', color: 'emerald', icon: '🍵' },
  logic: { label: '🤓 讲道理', desc: '硬核逻辑/律师', color: 'gray', icon: '🤓' },
}

export const COLOR_MAP: Record<
  string,
  { bg: string; border: string; text: string; badge: string }
> = {
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', badge: 'bg-purple-100 text-purple-800' },
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-800' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', badge: 'bg-pink-100 text-pink-800' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', badge: 'bg-teal-100 text-teal-800' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', badge: 'bg-indigo-100 text-indigo-800' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800' },
}

export type UserConfig = {
  gender: string
  age: string
  status: string
  enemy: string
  enemyGender: '男' | '女'
}

export const RELATION_OPTIONS = ['三姑', '六婆', '叔叔', '熊孩子', '隔壁老王'] as const

export function getEnemyAvatar(enemy: string, enemyGender: string): string {
  if (enemy.includes('王')) return '🧔'
  if (enemy.includes('熊')) return '👶'
  return enemyGender === '男' ? '👴' : '👵'
}

export function inferEnemyGender(enemy: string): '男' | '女' {
  const m = ['叔', '舅', '公', '哥', '爸', '爷', '王', '弟', '男']
  const f = ['姑', '姨', '婆', '姐', '妈', '奶', '女', '婶']
  return m.some((k) => enemy.includes(k)) ? '男' : '女'
}
