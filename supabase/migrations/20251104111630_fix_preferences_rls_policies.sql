-- Drop existing policies
DROP POLICY IF EXISTS "Hairdressers can view their own preferences" ON public.preferences;
DROP POLICY IF EXISTS "Hairdressers can insert their own preferences" ON public.preferences;
DROP POLICY IF EXISTS "Hairdressers can update their own preferences" ON public.preferences;
DROP POLICY IF EXISTS "Hairdressers can delete their own preferences" ON public.preferences;

-- Create corrected RLS policies that check user_id in hairdressers table
CREATE POLICY "Hairdressers can view their own preferences"
    ON public.preferences FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.hairdressers
            WHERE hairdressers.id = preferences.hairdresser_id
            AND hairdressers.user_id = auth.uid()
        )
    );

CREATE POLICY "Hairdressers can insert their own preferences"
    ON public.preferences FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hairdressers
            WHERE hairdressers.id = preferences.hairdresser_id
            AND hairdressers.user_id = auth.uid()
        )
    );

CREATE POLICY "Hairdressers can update their own preferences"
    ON public.preferences FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.hairdressers
            WHERE hairdressers.id = preferences.hairdresser_id
            AND hairdressers.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.hairdressers
            WHERE hairdressers.id = preferences.hairdresser_id
            AND hairdressers.user_id = auth.uid()
        )
    );

CREATE POLICY "Hairdressers can delete their own preferences"
    ON public.preferences FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.hairdressers
            WHERE hairdressers.id = preferences.hairdresser_id
            AND hairdressers.user_id = auth.uid()
        )
    );;
