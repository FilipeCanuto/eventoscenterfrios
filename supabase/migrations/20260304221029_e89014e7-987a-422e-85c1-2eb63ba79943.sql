
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE public.event_status AS ENUM ('draft', 'live', 'past');
CREATE TYPE public.registration_status AS ENUM ('registered', 'checked_in', 'cancelled');
CREATE TYPE public.email_template_type AS ENUM ('confirmation', 'reminder', 'followup');

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- User roles (separate table per security best practices)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  event_date TIMESTAMPTZ,
  event_type TEXT DEFAULT 'webinar',
  status event_status NOT NULL DEFAULT 'draft',
  template TEXT DEFAULT 'minimal',
  primary_color TEXT DEFAULT '#7C3AED',
  logo_url TEXT,
  background_image_url TEXT,
  registration_limit INT,
  registration_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own events" ON public.events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own events" ON public.events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own events" ON public.events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own events" ON public.events FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public can view live events by slug" ON public.events FOR SELECT USING (status = 'live');
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_events_slug ON public.events (slug);
CREATE INDEX idx_events_user_id ON public.events (user_id);

-- Form fields
CREATE TABLE public.form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  placeholder TEXT,
  required BOOLEAN NOT NULL DEFAULT true,
  position INT NOT NULL DEFAULT 0
);
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage form fields via event ownership" ON public.form_fields FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = form_fields.event_id AND events.user_id = auth.uid())
);
CREATE POLICY "Public can view form fields for live events" ON public.form_fields FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = form_fields.event_id AND events.status = 'live')
);
CREATE INDEX idx_form_fields_event_id ON public.form_fields (event_id);

-- Registrations
CREATE TABLE public.registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  status registration_status NOT NULL DEFAULT 'registered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event owners can view registrations" ON public.registrations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = registrations.event_id AND events.user_id = auth.uid())
);
CREATE POLICY "Anyone can register for live events" ON public.registrations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = registrations.event_id AND events.status = 'live')
);
CREATE POLICY "Event owners can update registrations" ON public.registrations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = registrations.event_id AND events.user_id = auth.uid())
);
CREATE INDEX idx_registrations_event_id ON public.registrations (event_id);

-- Email templates
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  template_type email_template_type NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (event_id, template_type)
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage email templates via event ownership" ON public.email_templates FOR ALL USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = email_templates.event_id AND events.user_id = auth.uid())
);

-- Storage bucket for event assets
INSERT INTO storage.buckets (id, name, public) VALUES ('event-assets', 'event-assets', true);
CREATE POLICY "Anyone can view event assets" ON storage.objects FOR SELECT USING (bucket_id = 'event-assets');
CREATE POLICY "Authenticated users can upload event assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event-assets' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own event assets" ON storage.objects FOR UPDATE USING (bucket_id = 'event-assets' AND auth.role() = 'authenticated');
