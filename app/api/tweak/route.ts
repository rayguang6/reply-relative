import { NextRequest, NextResponse } from 'next/server'

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'DEEPSEEK_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const { originalText, instruction } = await req.json()
    const userContent = `Original: "${originalText}". Instruction: "${instruction}". 用华语重写，保持马来西亚华人口语风格（可带一点口语/方言感），但不要用马来文（Bahasa），不要用英文。只返回修改后的文字，不要其他说明。`
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    if (text) {
      return NextResponse.json({ text })
    }
    return NextResponse.json(
      { error: data.error?.message || 'DeepSeek API error' },
      { status: res.status }
    )
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Request failed' },
      { status: 500 }
    )
  }
}
