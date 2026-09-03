-- Add probation and confirmation lifecycle event types (MODULES.md §05)
ALTER TYPE "lifecycle_event_type" ADD VALUE 'probation';
ALTER TYPE "lifecycle_event_type" ADD VALUE 'confirmation';
