'use client'

export const dynamic = 'force-dynamic'

import { useAdmin } from '@/lib/hooks/useAdmin'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { LogOut, Users, Scissors, FileCheck, Settings, Menu, ChevronLeft, Calendar, Shield, CreditCard, Wallet, MessageSquare, Crown, Smartphone } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, admin, loading, error, signOut, isAdmin } = useAdmin()
  const router = useRouter()
  const pathname = usePathname()
  
  // État de la sidebar avec persistence localStorage
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    if (!loading && !isAdmin && !error) {
      router.push('/login')
    }
  }, [loading, isAdmin, error, router])

  // Détection mobile et persistence de la sidebar
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    // Charger la préférence depuis localStorage
    const savedSidebarState = localStorage.getItem('sidebar-open')
    if (savedSidebarState !== null) {
      setSidebarOpen(JSON.parse(savedSidebarState))
    }
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Sauvegarder l'état de la sidebar
  useEffect(() => {
    localStorage.setItem('sidebar-open', JSON.stringify(sidebarOpen))
  }, [sidebarOpen])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  if (loading) {
    return <LoadingSpinner />
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-4">Erreur d'authentification</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => router.push('/login')}>
            Retour à la connexion
          </Button>
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return null
  }

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Users },
    { name: 'Utilisateurs', href: '/dashboard/users', icon: Users },
    { name: 'Coiffeurs', href: '/dashboard/hairdressers', icon: Scissors },
    { name: 'Réservations', href: '/dashboard/bookings', icon: Calendar },
    { name: 'Abonnements', href: '/dashboard/subscriptions', icon: CreditCard },
    { name: 'Ambassadeurs', href: '/dashboard/ambassadors', icon: Crown },
    { name: 'Stripe Connect', href: '/dashboard/stripe-payments', icon: Wallet },
    { name: 'Diplômes', href: '/dashboard/diplomas', icon: FileCheck },
    { name: 'Modération', href: '/dashboard/moderation', icon: Shield },
    { name: 'Support Tickets', href: '/dashboard/support-tickets', icon: MessageSquare },
    { name: 'Version App', href: '/dashboard/app-version', icon: Smartphone },
    { name: 'Administrateurs', href: '/dashboard/admins', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Bouton hamburger fixe pour mobile uniquement */}
      {isMobile && !sidebarOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed top-4 left-4 z-[60] p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-muted transition-colors"
          onClick={toggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </motion.button>
      )}

      {/* Backdrop mobile */}
      {isMobile && sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{
          width: isMobile ? (sidebarOpen ? 256 : 0) : (sidebarOpen ? 256 : 80),
          x: isMobile ? (sidebarOpen ? 0 : -256) : 0,
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`fixed inset-y-0 left-0 z-50 bg-card border-r border-border overflow-hidden ${
          isMobile ? 'shadow-xl' : ''
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo et bouton de fermeture */}
          <div className="flex items-center justify-between h-16 border-b border-border px-4">
            {sidebarOpen && !isMobile ? (
              <>
                <h1 className="text-xl font-bold text-primary">Fady Admin</h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="p-1 h-8 w-8"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <div className="w-full flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSidebar}
                  className="p-2 h-8 w-8 hover:bg-muted"
                >
                  <Menu className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.name} href={item.href}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center ${
                      sidebarOpen && !isMobile ? 'space-x-3' : 'justify-center'
                    } px-3 py-2 rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                    title={!sidebarOpen || isMobile ? item.name : ''}
                  >
                    <item.icon className="w-5 h-5" />
                    {sidebarOpen && !isMobile && (
                      <motion.span
                        initial={{ opacity: 1 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="font-medium"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </motion.div>
                </Link>
              )
            })}
          </nav>

          {/* User info and logout */}
          <div className="p-4 border-t border-border">
            {sidebarOpen && !isMobile ? (
              <>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-primary-foreground text-sm font-bold">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user?.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {admin?.role || 'Admin'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="w-full transition-all duration-200 hover:scale-[1.02]"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Déconnexion
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center space-y-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-sm font-bold">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="p-2"
                  title="Déconnexion"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main content */}
      <motion.div
        animate={{
          paddingLeft: isMobile ? 0 : (sidebarOpen ? 256 : 80),
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="min-h-screen"
      >
        {/* Header avec bouton de thème */}
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-end p-4">
            <ThemeToggle />
          </div>
        </div>
        
        <main className="p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            {children}
          </motion.div>
        </main>
      </motion.div>
    </div>
  )
}
