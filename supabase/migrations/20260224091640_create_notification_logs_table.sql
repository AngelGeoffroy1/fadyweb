CREATE TABLE notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('individual_client', 'individual_hairdresser', 'all_clients', 'all_hairdressers', 'all')),
  target_user_id UUID,
  target_user_name TEXT,
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  total_count INT DEFAULT 0,
  sent_by UUID NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at DESC);
CREATE INDEX idx_notification_logs_target_type ON notification_logs(target_type);
CREATE INDEX idx_notification_logs_sent_by ON notification_logs(sent_by);;
