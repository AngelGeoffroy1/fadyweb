-- Créer une fonction qui sera appelée par le cron job
CREATE OR REPLACE FUNCTION cron_update_past_bookings()
RETURNS void AS $$
BEGIN
    -- Mettre à jour les réservations dont la date est passée
    UPDATE bookings 
    SET status = 'past'
    WHERE booking_date < CURRENT_DATE 
    AND status IN ('pending', 'confirmed')
    AND status != 'past';
    
    -- Log de l'exécution
    INSERT INTO cron_logs (function_name, executed_at, status)
    VALUES ('update_past_bookings', NOW(), 'success');
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log des erreurs
        INSERT INTO cron_logs (function_name, executed_at, status, error_message)
        VALUES ('update_past_bookings', NOW(), 'error', SQLERRM);
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- Créer une table pour logger les exécutions du cron
CREATE TABLE IF NOT EXISTS cron_logs (
    id SERIAL PRIMARY KEY,
    function_name TEXT NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT NOT NULL CHECK (status IN ('success', 'error')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Créer un index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_cron_logs_function_name ON cron_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_cron_logs_executed_at ON cron_logs(executed_at);;
