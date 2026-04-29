-- Create hairdresser availability table
CREATE TABLE IF NOT EXISTS public.hairdresser_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hairdresser_id UUID REFERENCES public.hairdressers(id) ON DELETE CASCADE NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.hairdresser_availability ENABLE ROW LEVEL SECURITY;

-- Policies for availability table (public read)
CREATE POLICY "Anyone can view availability" ON public.hairdresser_availability
  FOR SELECT USING (true);

-- Create index for better performance
CREATE INDEX idx_hairdresser_availability_hairdresser_id ON public.hairdresser_availability(hairdresser_id);;
