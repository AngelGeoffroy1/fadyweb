-- Create hairdresser_schedule_exceptions table
CREATE TABLE IF NOT EXISTS hairdresser_schedule_exceptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hairdresser_id UUID NOT NULL REFERENCES hairdressers(id) ON DELETE CASCADE,
    exception_date DATE NOT NULL,
    exception_type TEXT NOT NULL CHECK (exception_type IN ('closed', 'modified_hours')),
    start_time TIME,
    end_time TIME,
    slot_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Constraint: if exception_type is 'modified_hours', start_time and end_time must be provided
    CONSTRAINT valid_modified_hours CHECK (
        (exception_type = 'closed') OR 
        (exception_type = 'modified_hours' AND start_time IS NOT NULL AND end_time IS NOT NULL)
    )
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_hairdresser_date 
    ON hairdresser_schedule_exceptions(hairdresser_id, exception_date);

-- Create index for efficient date-based queries
CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_date 
    ON hairdresser_schedule_exceptions(exception_date);

-- Add comment to table
COMMENT ON TABLE hairdresser_schedule_exceptions IS 'Stores schedule exceptions for hairdressers (closures and modified hours for specific dates)';
;
