import { NextRequest, NextResponse } from 'next/server'
import { checkAndConsume } from '@/lib/credits'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

function jsonWithCookie(data: object, status: number, setCookie?: string) {
  const res = NextResponse.json(data, { status })
  if (setCookie) res.headers.set('Set-Cookie', setCookie)
  return res
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'DEEPSEEK_API_KEY not configured' },
      { status: 500 }
    )
  }

  const credit = await checkAndConsume(req)
  if (!credit.allowed) {
    return jsonWithCookie(
      { error: 'Credits 不够了，用完了。', remaining: credit.remaining ?? 0 },
      402,
      credit.setCookie
    )
  }

  try {
    const { prompt, userMessage } = await req.json()
    if (!prompt || !userMessage) {
      return NextResponse.json(
        { error: 'prompt and userMessage required' },
        { status: 400 }
      )
    }

    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content?.trim()
    if (!raw) {
      return NextResponse.json(
        { error: data.error?.message || 'DeepSeek API error' },
        { status: res.status >= 400 ? res.status : 500 }
      )
    }

    const content = parseJsonContent(raw)
    return jsonWithCookie(
      content ? { content, remaining: credit.remaining } : {},
      200,
      credit.setCookie
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Request failed' },
      { status: 500 }
    )
  }
}

function parseJsonContent(raw: string): Record<string, string> | null {
  const trimmed = raw.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0]) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const result: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') result[k] = v
      }
      return Object.keys(result).length ? result : null
    }
  } catch {
    // ignore parse errors
  }
  return null
}
