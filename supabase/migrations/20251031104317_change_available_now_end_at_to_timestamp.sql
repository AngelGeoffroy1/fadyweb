-- Changer le type de la colonne available_now_end_at de TIME à TIMESTAMPTZ
ALTER TABLE hairdressers 
ALTER COLUMN available_now_end_at TYPE timestamp with time zone 
USING CASE 
  WHEN available_now_end_at IS NULL THEN NULL
  ELSE (CURRENT_DATE + available_now_end_at)::timestamp with time zone
END;;
