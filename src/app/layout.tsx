import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sprints Flutter OS — Modular Learning Tracker',
  description:
    'ACC × Sprints Flutter Bootcamp — 4 Parallel Track Learning System with AI Study Studio, Progress Analytics & Kanban Board.',
  keywords: ['flutter', 'bootcamp', 'learning', 'tracker', 'ACC', 'Sprints'],
}

export const viewport: Viewport = {
  themeColor: '#09090b',
}


export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans bg-[#09090b] text-white antialiased min-h-[100dvh] overflow-x-hidden`}
        suppressHydrationWarning
      >
        {/* Ambient background orbs */}
        <div className="ambient-orb w-96 h-96 bg-cyan-500 top-[-5rem] left-[-5rem]" />
        <div className="ambient-orb w-80 h-80 bg-purple-500 top-[30%] right-[-4rem]" />
        <div className="ambient-orb w-72 h-72 bg-amber-500 bottom-[10%] left-[20%]" />
        <div className="ambient-orb w-64 h-64 bg-emerald-500 bottom-[-3rem] right-[30%]" />

        {/* Main content above orbs */}
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  )
}
