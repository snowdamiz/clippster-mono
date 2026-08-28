-- Mobile migration 012: preserve project name on retained clips after project delete
ALTER TABLE clips ADD COLUMN project_name TEXT;
