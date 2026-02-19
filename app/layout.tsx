import type { Metadata } from 'next'
import { Noto_Sans_SC } from 'next/font/google'
import './globals.css'

const noto = Noto_Sans_SC({
  weight: ['400', '500', '700', '900'],
  subsets: ['latin'],
  variable: '--font-noto',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '胡言乱语文学 v3.3',
  icons: {
    icon: '/images/app-icon.png',
    apple: '/images/app-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-MY" suppressHydrationWarning>
      <body className={noto.variable} suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
