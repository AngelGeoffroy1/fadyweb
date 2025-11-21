import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact - Fady',
  description: 'Contactez l\'assistance Fady pour toute question ou demande',
}

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

