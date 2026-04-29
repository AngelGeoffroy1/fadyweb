-- Create hairdresser services table
CREATE TABLE IF NOT EXISTS public.hairdresser_services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hairdresser_id UUID REFERENCES public.hairdressers(id) ON DELETE CASCADE NOT NULL,
  service_name TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.hairdresser_services ENABLE ROW LEVEL SECURITY;

-- Policies for services table (public read)
CREATE POLICY "Anyone can view services" ON public.hairdresser_services
  FOR SELECT USING (true);

-- Create index for better performance
CREATE INDEX idx_hairdresser_services_hairdresser_id ON public.hairdresser_services(hairdresser_id);;
