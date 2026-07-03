-- ========================================================
-- 1. TABLES INDÉPENDANTES (LES PARENTS)
-- ========================================================

-- Table des profils (dépend de auth.users géré en interne par Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

-- Table des organisations (indépendante)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  code integer NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active'::text,
  CONSTRAINT organizations_pkey PRIMARY KEY (id),
  CONSTRAINT organizations_status_check CHECK (status = ANY (ARRAY['pending'::text, 'active'::text, 'rejected'::text]))
);


-- ========================================================
-- 2. TABLES DE NIVEAU 2 (DÉPENDENT DES PARENTS)
-- ========================================================

-- Table des membres d'organisations (dépend de organizations et profiles)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  organization_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'staff'::text,
  is_validated boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT organization_members_pkey PRIMARY KEY (id),
  CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT organization_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

-- Table des événements (dépend de organizations)
CREATE TABLE IF NOT EXISTS public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  location text NOT NULL,
  start_date timestamp with time zone NOT NULL,
  end_date timestamp with time zone NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

-- Table des compétences (dépend de organizations et events)
CREATE TABLE IF NOT EXISTS public.skills (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  organization_id uuid NOT NULL,
  event_id uuid NULL,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT skills_pkey PRIMARY KEY (id),
  CONSTRAINT skills_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id),
  CONSTRAINT skills_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);


-- ========================================================
-- 3. TABLES DE NIVEAU 3 (DÉPENDENT DES ÉVÉNEMENTS / SKILLS)
-- ========================================================

-- Table de jonction profils <-> compétences
CREATE TABLE IF NOT EXISTS public.profile_skills (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  profile_id uuid NOT NULL,
  skill_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profile_skills_pkey PRIMARY KEY (id),
  CONSTRAINT profile_skills_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id),
  CONSTRAINT profile_skills_skill_id_fkey FOREIGN KEY (skill_id) REFERENCES public.skills(id)
);

-- Table des tâches (dépend de events et profiles)
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'Pas commencé'::text,
  assigned_to uuid,
  required_skills bigint[] DEFAULT '{}'::bigint[],
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT tasks_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id)
);

-- Table des tickets (dépend de events et profiles)
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  ticket_type text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'valid'::text,
  holder_name text,
  sold_by uuid,
  scanned_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tickets_pkey PRIMARY KEY (id),
  CONSTRAINT tickets_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT tickets_sold_by_fkey FOREIGN KEY (sold_by) REFERENCES public.profiles(id),
  CONSTRAINT tickets_scanned_by_fkey FOREIGN KEY (scanned_by) REFERENCES public.profiles(id)
);

-- Table des catégories de transactions (dépend de organizations)
CREATE TABLE IF NOT EXISTS public."transactions-categories" (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  pcg text,
  organization_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT transactions_categories_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_categories_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

-- Table des transactions (dépend de events, profiles, organizations et catégories)
CREATE TABLE IF NOT EXISTS public.transactions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  event_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  description text,
  type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category bigint NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  organization_id uuid,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id),
  CONSTRAINT transactions_category_fkey FOREIGN KEY (category) REFERENCES public."transactions-categories"(id),
  CONSTRAINT transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT transactions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
);

-- Table event_staff (dépend de events et profiles)
create table public.event_staff (
  id bigint generated always as identity not null,
  event_id uuid not null,
  profile_id uuid not null,
  status text not null default 'en_attente'::text,
  created_at timestamp with time zone null default now(),
  post_id bigint null,
  constraint event_staff_pkey primary key (id),
  constraint event_staff_event_id_fkey foreign KEY (event_id) references events (id),
  constraint event_staff_post_id_fkey foreign KEY (post_id) references posts (id) on delete set null,
  constraint event_staff_profile_id_fkey foreign KEY (profile_id) references profiles (id)
) TABLESPACE pg_default;

-- CREATE TABLE: posts
-- Représente un poste ou pôle requis pour un événement spécifique
CREATE TABLE IF NOT EXISTS public.posts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name text NOT NULL, -- ex: 'Pôle Technique', 'Sécurité', 'Caisse/Billetterie'
    slots_needed integer DEFAULT 1, -- Optionnel : pour savoir combien de personnes il faut sur ce poste
    created_at timestamp with time zone DEFAULT now(),
    
    -- Sécurité : Évite d'avoir deux postes avec le même nom sur le même événement
    CONSTRAINT unique_post_per_event UNIQUE(event_id, name)
);

-- Index pour accélérer le chargement des postes lors de la sélection
CREATE INDEX IF NOT EXISTS idx_posts_event ON public.posts(event_id);

-- ========================================================
-- 4. FONCTIONS & TRIGGERS (EN TOUT DERNIER)
-- ========================================================

CREATE OR REPLACE FUNCTION public.create_profile_from_auth()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, phone, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.user_metadata->>'first_name', ''),
    COALESCE(NEW.user_metadata->>'last_name', ''),
    NULL,
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_profile_after_user ON auth.users;

CREATE TRIGGER trg_create_profile_after_user
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_from_auth();

-- ========================================================
-- 5. SÉCURITÉ : RLS ET POLITIQUES (MONDE EXPLOITATION)
-- ========================================================

