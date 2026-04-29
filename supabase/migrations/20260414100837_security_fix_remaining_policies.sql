
-- =================================================
-- SECURITY FIX PART 2: Remaining Policy Fixes
-- =================================================

-- =================================================
-- STEP 5: FIX hairdresser_diploma_verification
-- VULNERABILITY: Any authenticated user can view/update ALL verifications
-- =================================================
DROP POLICY IF EXISTS "Allow authenticated users to select diploma verification" ON public.hairdresser_diploma_verification;
DROP POLICY IF EXISTS "Allow authenticated users to update diploma verification" ON public.hairdresser_diploma_verification;
DROP POLICY IF EXISTS "Allow authenticated users to insert diploma verification" ON public.hairdresser_diploma_verification;

CREATE POLICY "Hairdressers can view their own verification"
  ON public.hairdresser_diploma_verification FOR SELECT
  TO authenticated
  USING (
    hairdresser_id IN (SELECT id FROM public.hairdressers WHERE user_id = auth.uid())
    OR is_admin()
  );

CREATE POLICY "Hairdressers can insert their own verification"
  ON public.hairdresser_diploma_verification FOR INSERT
  TO authenticated
  WITH CHECK (
    hairdresser_id IN (SELECT id FROM public.hairdressers WHERE user_id = auth.uid())
  );

CREATE POLICY "Hairdressers can update their own verification"
  ON public.hairdresser_diploma_verification FOR UPDATE
  TO authenticated
  USING (
    hairdresser_id IN (SELECT id FROM public.hairdressers WHERE user_id = auth.uid())
  )
  WITH CHECK (
    hairdresser_id IN (SELECT id FROM public.hairdressers WHERE user_id = auth.uid())
  );

-- =================================================
-- STEP 6: FIX invisible_hairdressers
-- VULNERABILITY: Any authenticated user can insert/update/delete
-- =================================================
DROP POLICY IF EXISTS "Allow admins to insert invisible_hairdressers" ON public.invisible_hairdressers;
DROP POLICY IF EXISTS "Allow admins to update invisible_hairdressers" ON public.invisible_hairdressers;
DROP POLICY IF EXISTS "Allow admins to delete invisible_hairdressers" ON public.invisible_hairdressers;

CREATE POLICY "Only admins can insert invisible_hairdressers"
  ON public.invisible_hairdressers FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Only admins can update invisible_hairdressers"
  ON public.invisible_hairdressers FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Only admins can delete invisible_hairdressers"
  ON public.invisible_hairdressers FOR DELETE
  TO authenticated
  USING (is_admin());

-- =================================================
-- STEP 7: FIX hairdresser_subscriptions
-- VULNERABILITY: Everyone (incl. anon) can see all subscriptions
-- with Stripe IDs, Apple transaction IDs, etc.
-- =================================================
DROP POLICY IF EXISTS "Tout le monde peut voir les abonnements des coiffeurs" ON public.hairdresser_subscriptions;

CREATE POLICY "Authenticated users can view subscriptions"
  ON public.hairdresser_subscriptions FOR SELECT
  TO authenticated
  USING (true);

-- =================================================
-- STEP 8: FIX hairdresser_stripe_accounts
-- VULNERABILITY: Public read access exposes Stripe account IDs
-- =================================================
DROP POLICY IF EXISTS "Permettre la lecture publique des capacités de paiement" ON public.hairdresser_stripe_accounts;

CREATE POLICY "Authenticated users can view payment capabilities"
  ON public.hairdresser_stripe_accounts FOR SELECT
  TO authenticated
  USING (true);

-- =================================================
-- STEP 9: FIX conversations
-- VULNERABILITY: Anyone can create conversations for any user pair
-- =================================================
DROP POLICY IF EXISTS "Système peut créer des conversations" ON public.conversations;

CREATE POLICY "Authenticated users can create their conversations"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR hairdresser_id IN (SELECT id FROM public.hairdressers WHERE user_id = auth.uid())
  );

-- =================================================
-- STEP 10: FIX profile_views
-- VULNERABILITY: Anyone can read all profile views
-- =================================================
DROP POLICY IF EXISTS "Allow read access" ON public.profile_views;

CREATE POLICY "Hairdressers can view their own profile views"
  ON public.profile_views FOR SELECT
  TO authenticated
  USING (
    hairdresser_id IN (SELECT id FROM public.hairdressers WHERE user_id = auth.uid())
    OR is_admin()
  );

-- Fix INSERT too (was using auth.role() check on public role)
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.profile_views;

CREATE POLICY "Authenticated users can insert profile views"
  ON public.profile_views FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- =================================================
-- STEP 11: FIX notification_preferences
-- VULNERABILITY: INSERT with_check had OR allowing insertion for any user
-- =================================================
DROP POLICY IF EXISTS "Users can manage their own notification preferences" ON public.notification_preferences;

CREATE POLICY "Users can manage their own notification preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
;
