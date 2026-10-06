const { ticketValidResetPayload } = require('./ticketHelpers');

async function assertOrderAdminAccess(db, admin, authUserId, orderId) {
  const { data: orderItems, error: itemsError } = await admin
    .from('order_items')
    .select('ticket_id, tickets(id, event_id)')
    .eq('order_id', orderId);

  if (itemsError) throw new Error(itemsError.message);
  if (!orderItems?.length) throw new Error('Aucun billet associé à cette commande');

  const eventIds = [...new Set(orderItems.map((item) => item.tickets?.event_id).filter(Boolean))];
  if (eventIds.length !== 1) throw new Error('Commande invalide: billets multi-événements');

  const { data: eventData, error: eventError } = await db
    .from('events')
    .select('organization_id')
    .eq('id', eventIds[0])
    .single();

  if (eventError || !eventData) throw new Error('Événement introuvable');

  const { data: memberRows } = await db
    .from('organization_members')
    .select('role')
    .eq('organization_id', eventData.organization_id)
    .eq('profile_id', authUserId)
    .limit(1);

  if (!memberRows?.length || memberRows[0].role !== 'admin') {
    throw new Error('Accès refusé: administrateur requis');
  }

  return { ticketIds: orderItems.map((item) => item.ticket_id) };
}

async function devalidateSingleOrder(db, admin, authUserId, orderId) {
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, payment_status')
    .eq('id', orderId)
    .single();

  if (orderError || !order) throw new Error('Commande introuvable');
  if (order.payment_status !== 'validated') {
    throw new Error('Seules les commandes validées peuvent être dévalidées');
  }

  const { ticketIds } = await assertOrderAdminAccess(db, admin, authUserId, orderId);

  const { data: tickets, error: ticketsError } = await admin
    .from('tickets')
    .select('id, status')
    .in('id', ticketIds);

  if (ticketsError) throw new Error(ticketsError.message);

  const blocked = (tickets || []).filter((ticket) =>
    ['utilisé', 'utilise', 'used'].includes(String(ticket.status || '').toLowerCase())
  );
  if (blocked.length > 0) {
    throw new Error('Impossible de dévalider: des billets ont déjà été scannés');
  }

  const now = new Date().toISOString();

  const { error: orderUpdateError } = await admin
    .from('orders')
    .update({ payment_status: 'pending' })
    .eq('id', orderId);

  if (orderUpdateError) throw new Error(orderUpdateError.message);

  const { error: ticketsUpdateError } = await admin
    .from('tickets')
    .update(ticketValidResetPayload(now))
    .in('id', ticketIds);

  if (ticketsUpdateError) {
    await admin.from('orders').update({ payment_status: 'validated' }).eq('id', orderId);
    throw new Error(ticketsUpdateError.message);
  }

  return { orderId, ticketIds };
}

module.exports = { assertOrderAdminAccess, devalidateSingleOrder };
