
-- EVENTS: drop all restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can view own events" ON public.events;
DROP POLICY IF EXISTS "Users can create own events" ON public.events;
DROP POLICY IF EXISTS "Users can update own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete own events" ON public.events;
DROP POLICY IF EXISTS "Public can view live events by slug" ON public.events;
DROP POLICY IF EXISTS "Public can view live events" ON public.events;

CREATE POLICY "Users can view own events" ON public.events AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own events" ON public.events AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON public.events AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON public.events AS PERMISSIVE FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Public can view live events" ON public.events AS PERMISSIVE FOR SELECT TO anon, authenticated USING (status = 'live'::event_status);

-- REGISTRATIONS: drop all restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Allow registration for live events" ON public.registrations;
DROP POLICY IF EXISTS "Event owners can view registrations" ON public.registrations;
DROP POLICY IF EXISTS "Event owners can update registrations" ON public.registrations;

CREATE POLICY "Allow registration for live events" ON public.registrations AS PERMISSIVE FOR INSERT TO anon, authenticated WITH CHECK (EXISTS (SELECT 1 FROM events WHERE events.id = registrations.event_id AND events.status = 'live'::event_status));
CREATE POLICY "Event owners can view registrations" ON public.registrations AS PERMISSIVE FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM events WHERE events.id = registrations.event_id AND events.user_id = auth.uid()));
CREATE POLICY "Event owners can update registrations" ON public.registrations AS PERMISSIVE FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM events WHERE events.id = registrations.event_id AND events.user_id = auth.uid()));

-- FORM_FIELDS: drop all restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Public can view form fields for live events" ON public.form_fields;
DROP POLICY IF EXISTS "Users can manage form fields via event ownership" ON public.form_fields;

CREATE POLICY "Public can view form fields for live events" ON public.form_fields AS PERMISSIVE FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM events WHERE events.id = form_fields.event_id AND events.status = 'live'::event_status));
CREATE POLICY "Users can manage form fields via event ownership" ON public.form_fields AS PERMISSIVE FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM events WHERE events.id = form_fields.event_id AND events.user_id = auth.uid()));

-- PROFILES: drop all restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- USER_ROLES: drop restrictive and recreate as permissive
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- EMAIL_TEMPLATES: drop restrictive and recreate as permissive
DROP POLICY IF EXISTS "Users can manage email templates via event ownership" ON public.email_templates;
CREATE POLICY "Users can manage email templates via event ownership" ON public.email_templates AS PERMISSIVE FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM events WHERE events.id = email_templates.event_id AND events.user_id = auth.uid()));
