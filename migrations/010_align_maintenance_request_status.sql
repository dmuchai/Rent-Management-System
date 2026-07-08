-- Align existing databases with the maintenance API and dashboard terminology.
-- Older installations created maintenance_status without the "open" value.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'maintenance_status'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'maintenance_status'
      AND e.enumlabel = 'open'
  ) THEN
    ALTER TYPE maintenance_status ADD VALUE 'open';
  END IF;
END
$$;
