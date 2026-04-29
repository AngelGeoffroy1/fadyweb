-- Composite index for fast "last booking date per (hairdresser, user)" lookups
CREATE INDEX IF NOT EXISTS idx_bookings_hairdresser_user_date
  ON public.bookings (hairdresser_id, user_id, booking_date DESC);

-- Composite index to speed up "latest message per conversation"
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at DESC);

-- RPC that aggregates everything in a single round-trip
CREATE OR REPLACE FUNCTION public.get_hairdresser_conversations(p_hairdresser_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  hairdresser_id uuid,
  created_at timestamptz,
  hairdresser_user_id uuid,
  user_email text,
  user_full_name text,
  user_phone text,
  user_avatar_url text,
  user_created_at timestamptz,
  user_email_confirmed boolean,
  last_message text,
  last_message_date timestamptz,
  unread_count int,
  last_booking_date date,
  is_blocked boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH h AS (
    SELECT user_id AS hairdresser_user_id
    FROM hairdressers
    WHERE id = p_hairdresser_id
    LIMIT 1
  ),
  blocked AS (
    SELECT blocked_user_id
    FROM blocked_clients
    WHERE hairdresser_id = p_hairdresser_id
  )
  SELECT
    c.id,
    c.user_id,
    c.hairdresser_id,
    c.created_at,
    (SELECT hairdresser_user_id FROM h) AS hairdresser_user_id,
    u.email,
    u.full_name,
    u.phone,
    u.avatar_url,
    u.created_at AS user_created_at,
    u.email_confirmed,
    lm.content AS last_message,
    lm.created_at AS last_message_date,
    COALESCE(uc.unread_count, 0)::int AS unread_count,
    lb.booking_date AS last_booking_date,
    (b.blocked_user_id IS NOT NULL) AS is_blocked
  FROM conversations c
  INNER JOIN users u ON u.id = c.user_id
  LEFT JOIN LATERAL (
    SELECT content, created_at
    FROM messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS unread_count
    FROM messages m
    WHERE m.conversation_id = c.id
      AND m.is_read = false
      AND m.sender_id <> (SELECT hairdresser_user_id FROM h)
  ) uc ON TRUE
  LEFT JOIN LATERAL (
    SELECT booking_date
    FROM bookings bk
    WHERE bk.hairdresser_id = p_hairdresser_id
      AND bk.user_id = c.user_id
    ORDER BY bk.booking_date DESC
    LIMIT 1
  ) lb ON TRUE
  LEFT JOIN blocked b ON b.blocked_user_id = c.user_id
  WHERE c.hairdresser_id = p_hairdresser_id
  ORDER BY lm.created_at DESC NULLS LAST, c.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_hairdresser_conversations(uuid) TO authenticated, anon, service_role;;
