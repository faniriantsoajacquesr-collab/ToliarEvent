const supabase = require('../utils/supabase');
const { assertOrderAdminAccess, devalidateSingleOrder } = require('../services/orderHelpers');

/**
 * GET /api/auth/payment-methods
 * Liste publique des moyens de paiement actifs (Mobile Money).
 */
const listPaymentMethods = async (req, res) => {
  try {
    const admin = supabase.admin || supabase;
    if (!admin) return res.status(500).json({ success: false, error: 'Admin client non configuré' });

    const { data, error } = await admin
      .from('payment_method')
      .select('id, Operateur, numero, account_holder, is_active')
      .eq('is_active', true)
      .order('id', { ascending: true });

    if (error) return res.status(400).json({ success: false, error: error.message });

    return res.json({ success: true, payment_methods: data || [] });
  } catch (error) {
    console.error('Erreur GET payment-methods:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * POST /api/auth/events/:id/purchase-ticket
 * Achat public de billet(s) via Mobile Money (sans authentification).
 * Body: { ticket_type_id, quantity?, buyer_name, buyer_phone, buyer_email?, buyer_address?, transaction_id, total_amount, payment_method }
 */
const purchaseTicket = async (_req, res) => res.status(410).json({ success: false, error: 'Utilisez le nouveau parcours de paiement Papi.' });

/**
 * GET /api/auth/events/:eventId/orders
 * Liste les commandes en ligne liées à un événement + KPIs (admin requis).
 * Query: ?payment_status=pending|validated|rejected|all (default all)
 */
const listEventOrders = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { eventId } = req.params;
    const paymentStatusFilter = String(req.query.payment_status || 'all').toLowerCase();

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!eventId) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;

    const { data: eventData, error: eventError } = await db
      .from('events')
      .select('id, organization_id, title')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return res.status(404).json({ success: false, error: 'Événement introuvable' });
    }

    const { data: memberRows } = await db
      .from('organization_members')
      .select('role')
      .eq('organization_id', eventData.organization_id)
      .eq('profile_id', authData.user.id)
      .limit(1);

    if (!memberRows?.length || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const { data: eventTickets, error: ticketsError } = await admin
      .from('tickets')
      .select('id, number, ticket_type, status, holder_name')
      .eq('event_id', eventId);

    if (ticketsError) {
      return res.status(400).json({ success: false, error: ticketsError.message });
    }

    const ticketMap = new Map((eventTickets || []).map((ticket) => [ticket.id, ticket]));
    const eventTicketIds = [...ticketMap.keys()];

    if (eventTicketIds.length === 0) {
      return res.json({
        success: true,
        orders: [],
        kpis: {
          total_orders: 0,
          pending_orders: 0,
          validated_orders: 0,
          rejected_orders: 0,
          pending_amount: 0,
          validated_revenue: 0,
          pending_tickets: 0,
          validated_tickets: 0,
        },
      });
    }

    const { data: orderItems, error: orderItemsError } = await admin
      .from('order_items')
      .select('order_id, ticket_id')
      .in('ticket_id', eventTicketIds);

    if (orderItemsError) {
      return res.status(400).json({ success: false, error: orderItemsError.message });
    }

    const orderIds = [...new Set((orderItems || []).map((item) => item.order_id))];

    if (orderIds.length === 0) {
      return res.json({
        success: true,
        orders: [],
        kpis: {
          total_orders: 0,
          pending_orders: 0,
          validated_orders: 0,
          rejected_orders: 0,
          pending_amount: 0,
          validated_revenue: 0,
          pending_tickets: 0,
          validated_tickets: 0,
        },
      });
    }

    const { data: orders, error: ordersError } = await admin
      .from('orders')
      .select(`
        id,
        buyer_name,
        buyer_phone,
        buyer_email,
        buyer_address,
        transaction_id,
        total_amount,
        payment_status,
        payment_method,
        payment_provider,
        created_at
      `)
      .in('id', orderIds)
      .order('created_at', { ascending: false });

    if (ordersError) {
      return res.status(400).json({ success: false, error: ordersError.message });
    }

    const paymentMethodIds = [
      ...new Set((orders || []).map((order) => order.payment_method).filter(Boolean)),
    ];

    let paymentMethodMap = new Map();
    if (paymentMethodIds.length > 0) {
      const { data: paymentMethods } = await admin
        .from('payment_method')
        .select('id, Operateur, numero')
        .in('id', paymentMethodIds);
      paymentMethodMap = new Map((paymentMethods || []).map((method) => [method.id, method]));
    }

    const itemsByOrder = new Map();
    for (const item of orderItems || []) {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      const ticket = ticketMap.get(item.ticket_id);
      if (ticket) {
        itemsByOrder.get(item.order_id).push({
          id: ticket.id,
          number: ticket.number,
          ticket_type: ticket.ticket_type,
          status: ticket.status,
          holder_name: ticket.holder_name,
        });
      }
    }

    const enrichedOrders = (orders || []).map((order) => ({
      ...order,
      payment_method: paymentMethodMap.get(order.payment_method) || null,
      tickets: itemsByOrder.get(order.id) || [],
      ticket_count: (itemsByOrder.get(order.id) || []).length,
    }));

    const kpis = enrichedOrders.reduce(
      (acc, order) => {
        acc.total_orders += 1;
        const amount = Number(order.total_amount) || 0;
        const ticketCount = order.ticket_count || 0;

        if (order.payment_status === 'pending') {
          acc.pending_orders += 1;
          acc.pending_amount += amount;
          acc.pending_tickets += ticketCount;
        } else if (order.payment_status === 'validated') {
          acc.validated_orders += 1;
          acc.validated_revenue += amount;
          acc.validated_tickets += ticketCount;
        } else if (order.payment_status === 'rejected') {
          acc.rejected_orders += 1;
        }

        return acc;
      },
      {
        total_orders: 0,
        pending_orders: 0,
        validated_orders: 0,
        rejected_orders: 0,
        pending_amount: 0,
        validated_revenue: 0,
        pending_tickets: 0,
        validated_tickets: 0,
      }
    );

    const filteredOrders =
      paymentStatusFilter === 'all'
        ? enrichedOrders
        : enrichedOrders.filter((order) => order.payment_status === paymentStatusFilter);

    return res.json({ success: true, orders: filteredOrders, kpis });
  } catch (error) {
    console.error('Erreur GET event orders:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * POST /api/auth/orders/bulk-devalidate
 * Body: { order_ids: string[] }
 */
const bulkDevalidate = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { order_ids } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'order_ids requis (tableau non vide)' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;
    let devalidatedCount = 0;
    const errors = [];

    for (const orderId of order_ids) {
      try {
        await devalidateSingleOrder(db, admin, authData.user.id, orderId);
        devalidatedCount += 1;
      } catch (err) {
        errors.push({ order_id: orderId, error: err.message || 'Erreur de dévalidation' });
      }
    }

    return res.json({
      success: devalidatedCount > 0,
      devalidated_count: devalidatedCount,
      errors,
      message: `${devalidatedCount} commande(s) dévalidée(s) avec succès.`,
    });
  } catch (error) {
    console.error('Erreur POST orders/bulk-devalidate:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * POST /api/auth/orders/bulk-validate
 * Body: { order_ids: string[] }
 */
const bulkValidate = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { order_ids } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'order_ids requis (tableau non vide)' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;
    const now = new Date().toISOString();
    let validatedCount = 0;
    const errors = [];

    for (const orderId of order_ids) {
      try {
        const { data: order, error: orderError } = await admin
          .from('orders')
          .select('id, payment_status')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          errors.push({ order_id: orderId, error: 'Commande introuvable' });
          continue;
        }
        if (order.payment_status !== 'pending') {
          errors.push({ order_id: orderId, error: 'Commande déjà traitée' });
          continue;
        }

        const { ticketIds } = await assertOrderAdminAccess(db, admin, authData.user.id, orderId);

        const { error: orderUpdateError } = await admin
          .from('orders')
          .update({ payment_status: 'validated' })
          .eq('id', orderId);

        if (orderUpdateError) {
          errors.push({ order_id: orderId, error: orderUpdateError.message });
          continue;
        }

        const { error: ticketsUpdateError } = await admin
          .from('tickets')
          .update({ status: 'vendu', sold_by: authData.user.id, updated_at: now })
          .in('id', ticketIds);

        if (ticketsUpdateError) {
          await admin.from('orders').update({ payment_status: 'pending' }).eq('id', orderId);
          errors.push({ order_id: orderId, error: ticketsUpdateError.message });
          continue;
        }

        validatedCount += 1;
      } catch (err) {
        errors.push({ order_id: orderId, error: err.message || 'Erreur de validation' });
      }
    }

    return res.json({
      success: validatedCount > 0,
      validated_count: validatedCount,
      errors,
      message: `${validatedCount} commande(s) validée(s) avec succès.`,
    });
  } catch (error) {
    console.error('Erreur POST orders/bulk-validate:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * POST /api/auth/orders/bulk-delete
 * Body: { order_ids: string[] }
 */
const bulkDelete = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { order_ids } = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!Array.isArray(order_ids) || order_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'order_ids requis (tableau non vide)' });
    }

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;
    let deletedCount = 0;
    const errors = [];

    for (const orderId of order_ids) {
      try {
        const { data: order, error: orderError } = await admin
          .from('orders')
          .select('id')
          .eq('id', orderId)
          .single();

        if (orderError || !order) {
          errors.push({ order_id: orderId, error: 'Commande introuvable' });
          continue;
        }

        const { ticketIds } = await assertOrderAdminAccess(db, admin, authData.user.id, orderId);

        const { error: deleteOrderError } = await admin.from('orders').delete().eq('id', orderId);
        if (deleteOrderError) {
          errors.push({ order_id: orderId, error: deleteOrderError.message });
          continue;
        }

        if (ticketIds.length > 0) {
          const { error: deleteTicketsError } = await admin.from('tickets').delete().in('id', ticketIds);
          if (deleteTicketsError) {
            errors.push({ order_id: orderId, error: deleteTicketsError.message });
            continue;
          }
        }

        deletedCount += 1;
      } catch (err) {
        errors.push({ order_id: orderId, error: err.message || 'Erreur de suppression' });
      }
    }

    return res.json({
      success: deletedCount > 0,
      deleted_count: deletedCount,
      errors,
      message: `${deletedCount} commande(s) supprimée(s) avec succès.`,
    });
  } catch (error) {
    console.error('Erreur POST orders/bulk-delete:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * POST /api/auth/orders/:id/validate
 * Valide une commande en ligne : payment_status → validated, billets → vendu + sold_by admin.
 */
const validateOrder = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id: orderId } = req.params;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!orderId) return res.status(400).json({ success: false, error: 'order_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, payment_status, total_amount')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ success: false, error: 'Commande introuvable' });
    }

    if (order.payment_status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Cette commande a déjà été traitée' });
    }

    const { data: orderItems, error: itemsError } = await admin
      .from('order_items')
      .select('ticket_id, tickets(id, event_id)')
      .eq('order_id', orderId);

    if (itemsError) {
      return res.status(400).json({ success: false, error: itemsError.message });
    }

    if (!orderItems?.length) {
      return res.status(400).json({ success: false, error: 'Aucun billet associé à cette commande' });
    }

    const eventIds = [
      ...new Set(
        orderItems
          .map((item) => item.tickets?.event_id)
          .filter(Boolean)
      ),
    ];

    if (eventIds.length !== 1) {
      return res.status(400).json({ success: false, error: 'Commande invalide: billets multi-événements' });
    }

    const eventId = eventIds[0];

    const { data: eventData, error: eventError } = await db
      .from('events')
      .select('organization_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return res.status(404).json({ success: false, error: 'Événement introuvable' });
    }

    const { data: memberRows } = await db
      .from('organization_members')
      .select('role')
      .eq('organization_id', eventData.organization_id)
      .eq('profile_id', authData.user.id)
      .limit(1);

    if (!memberRows?.length || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const ticketIds = orderItems.map((item) => item.ticket_id);
    const now = new Date().toISOString();

    const { error: orderUpdateError } = await admin
      .from('orders')
      .update({ payment_status: 'validated' })
      .eq('id', orderId);

    if (orderUpdateError) {
      return res.status(400).json({ success: false, error: orderUpdateError.message });
    }

    const { data: updatedTickets, error: ticketsUpdateError } = await admin
      .from('tickets')
      .update({
        status: 'vendu',
        sold_by: authData.user.id,
        updated_at: now,
      })
      .in('id', ticketIds)
      .select('id, number, ticket_type, status, sold_by');

    if (ticketsUpdateError) {
      await admin.from('orders').update({ payment_status: 'pending' }).eq('id', orderId);
      return res.status(400).json({ success: false, error: ticketsUpdateError.message });
    }

    return res.json({
      success: true,
      order_id: orderId,
      tickets: updatedTickets,
      message: 'Paiement validé et billets marqués comme vendus',
    });
  } catch (error) {
    console.error('Erreur POST validate order:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * POST /api/auth/orders/:id/devalidate
 * Annule la validation d'une commande : payment_status → pending, billets → valide.
 */
const devalidateOrder = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id: orderId } = req.params;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!orderId) return res.status(400).json({ success: false, error: 'order_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;

    const result = await devalidateSingleOrder(db, admin, authData.user.id, orderId);

    return res.json({
      success: true,
      order_id: result.orderId,
      ticket_ids: result.ticketIds,
      message: 'Commande dévalidée et billets remis en statut valide',
    });
  } catch (error) {
    console.error('Erreur POST devalidate order:', error);
    return res.status(400).json({ success: false, error: error.message || 'Erreur serveur' });
  }
};

