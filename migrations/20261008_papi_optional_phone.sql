-- Apply after 20261006_papi_checkout.sql. Preserve existing phone numbers.
BEGIN;
ALTER TABLE public.papi_checkouts ALTER COLUMN buyer_phone DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN buyer_phone DROP NOT NULL;

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
      OR c.quantity <> p_quantity OR c.buyer_name <> p_buyer_name OR c.buyer_phone IS DISTINCT FROM p_buyer_phone
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

-- Keep the existing RPC signature and service-role-only access.
REVOKE ALL ON FUNCTION public.create_papi_checkout(uuid,text,uuid,bigint,integer,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_papi_checkout(uuid,text,uuid,bigint,integer,text,text,text) TO service_role;
COMMIT;