-- Fonction pour vérifier si l'utilisateur est membre validé d'une organisation
CREATE OR REPLACE FUNCTION public.is_member_of(org_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id 
    AND profile_id = auth.uid() 
    AND is_validated = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour vérifier si l'utilisateur est un staff validé pour un événement spécifique
CREATE OR REPLACE FUNCTION public.is_staff_approved_for_event(target_event_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.event_staff
    WHERE profile_id = auth.uid() 
      AND event_id = target_event_id 
      AND (status = 'valide' OR status = 'validé') -- Gère les deux orthographes pour plus de robustesse
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.ticket_designs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name text NOT NULL, -- ex: "Pass VIP", "Ticket Standard", "Badge Staff"
    
    -- L'URL de l'image stockée dans le Bucket Supabase
    image_url text NOT NULL, 
    
    -- Toutes nos configurations (format, colonnes, qr_on_back) stockées proprement
    settings jsonb NOT NULL DEFAULT '{
        "format": "horizontal",
        "columns": 2,
        "qr_on_back": true
    }'::jsonb,
    
    created_at timestamp with time zone DEFAULT now()
);

-- Index pour charger rapidement les designs d'un événement
CREATE INDEX IF NOT EXISTS idx_ticket_designs_event ON public.ticket_designs(event_id);

-- Table des types de billets (dépend de events)
CREATE TABLE IF NOT EXISTS public.ticket_type (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'Ar',
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ticket_type_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_type_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id)
);

-- Migration pour bases existantes
ALTER TABLE public.ticket_type ADD COLUMN IF NOT EXISTS price numeric NOT NULL DEFAULT 0;
ALTER TABLE public.ticket_type ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'Ar';
ALTER TABLE public.ticket_type ADD COLUMN IF NOT EXISTS benefits jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Index pour charger rapidement les types d'un événement
CREATE INDEX IF NOT EXISTS idx_ticket_type_event ON public.ticket_type(event_id);

ALTER TABLE public.ticket_designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Les membres voient les designs de l'événement" 
ON public.ticket_designs FOR SELECT TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.events WHERE id = event_id AND public.get_user_role_in_org(organization_id) IS NOT NULL
));

CREATE POLICY "Seul l'admin gère les designs" 
ON public.ticket_designs FOR ALL TO authenticated 
USING (EXISTS (
    SELECT 1 FROM public.events WHERE id = event_id AND public.get_user_role_in_org(organization_id) = 'admin'
));
-- Activation du RLS sur les tables de données
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- --- POLICIES ---

-- PROFILES : Un utilisateur peut voir et modifier uniquement son propre profil
CREATE POLICY "Profiles self access" ON public.profiles 
    FOR ALL USING (auth.uid() = id);

-- ORGANIZATIONS : Un membre peut voir les infos de son organisation
CREATE POLICY "Org member view" ON public.organizations 
    FOR SELECT USING (public.is_member_of(id));

-- ORGANIZATION_MEMBERS : Un membre peut voir les autres membres de son organisation
CREATE POLICY "Org members view" ON public.organization_members 
    FOR SELECT USING (public.is_member_of(organization_id));

-- EVENTS : Seuls les membres de l'organisation peuvent voir/gérer les événements
CREATE POLICY "Event access" ON public.events 
    FOR ALL USING (public.is_member_of(organization_id));

-- TASKS : Seuls les membres de l'organisation liée à l'événement de la tâche
CREATE POLICY "Task access" ON public.tasks 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE id = tasks.event_id 
            AND public.is_member_of(organization_id)
        )
    );

-- TICKETS : Seuls les membres de l'organisation liée à l'événement du ticket
-- Politique d'accès aux tickets : Admins de l'organisation OU Staff assigné à l'événement
DROP POLICY IF EXISTS "Ticket access" ON public.tickets;
CREATE POLICY "Ticket access" ON public.tickets 
    FOR ALL USING (
    FOR SELECT USING (
        -- Cas 1 : Admin de l'organisation
        EXISTS (
            SELECT 1 FROM public.events 
            WHERE id = tickets.event_id 
            AND public.is_member_of(organization_id)
            SELECT 1 FROM public.events e
            JOIN public.organization_members om ON om.organization_id = e.organization_id
            WHERE e.id = tickets.event_id
              AND om.profile_id = auth.uid()
              AND om.role = 'admin'
              AND om.is_validated = true
        )
        OR public.is_staff_approved_for_event(tickets.event_id)
    );

-- TRANSACTIONS : Accès réservé aux membres de l'organisation
CREATE POLICY "Transaction access" ON public.transactions 
    FOR ALL USING (public.is_member_of(organization_id));

-- POSTS : Accès basé sur l'organisation de l'événement lié
CREATE POLICY "Post access" ON public.posts 
    FOR ALL TO authenticated
    USING (
        event_id IN (
            SELECT id FROM public.events 
            WHERE public.is_member_of(organization_id)
        )
    );


-- Note : Les opérations d'onboarding (INSERT dans profiles/orgs) seront faites par 
-- le backend avec la service_role_key, donc elles ignorent ces politiques.

-- Moyens de paiement Mobile Money
CREATE TABLE IF NOT EXISTS public.payment_method (
  id bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  "Operateur" character varying NULL,
  numero character varying NULL,
  is_active boolean NULL,
  account_holder character varying NULL,
  CONSTRAINT payment_method_pkey PRIMARY KEY (id)
);

ALTER TABLE public.payment_method ADD COLUMN IF NOT EXISTS account_holder character varying NULL;

-- Commandes d'achat en ligne (Mobile Money)
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  buyer_name text NOT NULL,
  buyer_phone text NOT NULL,
  buyer_email text NULL,
  buyer_address text NULL,
  transaction_id text NOT NULL,
  total_amount numeric NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending'::text,
  payment_method bigint NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_transaction_id_key UNIQUE (transaction_id),
  CONSTRAINT orders_payment_method_fkey FOREIGN KEY (payment_method) REFERENCES public.payment_method(id)
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  ticket_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_ticket_unique UNIQUE (ticket_id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items USING btree (order_id);