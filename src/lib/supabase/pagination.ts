/**
 * Helper de pagination pour contourner la limite par défaut de 1000 lignes
 * imposée par PostgREST / Supabase.
 *
 * Utilisation :
 *   const rows = await fetchAllPaginated((from, to) =>
 *     supabase
 *       .from('users')
 *       .select('*')
 *       .order('created_at', { ascending: false })
 *       .range(from, to)
 *   )
 *
 * Le builder doit renvoyer le PostgrestBuilder tel quel (avec .range()),
 * il sera `await` ici pour récupérer { data, error }.
 */

const DEFAULT_PAGE_SIZE = 1000

type PageBuilder<T> = (from: number, to: number) => PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>

export async function fetchAllPaginated<T>(
  builder: PageBuilder<T>,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<T[]> {
  const results: T[] = []
  let from = 0

  // Boucle tant que la page précédente était "pleine" — si on récupère
  // moins de `pageSize` lignes, c'est qu'on est arrivé au bout.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await builder(from, to)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    results.push(...data)

    if (data.length < pageSize) {
      break
    }

    from += pageSize
  }

  return results
}
