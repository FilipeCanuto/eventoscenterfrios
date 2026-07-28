-- 1) email_templates: allow reminder_1d / reminder_2h types
ALTER TABLE public.email_templates
  ALTER COLUMN template_type TYPE text USING template_type::text;

ALTER TABLE public.email_templates
  ADD CONSTRAINT email_templates_type_check
  CHECK (template_type IN ('confirmation','reminder_1d','reminder_2h','reminder','followup'));

ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS email_templates_event_type_uidx
  ON public.email_templates (event_id, template_type);

DROP TRIGGER IF EXISTS update_email_templates_updated_at ON public.email_templates;
CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

DROP POLICY IF EXISTS "email_templates_admin_all" ON public.email_templates;
CREATE POLICY "email_templates_admin_all" ON public.email_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2) snapshot of the delivered email
ALTER TABLE public.email_send_log
  ADD COLUMN IF NOT EXISTS rendered_subject text,
  ADD COLUMN IF NOT EXISTS rendered_html text;