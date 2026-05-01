CREATE INDEX IF NOT EXISTS idx_email_send_log_reg_type_status
  ON public.email_send_log (registration_id, email_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_send_log_reg_created
  ON public.email_send_log (registration_id, created_at DESC);