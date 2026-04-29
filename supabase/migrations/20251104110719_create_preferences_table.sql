-- Create preferences table
CREATE TABLE IF NOT EXISTS public.preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hairdresser_id UUID NOT NULL REFERENCES public.hairdressers(id) ON DELETE CASCADE,
    favorite_transport_mode TEXT CHECK (favorite_transport_mode IN ('walking', 'bicycle', 'automobile')) DEFAULT 'automobile',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(hairdresser_id)
);

-- Enable RLS
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Hairdressers can view their own preferences"
    ON public.preferences FOR SELECT
    USING (auth.uid() = hairdresser_id);

CREATE POLICY "Hairdressers can insert their own preferences"
    ON public.preferences FOR INSERT
    WITH CHECK (auth.uid() = hairdresser_id);

CREATE POLICY "Hairdressers can update their own preferences"
    ON public.preferences FOR UPDATE
    USING (auth.uid() = hairdresser_id)
    WITH CHECK (auth.uid() = hairdresser_id);

CREATE POLICY "Hairdressers can delete their own preferences"
    ON public.preferences FOR DELETE
    USING (auth.uid() = hairdresser_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create index on hairdresser_id
CREATE INDEX IF NOT EXISTS idx_preferences_hairdresser_id ON public.preferences(hairdresser_id);;
