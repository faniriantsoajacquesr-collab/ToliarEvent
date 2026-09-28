// Resolve the tariff from the event's catalog, never from a client-supplied price.
module.exports = async function resolveTicketType(db, payload) {
  let query = db.from('ticket_type').select('id, name, price').eq('event_id', payload.event_id);
  query = payload.ticket_type_id ? query.eq('id', payload.ticket_type_id) : query.eq('name', payload.ticket_type);
  const { data, error } = await query.single();
  if (error || !data) throw new Error('Type de billet introuvable pour cet événement');
  const price = Number(data.price);
  if (data.price == null || !Number.isFinite(price) || price < 0) throw new Error('Tarif du type de billet invalide');
  return { ...data, price };
};
