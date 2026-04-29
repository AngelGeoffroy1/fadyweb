-- Enable RLS on hairdresser_schedule_exceptions
ALTER TABLE hairdresser_schedule_exceptions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view schedule exceptions (needed for clients to see availability)
CREATE POLICY "Anyone can view schedule exceptions"
    ON hairdresser_schedule_exceptions
    FOR SELECT
    TO public
    USING (true);

-- Policy: Hairdressers can insert their own schedule exceptions
CREATE POLICY "Hairdressers can insert their own schedule exceptions"
    ON hairdresser_schedule_exceptions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    );

-- Policy: Hairdressers can update their own schedule exceptions
CREATE POLICY "Hairdressers can update their own schedule exceptions"
    ON hairdresser_schedule_exceptions
    FOR UPDATE
    TO authenticated
    USING (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    );

-- Policy: Hairdressers can delete their own schedule exceptions
CREATE POLICY "Hairdressers can delete their own schedule exceptions"
    ON hairdresser_schedule_exceptions
    FOR DELETE
    TO authenticated
    USING (
        hairdresser_id IN (
            SELECT id FROM hairdressers WHERE user_id = auth.uid()
        )
    );
;
