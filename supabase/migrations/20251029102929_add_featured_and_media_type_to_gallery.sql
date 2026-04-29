ALTER TABLE hairdresser_gallery 
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS media_type TEXT DEFAULT 'image' CHECK (media_type IN ('image', 'video'));;
