-- Créer la table admins
CREATE TABLE IF NOT EXISTS public.admins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES public.admins(id) ON DELETE SET NULL
);

-- Activer RLS
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Créer les politiques RLS
CREATE POLICY "Admins can view all admins" ON public.admins
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can insert new admins" ON public.admins
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can update admins" ON public.admins
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Admins can delete admins" ON public.admins
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.admins 
            WHERE user_id = auth.uid()
        )
    );

-- Créer la fonction de vérification admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.admins 
        WHERE user_id = user_uuid
    );
END;
$$;

-- Créer une fonction pour obtenir les informations admin
CREATE OR REPLACE FUNCTION public.get_admin_info(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE (
    id UUID,
    user_id UUID,
    role TEXT,
    created_at TIMESTAMPTZ,
    created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.user_id, a.role, a.created_at, a.created_by
    FROM public.admins a
    WHERE a.user_id = user_uuid;
END;
$$;;
