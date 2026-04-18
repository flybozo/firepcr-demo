-- Push notification infrastructure

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES employees(id),
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(endpoint)
);

CREATE TABLE IF NOT EXISTS public.push_notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    body text NOT NULL,
    url text,
    sent_by text,
    target_roles text[],
    target_units text[],
    target_employee_ids uuid[],
    delivered_count int DEFAULT 0,
    failed_count int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_notifications ENABLE ROW LEVEL SECURITY;
