-- Update support conversations to open status
UPDATE conversations 
SET 
  status = 'open',
  archived_at = NULL,
  archived_by_user_id = NULL,
  scheduled_deletion_at = NULL
WHERE type = 'support' AND status = 'archived';
