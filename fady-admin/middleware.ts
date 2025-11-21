import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({
              request,
            })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // Vérifier la session utilisateur
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    // Gestion des erreurs d'authentification
    if (userError) {
      console.error('Erreur middleware auth:', userError)
      if (request.nextUrl.pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/login?error=auth', request.url))
      }
      return supabaseResponse
    }

    const isDashboardRoute = request.nextUrl.pathname.startsWith('/dashboard')
    const isLoginRoute = request.nextUrl.pathname === '/login'

    // Redirection pour les utilisateurs non connectés
    if (!user && isDashboardRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // Redirection pour les utilisateurs connectés vers le dashboard
    if (user && isLoginRoute) {
      try {
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (adminError && adminError.code !== 'PGRST116') {
          console.error('Erreur middleware admin check login:', adminError)
          return supabaseResponse
        }

        if (adminData) {
          return NextResponse.redirect(new URL('/dashboard', request.url))
        }
      } catch (err) {
        console.error('Erreur inattendue middleware login:', err)
        return supabaseResponse
      }
    }

    // Vérification des droits admin pour le dashboard
    if (user && isDashboardRoute) {
      try {
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (adminError && adminError.code !== 'PGRST116') {
          console.error('Erreur middleware admin check:', adminError)
          return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
        }

        if (!adminData) {
          return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
        }
      } catch (err) {
        console.error('Erreur inattendue middleware:', err)
        return NextResponse.redirect(new URL('/login?error=server', request.url))
      }
    }

    return supabaseResponse
  } catch (error) {
    console.error('Erreur critique middleware:', error)
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      return NextResponse.redirect(new URL('/login?error=server', request.url))
    }
    return supabaseResponse
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
