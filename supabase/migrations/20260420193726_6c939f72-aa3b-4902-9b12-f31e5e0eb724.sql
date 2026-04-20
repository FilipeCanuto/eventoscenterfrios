-- 1. Add options column to form_fields for select-type fields
ALTER TABLE public.form_fields
ADD COLUMN IF NOT EXISTS options jsonb;

-- 2. Shift existing fields at position >= 3 to make room for the new field
UPDATE public.form_fields
SET position = position + 1
WHERE event_id = 'cfd9d79d-78d3-45d8-bdc7-1250314ec2c4'
  AND position >= 3;

-- 3. Insert the new mandatory "Segmento de atuação" select field
INSERT INTO public.form_fields (event_id, label, field_type, required, position, options, placeholder)
VALUES (
  'cfd9d79d-78d3-45d8-bdc7-1250314ec2c4',
  'Segmento de atuação',
  'select',
  true,
  3,
  '["Supermercado","Açougue","Horti-Fruti","Lanchonete","Restaurante","Pizzaria","Laticínio","Outros"]'::jsonb,
  'Selecione seu segmento'
);