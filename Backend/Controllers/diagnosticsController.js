const supabase = require('../utils/supabase');

// Debug route - returns authenticated user id and tests a per-user select on tickets
// GET /api/auth/whoami
const whoami = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // Try a safe select on tickets to see if RLS allows it
    let canSelect = false;
    let sample = null;
    try {
      const { data: rows, error: ticketsErr } = await db.from('tickets').select('id,event_id,status').limit(1);
      if (ticketsErr) {
        console.warn('whoami: tickets select error:', ticketsErr.message || ticketsErr);
      } else if (rows && rows.length > 0) {
        canSelect = true;
        sample = rows[0];
      }
    } catch (e) {
      console.error('whoami: unexpected error during tickets select', e);
    }

    return res.json({ success: true, user: authData.user, canSelectTickets: canSelect, sampleTicket: sample });
  } catch (err) {
    console.error('whoami error:', err);
    return res.status(500).json({ success: false, error: 'Erreur interne' });
  }
};

// Dev-only debug route: return tickets and event_staff rows using admin client
// GET /api/auth/debug/tickets?event_id=<>&profile_id=<optional>
const inspectTickets = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const event_id = req.query.event_id;
    const profile_id = req.query.profile_id || authData.user.id;

    const admin = supabase.admin;
    if (!admin) return res.status(500).json({ success: false, error: 'Admin client non configuré' });

    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: tickets, error: tErr } = await admin.from('tickets').select('id,event_id,status,sold_by,scanned_by,holder_name').eq('event_id', event_id).order('created_at', { ascending: false });
    if (tErr) console.error('debug tickets select error:', tErr);

    const { data: staffRows, error: sErr } = await admin.from('event_staff').select('id,event_id,profile_id,status').eq('event_id', event_id).eq('profile_id', profile_id);
    if (sErr) console.error('debug event_staff select error:', sErr);

    return res.json({ success: true, tickets: tickets || [], event_staff: staffRows || [] });
  } catch (err) {
    console.error('debug tickets route error:', err);
    return res.status(500).json({ success: false, error: 'Erreur interne' });
  }
};

module.exports = {
  whoami,
  inspectTickets,
};
