import { NextRequest, NextResponse } from 'next/server'
import { getCredits, addRewardCredits } from '@/lib/credits'

export async function GET(req: NextRequest) {
  const { credits, setCookie } = getCredits(req)
  const res = NextResponse.json({ credits })
  if (setCookie) res.headers.set('Set-Cookie', setCookie)
  return res
}

/** Grant credits after user completes watching an ad. Call once per completed watch; unlimited. */
export async function POST(req: NextRequest) {
  const { credits, setCookie } = addRewardCredits(req)
  const res = NextResponse.json({ credits })
  res.headers.set('Set-Cookie', setCookie)
  return res
}
