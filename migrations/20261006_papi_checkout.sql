-- Run after db.sql, with the database owner. No tickets exist before payment.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_provider text;
-- Orders are served only by the backend; never expose buyer details or ticket IDs through PostgREST.
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders, public.order_items FROM anon, authenticated;
GRANT ALL ON public.orders, public.order_items TO service_role;
ALTER TABLE public.tickets ALTER COLUMN number TYPE integer;

CREATE TABLE IF NOT EXISTS public.papi_checkouts (
  id uuid PRIMARY KEY,
  access_hash text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id),
  ticket_type_id bigint NOT NULL REFERENCES public.ticket_type(id),
  event_title text NOT NULL,
  ticket_type_name text NOT NULL,
  unit_price numeric NOT NULL CHECK (unit_price >= 0),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  amount numeric NOT NULL CHECK (amount >= 300),
  buyer_name text NOT NULL,
  buyer_phone text NOT NULL,
  buyer_email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','failed','expired','paid')),
  payment_link text,
  notification_token text,
  papi_reference text,
  payment_method text,
  expires_at timestamptz,
  last_checked_at timestamptz,
  issuing_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);
ALTER TABLE public.papi_checkouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.papi_checkouts FROM anon, authenticated;
GRANT ALL ON public.papi_checkouts TO service_role;
CREATE INDEX IF NOT EXISTS papi_checkouts_reconcile ON public.papi_checkouts(last_checked_at) WHERE status <> 'paid';

CREATE OR REPLACE FUNCTION public.create_papi_checkout(
  p_id uuid, p_access_hash text, p_event_id uuid, p_ticket_type_id bigint,
  p_quantity integer, p_buyer_name text, p_buyer_phone text, p_buyer_email text
) RETURNS public.papi_checkouts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.papi_checkouts; t public.ticket_type; e public.events;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text, 0));
  SELECT * INTO c FROM public.papi_checkouts WHERE id = p_id;
  IF FOUND THEN
    IF c.access_hash <> p_access_hash OR c.event_id <> p_event_id OR c.ticket_type_id <> p_ticket_type_id
      OR c.quantity <> p_quantity OR c.buyer_name <> p_buyer_name OR c.buyer_phone <> p_buyer_phone
      OR c.buyer_email IS DISTINCT FROM p_buyer_email THEN
      RAISE EXCEPTION 'CHECKOUT_CONFLICT';
    END IF;
    RETURN c;
  END IF;
  SELECT * INTO t FROM public.ticket_type WHERE id = p_ticket_type_id AND event_id = p_event_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'TICKET_UNAVAILABLE'; END IF;
  SELECT * INTO e FROM public.events WHERE id = p_event_id AND end_date > now();
  IF NOT FOUND THEN RAISE EXCEPTION 'EVENT_UNAVAILABLE'; END IF;
  IF p_quantity NOT BETWEEN 1 AND 20 OR t.price * p_quantity < 300 THEN RAISE EXCEPTION 'INVALID_AMOUNT'; END IF;
  INSERT INTO public.papi_checkouts(id, access_hash, event_id, ticket_type_id, event_title, ticket_type_name,
    unit_price, quantity, amount, buyer_name, buyer_phone, buyer_email)
  VALUES(p_id, p_access_hash, p_event_id, p_ticket_type_id, e.title, t.name, t.price, p_quantity,
    t.price * p_quantity, p_buyer_name, p_buyer_phone, p_buyer_email) RETURNING * INTO c;
  RETURN c;
END $$;

CREATE OR REPLACE FUNCTION public.complete_papi_checkout(p_id uuid, p_amount numeric, p_reference text, p_method text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.papi_checkouts; ticket_id uuid; first_number integer; i integer;
BEGIN
  SELECT * INTO c FROM public.papi_checkouts WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR c.amount <> p_amount THEN RAISE EXCEPTION 'PAYMENT_MISMATCH'; END IF;
  IF c.status = 'paid' THEN RETURN; END IF;
  -- Serializes numbering with all ticket writers during this short transaction.
  LOCK TABLE public.tickets IN SHARE ROW EXCLUSIVE MODE;
  SELECT COALESCE(MAX(number), 0) + 1 INTO first_number FROM public.tickets
    WHERE event_id = c.event_id AND ticket_type = c.ticket_type_name;
  INSERT INTO public.orders(id, buyer_name, buyer_phone, buyer_email, transaction_id, total_amount, payment_status, payment_provider)
    VALUES(c.id, c.buyer_name, c.buyer_phone, c.buyer_email, 'PAPI-' || c.id, c.amount, 'validated', 'papi');
  FOR i IN 0..c.quantity-1 LOOP
    INSERT INTO public.tickets(event_id, ticket_type, price, status, holder_name, number)
      VALUES(c.event_id, c.ticket_type_name, c.unit_price, 'vendu', c.buyer_name, first_number + i) RETURNING id INTO ticket_id;
    INSERT INTO public.order_items(order_id, ticket_id) VALUES(c.id, ticket_id);
  END LOOP;
  UPDATE public.papi_checkouts SET status = 'paid', paid_at = now(), papi_reference = p_reference,
    payment_method = p_method WHERE id = c.id;
END $$;

-- Legacy manual validation/deletion must not undo an externally settled payment.
CREATE OR REPLACE FUNCTION public.protect_papi_order() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.payment_provider = 'papi' THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Une commande Papi payée ne peut pas être supprimée'; END IF;
    IF NEW.payment_status IS DISTINCT FROM OLD.payment_status OR NEW.payment_provider IS DISTINCT FROM OLD.payment_provider THEN
      RAISE EXCEPTION 'Le statut d’un paiement Papi ne peut pas être modifié manuellement';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_papi_order ON public.orders;
CREATE TRIGGER protect_papi_order BEFORE UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.protect_papi_order();
REVOKE ALL ON FUNCTION public.create_papi_checkout(uuid,text,uuid,bigint,integer,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_papi_checkout(uuid,numeric,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_papi_checkout(uuid,text,uuid,bigint,integer,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_papi_checkout(uuid,numeric,text,text) TO service_role;
COMMIT;
