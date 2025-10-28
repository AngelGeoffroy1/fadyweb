import localFont from 'next/font/local'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

// Configuration temporaire des polices - remplacez par les vraies polices Uber Move
const uberMoveMedium = localFont({
  src: [
    {
      path: './fonts/UberMoveMedium.otf',
      weight: '400',
      style: 'normal',
    }
  ],
  variable: '--font-uber-move-medium',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif']
})

const uberMoveBold = localFont({
  src: [
    {
      path: './fonts/UberMoveBold.otf',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-uber-move-bold',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif']
})

export const metadata = {
  title: 'Fady Admin Dashboard',
  description: 'Interface d\'administration pour la plateforme Fady',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${uberMoveMedium.variable} ${uberMoveBold.variable}`}>
      <body className={`${uberMoveMedium.className} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}