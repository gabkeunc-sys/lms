-- One-time bootstrap explicitly approved by the registered account owner.
-- New registrations always retain the student default.
DO $$
DECLARE owner_id uuid;
BEGIN
  SELECT id INTO owner_id FROM app_users
    WHERE email = 'gabkeunc@gmail.com' AND name = '최갑근' AND active = true;
  IF owner_id IS NOT NULL THEN
    UPDATE app_users SET role = 'admin' WHERE id = owner_id;
  ELSE
    RAISE EXCEPTION 'Verified instructor account not found';
  END IF;
END $$;
