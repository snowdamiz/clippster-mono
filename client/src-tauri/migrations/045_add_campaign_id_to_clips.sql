-- Add campaign_id field to clips table for campaign asset integration
ALTER TABLE clips ADD COLUMN campaign_id INTEGER;
