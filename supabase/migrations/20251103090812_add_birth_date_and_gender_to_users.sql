-- Add birth_date and gender columns to users table
ALTER TABLE public.users 
ADD COLUMN birth_date DATE,
ADD COLUMN gender TEXT CHECK (gender IN ('homme', 'femme', 'autre', 'non_specifie'));

-- Add comments to document the columns
COMMENT ON COLUMN public.users.birth_date IS 'Date de naissance de l''utilisateur';
COMMENT ON COLUMN public.users.gender IS 'Genre de l''utilisateur (homme, femme, autre, non_specifie)';;
