-- Create hairdressers table
CREATE TABLE IF NOT EXISTS public.hairdressers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  rating DECIMAL(2,1) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  total_reviews INTEGER DEFAULT 0,
  hourly_rate DECIMAL(10,2),
  address TEXT NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  accepts_home_service BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.hairdressers ENABLE ROW LEVEL SECURITY;

-- Policies for hairdressers table (public read)
CREATE POLICY "Anyone can view hairdressers" ON public.hairdressers
  FOR SELECT USING (true);;
