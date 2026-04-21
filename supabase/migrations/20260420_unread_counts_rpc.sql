-- Efficient single-query unread count function
-- Replaces N+1 per-channel queries in useChatUnread hook
CREATE OR REPLACE FUNCTION get_unread_counts(p_employee_id uuid)
RETURNS TABLE(channel_id uuid, unread bigint)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    m.channel_id,
    COUNT(msg.id) AS unread
  FROM chat_members m
  JOIN chat_messages msg
    ON msg.channel_id = m.channel_id
    AND msg.deleted_at IS NULL
    AND (msg.sender_id IS DISTINCT FROM p_employee_id)
    AND (m.last_read_at IS NULL OR msg.created_at > m.last_read_at)
  WHERE m.employee_id = p_employee_id
  GROUP BY m.channel_id
  HAVING COUNT(msg.id) > 0
$$;
