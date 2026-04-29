-- Ajouter la colonne number_of_cuts à la table bookings
ALTER TABLE public.bookings
ADD COLUMN number_of_cuts integer NOT NULL DEFAULT 1
CHECK (number_of_cuts >= 1 AND number_of_cuts <= 5);

-- Ajouter un commentaire pour documenter la colonne
COMMENT ON COLUMN public.bookings.number_of_cuts IS 'Nombre de coupes réservées en une seule réservation (1 à 5). Le prix et la durée sont multipliés par ce nombre.';;
