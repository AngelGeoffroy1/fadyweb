-- Mettre à jour get_current_booking_status pour inclure la transition directe
DROP FUNCTION IF EXISTS get_current_booking_status(uuid);

CREATE OR REPLACE FUNCTION get_current_booking_status(booking_id_param uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_status text;
    booking_record record;
BEGIN
    -- Récupérer les informations de la réservation
    SELECT 
        b.status,
        b.booking_date,
        b.booking_time,
        hs.duration_minutes * b.number_of_cuts as total_duration
    INTO booking_record
    FROM bookings b
    JOIN hairdresser_services hs ON b.service_id = hs.id
    WHERE b.id = booking_id_param;
    
    -- Si la réservation n'existe pas
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Si le statut est annulé, passé ou terminé, le retourner tel quel
    IF booking_record.status IN ('cancelled', 'past', 'completed') THEN
        RETURN booking_record.status;
    END IF;
    
    -- Si la réservation est PENDING et que l'heure de début est dépassée -> PAST
    IF booking_record.status = 'pending' 
        AND (
            booking_record.booking_date < CURRENT_DATE 
            OR (booking_record.booking_date = CURRENT_DATE AND CURRENT_TIME >= booking_record.booking_time::time)
        ) THEN
        RETURN 'past';
    END IF;
    
    -- Si la réservation est CONFIRMED et que l'heure de FIN est dépassée -> COMPLETED (transition directe)
    IF booking_record.status = 'confirmed'
        AND (
            booking_record.booking_date < CURRENT_DATE 
            OR (booking_record.booking_date = CURRENT_DATE AND CURRENT_TIME >= (booking_record.booking_time::time + (booking_record.total_duration || ' minutes')::interval))
        ) THEN
        RETURN 'completed';
    END IF;
    
    -- Vérifier si la réservation CONFIRMED est en cours -> EN_COURS
    IF booking_record.status = 'confirmed'
        AND booking_record.booking_date = CURRENT_DATE 
        AND CURRENT_TIME >= booking_record.booking_time::time
        AND CURRENT_TIME < (booking_record.booking_time::time + (booking_record.total_duration || ' minutes')::interval) THEN
        RETURN 'en_cours';
    END IF;
    
    -- Vérifier si la réservation EN_COURS est maintenant terminée -> COMPLETED
    IF booking_record.status = 'en_cours'
        AND (
            booking_record.booking_date < CURRENT_DATE 
            OR (booking_record.booking_date = CURRENT_DATE AND CURRENT_TIME >= (booking_record.booking_time::time + (booking_record.total_duration || ' minutes')::interval))
        ) THEN
        RETURN 'completed';
    END IF;
    
    -- Sinon retourner le statut actuel
    RETURN booking_record.status;
END;
$$;;
