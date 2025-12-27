import type { Metadata } from 'next'
import { DM_Sans, Fira_Code } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
})

const firaCode = Fira_Code({
  subsets: ['latin'],
  variable: '--font-fira-code',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Video Understanding Comparisons',
  description: 'Compare video understanding across different Gemini models',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${firaCode.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}

