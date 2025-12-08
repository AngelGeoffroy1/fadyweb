'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { User } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/types'

type Admin = Database['public']['Tables']['admins']['Row']

interface UseAdminReturn {
  user: User | null
  admin: Admin | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
  isAdmin: boolean
  refresh: () => Promise<void>
}

export function useAdmin(): UseAdminReturn {
  const [user, setUser] = useState<User | null>(null)
  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)

  // Mémoïser le client Supabase pour éviter les re-créations
  const supabase = useMemo(() => createClient(), [])

  const fetchAdminData = useCallback(async (userId: string): Promise<Admin | null> => {
    try {
      const { data: adminData, error: adminError } = await supabase
        .from('admins')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (adminError && adminError.code !== 'PGRST116') {
        console.error('Erreur lors de la vérification admin:', adminError)
        throw new Error('Erreur lors de la vérification des droits administrateur')
      }

      return adminData
    } catch (err) {
      console.error('Erreur lors de la récupération des données admin:', err)
      throw err
    }
  }, [supabase])

  const refresh = useCallback(async () => {
    if (!user) return
    
    try {
      setError(null)
      const adminData = await fetchAdminData(user.id)
      setAdmin(adminData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur inattendue s\'est produite')
    }
  }, [user, fetchAdminData])

  const initializeAuth = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Récupérer la session actuelle
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Erreur lors de la récupération de la session:', sessionError)
        setError('Erreur d\'authentification')
        setUser(null)
        setAdmin(null)
        return
      }

      if (session?.user) {
        setUser(session.user)
        
        // Vérifier les droits admin
        try {
          const adminData = await fetchAdminData(session.user.id)
          setAdmin(adminData)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erreur lors de la vérification des droits')
          setAdmin(null)
        }
      } else {
        setUser(null)
        setAdmin(null)
      }
    } catch (err) {
      console.error('Erreur lors de l\'initialisation:', err)
      setError('Une erreur inattendue s\'est produite')
      setUser(null)
      setAdmin(null)
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [supabase, fetchAdminData])

  useEffect(() => {
    if (!initialized) {
      initializeAuth()
    }
  }, [initialized, initializeAuth])

  useEffect(() => {
    if (!initialized) return

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email)

        // Ignorer INITIAL_SESSION car déjà géré par initializeAuth()
        if (event === 'INITIAL_SESSION') {
          return
        }

        if (event === 'SIGNED_OUT' || !session?.user) {
          setUser(null)
          setAdmin(null)
          setError(null)
          setLoading(false)
          return
        }

        // CRITIQUE : Ne JAMAIS faire d'appels Supabase async ici !
        // Cela bloque toutes les autres requêtes Supabase dans l'app
        // Voir: https://github.com/supabase/auth-js/issues/762
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          // Mise à jour silencieuse du user seulement
          setUser(session.user)
          setError(null)
          setLoading(false)

          // Déclencher un refresh async en dehors du callback
          // via un state trigger ou window event
          if (event === 'SIGNED_IN' && session.user.id !== user?.id) {
            // Nouveau user connecté, on doit recharger les données admin
            // On utilise un effet séparé pour cela
            setTimeout(() => {
              fetchAdminData(session.user.id)
                .then(setAdmin)
                .catch(() => setAdmin(null))
            }, 0)
          }
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [initialized, supabase, fetchAdminData, user])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Erreur lors de la déconnexion:', err)
    }
  }, [supabase])

  return {
    user,
    admin,
    loading,
    error,
    signOut,
    isAdmin: !!admin,
    refresh
  }
}