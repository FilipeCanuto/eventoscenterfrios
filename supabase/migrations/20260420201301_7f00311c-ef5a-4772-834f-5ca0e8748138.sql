CREATE OR REPLACE FUNCTION public.public_check_in(p_registration_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status registration_status;
BEGIN
  IF p_registration_id IS NULL THEN
    RETURN 'not_found';
  END IF;

  SELECT status INTO v_status
  FROM registrations
  WHERE id = p_registration_id;

  IF v_status IS NULL THEN
    RETURN 'not_found';
  END IF;

  IF v_status = 'cancelled'::registration_status THEN
    RETURN 'cancelled';
  END IF;

  IF v_status = 'checked_in'::registration_status THEN
    RETURN 'already_checked_in';
  END IF;

  UPDATE registrations
  SET status = 'checked_in'::registration_status
  WHERE id = p_registration_id
    AND status = 'registered'::registration_status;

  RETURN 'success';
END;
$$;

REVOKE ALL ON FUNCTION public.public_check_in(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_check_in(uuid) TO anon, authenticated;