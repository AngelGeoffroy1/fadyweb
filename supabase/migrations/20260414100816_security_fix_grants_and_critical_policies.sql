
-- =================================================
-- SECURITY FIX PART 1: Grants & Critical Policies
-- =================================================

-- =================================================
-- STEP 1: Revoke ALL from anon on sensitive tables
-- =================================================
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.bookings FROM anon;
REVOKE ALL ON public.conversations FROM anon;
REVOKE ALL ON public.messages FROM anon;
REVOKE ALL ON public.user_device_tokens FROM anon;
REVOKE ALL ON public.fady_pro_device_tokens FROM anon;
REVOKE ALL ON public.notification_preferences FROM anon;
REVOKE ALL ON public.notification_logs FROM anon;
REVOKE ALL ON public.user_favorites FROM anon;
REVOKE ALL ON public.admins FROM anon;
REVOKE ALL ON public.stripe_payments FROM anon;
REVOKE ALL ON public.refunds FROM anon;
REVOKE ALL ON public.support_tickets FROM anon;
REVOKE ALL ON public.blocked_clients FROM anon;
REVOKE ALL ON public.profile_views FROM anon;
REVOKE ALL ON public.hairdresser_diploma_verification FROM anon;
REVOKE ALL ON public.ambassador_whitelist FROM anon;
REVOKE ALL ON public.hairdresser_subscriptions FROM anon;
REVOKE ALL ON public.chat_banned_words FROM anon;

-- Restrict anon to ONLY SELECT on public-facing tables
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.hairdressers FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.hairdresser_services FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.hairdresser_gallery FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.hairdresser_availability FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.hairdresser_schedule_exceptions FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.reviews FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.app_version FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.invisible_hairdressers FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.hairdresser_stripe_accounts FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.preferences FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.subscription_fees FROM anon;

-- Remove dangerous TRUNCATE/TRIGGER/REFERENCES from authenticated
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;

-- =================================================
-- STEP 2: FIX users TABLE
-- CRITICAL: "Users can view all profiles" (qual: true)
-- allows anon to dump ALL user data (emails, phones, etc.)
-- =================================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;

-- Authenticated users can still view profiles (needed for the app)
CREATE POLICY "Authenticated users can view profiles"
  ON public.users FOR SELECT
  TO authenticated
  USING (true);

-- Fix INSERT: was with_check: true (anyone could insert any profile)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- =================================================
-- STEP 3: FIX bookings TABLE
-- VULNERABILITY: Exposes all active bookings to anon users
-- =================================================
DROP POLICY IF EXISTS "Users can view booking time slots for availability checking" ON public.bookings;

CREATE POLICY "Authenticated users can check booking availability"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    status = ANY (ARRAY['confirmed'::text, 'pending'::text, 'en_cours'::text])
  );

-- =================================================
-- STEP 4: FIX hairdressers TABLE
-- CRITICAL: "Allow stats update" (qual: true, with_check: true)
-- lets ANY authenticated user UPDATE ANY hairdresser profile
-- =================================================
DROP POLICY IF EXISTS "Allow stats update for hairdressers" ON public.hairdressers;

-- Replace with automatic trigger on reviews
CREATE OR REPLACE FUNCTION public.recalculate_hairdresser_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE public.hairdressers
    SET 
      rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r WHERE r.hairdresser_id = OLD.hairdresser_id), 0),
      total_reviews = (SELECT COUNT(*) FROM public.reviews r WHERE r.hairdresser_id = OLD.hairdresser_id)
    WHERE id = OLD.hairdresser_id;
    RETURN OLD;
  ELSE
    UPDATE public.hairdressers
    SET 
      rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r WHERE r.hairdresser_id = NEW.hairdresser_id), 0),
      total_reviews = (SELECT COUNT(*) FROM public.reviews r WHERE r.hairdresser_id = NEW.hairdresser_id)
    WHERE id = NEW.hairdresser_id;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_recalculate_hairdresser_stats ON public.reviews;
CREATE TRIGGER trigger_recalculate_hairdresser_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_hairdresser_stats();

-- Also provide RPC function for manual stats recalculation (admin use)
CREATE OR REPLACE FUNCTION public.update_hairdresser_stats(p_hairdresser_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.hairdressers
  SET 
    rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r WHERE r.hairdresser_id = p_hairdresser_id), 0),
    total_reviews = (SELECT COUNT(*) FROM public.reviews r WHERE r.hairdresser_id = p_hairdresser_id)
  WHERE id = p_hairdresser_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_hairdresser_stats(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_hairdresser_stats(uuid) FROM anon;
;