/**
 * DELETE /api/auth/orders/:id
 * Supprime une commande en ligne et les billets associés (admin requis).
 */
const deleteOrder = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const { id: orderId } = req.params;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!orderId) return res.status(400).json({ success: false, error: 'order_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Authentification invalide' });
    }

    const db = supabase.createClientWithAuth(access_token);
    const admin = supabase.admin || supabase;

    const { data: order, error: orderError } = await admin
      .from('orders')
      .select('id, payment_status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return res.status(404).json({ success: false, error: 'Commande introuvable' });
    }

    const { data: orderItems, error: itemsError } = await admin
      .from('order_items')
      .select('ticket_id, tickets(id, event_id)')
      .eq('order_id', orderId);

    if (itemsError) {
      return res.status(400).json({ success: false, error: itemsError.message });
    }

    if (!orderItems?.length) {
      return res.status(400).json({ success: false, error: 'Aucun billet associé à cette commande' });
    }

    const eventIds = [
      ...new Set(
        orderItems
          .map((item) => item.tickets?.event_id)
          .filter(Boolean)
      ),
    ];

    if (eventIds.length !== 1) {
      return res.status(400).json({ success: false, error: 'Commande invalide: billets multi-événements' });
    }

    const eventId = eventIds[0];

    const { data: eventData, error: eventError } = await db
      .from('events')
      .select('organization_id')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return res.status(404).json({ success: false, error: 'Événement introuvable' });
    }

    const { data: memberRows } = await db
      .from('organization_members')
      .select('role')
      .eq('organization_id', eventData.organization_id)
      .eq('profile_id', authData.user.id)
      .limit(1);

    if (!memberRows?.length || memberRows[0].role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });
    }

    const ticketIds = orderItems.map((item) => item.ticket_id);

    const { error: deleteOrderError } = await admin.from('orders').delete().eq('id', orderId);
    if (deleteOrderError) {
      return res.status(400).json({ success: false, error: deleteOrderError.message });
    }

    if (ticketIds.length > 0) {
      const { error: deleteTicketsError } = await admin.from('tickets').delete().in('id', ticketIds);
      if (deleteTicketsError) {
        return res.status(400).json({
          success: false,
          error: `Commande supprimée, mais erreur lors de la suppression des billets: ${deleteTicketsError.message}`,
        });
      }
    }

    return res.json({
      success: true,
      order_id: orderId,
      deleted_ticket_ids: ticketIds,
      message: 'Commande supprimée avec succès',
    });
  } catch (error) {
    console.error('Erreur DELETE order:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

module.exports = {
  listPaymentMethods,
  purchaseTicket,
  listEventOrders,
  bulkDevalidate,
  bulkValidate,
  bulkDelete,
  validateOrder,
  devalidateOrder,
  deleteOrder,
};
