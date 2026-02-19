import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest } from 'next/server'
import { CREDITS_PER_VIDEO as CREDITS_PER_VIDEO_CONST } from './constants'

/**
 * Credit system: anonymous cookie-based, no login.
 * Balance is stored in a signed cookie so it persists across server restarts/cold starts.
 * Set CREDITS_ENABLED=false in env to disable (everyone gets free usage).
 * Set CREDITS_SECRET in production so the signed cookie cannot be forged (otherwise a dev default is used).
 */
export const CREDITS_ENABLED = process.env.CREDITS_ENABLED !== 'false'

const COOKIE_NAME = 'credits'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days
const INITIAL_CREDITS = 50
export const COST_PER_ACTION = 10
export const CREDITS_PER_VIDEO = CREDITS_PER_VIDEO_CONST

const getSecret = (): Buffer =>
  Buffer.from(process.env.CREDITS_SECRET || 'dev-credits-secret-change-in-production', 'utf8')

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str: string): Buffer | null {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (3 - (str.length % 4)) % 4)
    return Buffer.from(base64, 'base64')
  } catch {
    return null
  }
}

type Payload = { i: string; b: number }

function sign(payload: Payload): string {
  const json = JSON.stringify(payload)
  const data = Buffer.from(json, 'utf8')
  const sig = createHmac('sha256', getSecret()).update(data).digest()
  return b64urlEncode(data) + '.' + b64urlEncode(sig)
}

function verifyAndParse(cookieValue: string): Payload | null {
  const dot = cookieValue.indexOf('.')
  if (dot === -1) return null
  const dataB64 = cookieValue.slice(0, dot)
  const sigB64 = cookieValue.slice(dot + 1)
  const data = b64urlDecode(dataB64)
  const sig = sigB64 ? b64urlDecode(sigB64) : null
  if (!data || !sig) return null
  const expected = createHmac('sha256', getSecret()).update(data).digest()
  if (expected.length !== sig.length || !timingSafeEqual(expected, sig)) return null
  try {
    const parsed = JSON.parse(data.toString('utf8')) as Payload
    if (typeof parsed.i !== 'string' || typeof parsed.b !== 'number' || parsed.b < 0) return null
    return parsed
  } catch {
    return null
  }
}

function buildCookie(payload: Payload): string {
  const value = sign(payload)
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`
}

/**
 * Read credits state from request cookie. Returns id, balance, and setCookie when we had to create a new one.
 */
function readCreditsCookie(req: NextRequest): { id: string; balance: number; setCookie?: string } {
  const raw = req.cookies.get(COOKIE_NAME)?.value
  const parsed = raw ? verifyAndParse(raw) : null
  if (parsed) return { id: parsed.i, balance: parsed.b }

  const id = crypto.randomUUID()
  const balance = INITIAL_CREDITS
  const setCookie = buildCookie({ i: id, b: balance })
  return { id, balance, setCookie }
}

export type CreditResult = {
  allowed: boolean
  remaining?: number
  setCookie?: string
}

/**
 * Check balance and deduct cost if allowed. When credits are disabled, always allows and does not touch cookie.
 */
export async function checkAndConsume(
  req: NextRequest,
  cost: number = COST_PER_ACTION
): Promise<CreditResult> {
  if (!CREDITS_ENABLED) return { allowed: true }

  const { id, balance, setCookie: initialSetCookie } = readCreditsCookie(req)
  if (balance < cost) {
    return { allowed: false, remaining: balance, setCookie: initialSetCookie }
  }
  const newBalance = balance - cost
  const setCookie = buildCookie({ i: id, b: newBalance })
  return { allowed: true, remaining: newBalance, setCookie }
}

/**
 * Get current balance without deducting. Used for UI. Returns setCookie when new user.
 */
export function getCredits(req: NextRequest): { credits: number; setCookie?: string } {
  if (!CREDITS_ENABLED) return { credits: 999 }

  const { balance, setCookie } = readCreditsCookie(req)
  return { credits: balance, setCookie }
}

/**
 * Add reward credits (e.g. after watching an ad). Returns new balance and setCookie.
 */
export function addRewardCredits(
  req: NextRequest,
  amount: number = CREDITS_PER_VIDEO
): { credits: number; setCookie: string } {
  if (!CREDITS_ENABLED) return { credits: 999, setCookie: '' }

  const { id, balance, setCookie: _ } = readCreditsCookie(req)
  const newBalance = balance + amount
  const setCookie = buildCookie({ i: id, b: newBalance })
  return { credits: newBalance, setCookie }
}

export const CREDITS_COOKIE = { name: COOKIE_NAME, maxAge: COOKIE_MAX_AGE }
