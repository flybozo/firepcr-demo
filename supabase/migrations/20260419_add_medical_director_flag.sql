-- Add is_medical_director flag to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_medical_director boolean DEFAULT false;

-- Set existing MDs as medical directors (Aaron Stutz, Rodney Look, Robert Evans)
UPDATE public.employees SET is_medical_director = true WHERE role = 'MD/DO';
