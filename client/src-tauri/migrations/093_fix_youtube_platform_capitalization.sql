-- Fix YouTube platform capitalization in monitored_streamers table
-- The platform was being stored as 'youtube' or 'Youtube' but the TypeScript code expects 'YouTube'
UPDATE monitored_streamers 
SET platform = 'YouTube' 
WHERE platform = 'youtube' OR platform = 'Youtube';
