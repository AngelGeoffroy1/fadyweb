CREATE TABLE hairdresser_gallery (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  hairdresser_id UUID NOT NULL REFERENCES hairdressers(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hairdresser_gallery_hairdresser_id ON hairdresser_gallery(hairdresser_id);;
