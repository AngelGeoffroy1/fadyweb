-- Ajouter la transition directe confirmed -> completed pour les réservations déjà terminées
DROP FUNCTION IF EXISTS update_bookings_in_progress_status();

CREATE OR REPLACE FUNCTION update_bookings_in_progress_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Mettre à jour les réservations PENDING dont l'heure de début est dépassée -> PAST
    UPDATE bookings b
    SET status = 'past'
    FROM hairdresser_services hs
    WHERE b.service_id = hs.id
        AND b.status = 'pending'
        AND (
            b.booking_date < CURRENT_DATE
            OR (b.booking_date = CURRENT_DATE AND CURRENT_TIME >= b.booking_time::time)
        );
    
    -- 2. Mettre à jour les réservations CONFIRMED dont l'heure de fin est déjà dépassée -> COMPLETED
    --    (transition directe sans passer par en_cours)
    UPDATE bookings b
    SET status = 'completed'
    FROM hairdresser_services hs
    WHERE b.service_id = hs.id
        AND b.status = 'confirmed'
        AND (
            b.booking_date < CURRENT_DATE
            OR (b.booking_date = CURRENT_DATE AND CURRENT_TIME >= (b.booking_time::time + (hs.duration_minutes * b.number_of_cuts || ' minutes')::interval))
        );
    
    -- 3. Mettre à jour les réservations CONFIRMED qui sont actuellement en cours -> EN_COURS
    UPDATE bookings b
    SET status = 'en_cours'
    FROM hairdresser_services hs
    WHERE b.service_id = hs.id
        AND b.status = 'confirmed'
        AND b.booking_date = CURRENT_DATE
        AND CURRENT_TIME >= b.booking_time::time
        AND CURRENT_TIME < (b.booking_time::time + (hs.duration_minutes * b.number_of_cuts || ' minutes')::interval);
    
    -- 4. Mettre à jour les réservations EN_COURS qui sont maintenant terminées -> COMPLETED
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
$$;;
