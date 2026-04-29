-- Add latitude and longitude columns to hairdressers table
ALTER TABLE hairdressers
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

-- Add index for geospatial queries (optional but recommended)
CREATE INDEX idx_hairdressers_coordinates ON hairdressers(latitude, longitude);

-- Add comment for documentation
COMMENT ON COLUMN hairdressers.latitude IS 'Latitude du domicile/salon du coiffeur (géocodé à l''inscription)';
COMMENT ON COLUMN hairdressers.longitude IS 'Longitude du domicile/salon du coiffeur (géocodé à l''inscription)';;
