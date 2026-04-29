-- Visibility helper: an authenticated user may read another user's profile
-- only if they are related through a conversation, a booking, or through a
-- publicly-visible review. Runs as SECURITY DEFINER so it can consult the
-- related tables without inheriting the caller's RLS on them.
CREATE OR REPLACE FUNCTION public.can_view_user_profile(target_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    auth.uid() = target_id
    OR EXISTS (
      SELECT 1
      FROM public.conversations c
      LEFT JOIN public.hairdressers h ON h.id = c.hairdresser_id
      WHERE (c.user_id = auth.uid() AND h.user_id = target_id)
         OR (c.user_id = target_id AND h.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.bookings b
      LEFT JOIN public.hairdressers h ON h.id = b.hairdresser_id
      WHERE (b.user_id = auth.uid() AND h.user_id = target_id)
         OR (b.user_id = target_id AND h.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.reviews r WHERE r.user_id = target_id
    );
$$;

REVOKE ALL ON FUNCTION public.can_view_user_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_user_profile(uuid) TO authenticated;

-- Replace the blanket "qual: true" policy with the narrow helper.
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.users;

CREATE POLICY "Users can view related profiles"
ON public.users
FOR SELECT
TO authenticated
USING (public.can_view_user_profile(id));;
