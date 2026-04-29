-- Fonction pour mettre à jour automatiquement le statut des réservations en cours
CREATE OR REPLACE FUNCTION update_bookings_in_progress_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mettre à jour les réservations qui sont actuellement en cours
    -- Une réservation est en cours si l'heure actuelle est entre booking_time et booking_time + durée du service
    UPDATE bookings b
    SET status = 'en_cours'
    FROM hairdresser_services hs
    WHERE b.service_id = hs.id
        AND b.status IN ('confirmed', 'pending')
        AND b.booking_date = CURRENT_DATE
        AND CURRENT_TIME >= b.booking_time::time
        AND CURRENT_TIME < (b.booking_time::time + (hs.duration_minutes * b.number_of_cuts || ' minutes')::interval);
    
    -- Mettre à jour les réservations qui étaient en cours mais sont maintenant terminées
    UPDATE bookings b
    SET status = 'completed'
    FROM hairdresser_services hs
    WHERE b.service_id = hs.id
        AND b.status = 'en_cours'
        AND (
            b.booking_date < CURRENT_DATE
            OR (b.booking_date = CURRENT_DATE AND CURRENT_TIME >= (b.booking_time::time + (hs.duration_minutes * b.number_of_cuts || ' minutes')::interval))
        );
END;
$$;

-- Créer une fonction pour obtenir le statut actuel d'une réservation
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
    
    -- Si le statut est annulé ou passé, le retourner tel quel
    IF booking_record.status IN ('cancelled', 'past', 'completed') THEN
        RETURN booking_record.status;
    END IF;
    
    -- Vérifier si la réservation est en cours
    IF booking_record.booking_date = CURRENT_DATE 
        AND CURRENT_TIME >= booking_record.booking_time::time
        AND CURRENT_TIME < (booking_record.booking_time::time + (booking_record.total_duration || ' minutes')::interval) THEN
        RETURN 'en_cours';
    END IF;
    
    -- Vérifier si la réservation est passée (terminée)
    IF booking_record.booking_date < CURRENT_DATE 
        OR (booking_record.booking_date = CURRENT_DATE AND CURRENT_TIME >= (booking_record.booking_time::time + (booking_record.total_duration || ' minutes')::interval)) THEN
        RETURN 'completed';
    END IF;
    
    -- Sinon retourner le statut actuel
    RETURN booking_record.status;
END;
$$;;
