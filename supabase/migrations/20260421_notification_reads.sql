CREATE TABLE IF NOT EXISTS public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  notification_id uuid REFERENCES push_notifications(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, notification_id)
);
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees can manage own reads" ON public.notification_reads
  FOR ALL TO authenticated USING (employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1));

-- Allow all authenticated employees to read push notifications
CREATE POLICY "employees can read push notifications" ON public.push_notifications
  FOR SELECT TO authenticated USING (true);
