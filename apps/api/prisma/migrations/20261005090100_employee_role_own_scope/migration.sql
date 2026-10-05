-- The self-service Employee role only ever reaches the holder's own record.
UPDATE "roles" SET "data_scope" = 'own', "updated_at" = NOW() WHERE "name" = 'Employee';
