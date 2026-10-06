const supabase = require('../utils/supabase');

/**
 * GET /api/auth/tasks
 * Query: ?event_id=UUID
 * Retourne les tâches d'un événement. Inclut le profil assigné si présent.
 */
const listTasks = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const event_id = req.query.event_id;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!event_id) return res.status(400).json({ success: false, error: 'event_id requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // Retourner les tâches pour l'événement, joindre le profil assigné si disponible
    const { data: tasks, error: tasksError } = await db
      .from('tasks')
      .select('*, profiles:profiles(id,first_name,last_name)')
      .eq('event_id', event_id)
      .order('start_date', { ascending: true });

    if (tasksError) return res.status(400).json({ success: false, error: tasksError.message });

    return res.json({ success: true, tasks: tasks || [] });
  } catch (error) {
    console.error('Erreur GET tasks:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * POST /api/auth/tasks
 * Body: { event_id, title, description, start_date, end_date, status, assigned_to }
 * Création de tâche (admin de l'organisation requis)
 */
const createTask = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const payload = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!payload || !payload.event_id || !payload.title) return res.status(400).json({ success: false, error: 'Champs requis manquants' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // Vérifier que l'utilisateur est admin de l'organisation de l'événement
    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', payload.event_id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });

    const insertPayload = {
      event_id: payload.event_id,
      title: payload.title,
      description: payload.description || null,
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: payload.status || 'Pas commencé',
      assigned_to: payload.assigned_to || null,
    };

    const { data: inserted, error: insertError } = await db.from('tasks').insert(insertPayload).select().single();
    if (insertError) return res.status(400).json({ success: false, error: insertError.message });

    return res.status(201).json({ success: true, task: inserted });
  } catch (error) {
    console.error('Erreur POST tasks:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * PUT /api/auth/tasks/:id
 * Admin : mise à jour complète. Membre assigné (non-admin) : statut uniquement (RLS).
 */
const updateTask = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = req.params.id;
    const payload = req.body;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'ID requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    const { data: rows, error: fetchErr } = await db.from('tasks').select('*').eq('id', id).limit(1);
    if (fetchErr) return res.status(400).json({ success: false, error: fetchErr.message });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Tâche introuvable' });
    const task = rows[0];

    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', task.event_id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0) {
      return res.status(403).json({ success: false, error: 'Accès refusé: membre de l\'organisation requis' });
    }

    const isAdmin = memberRows[0].role === 'admin';

    if (isAdmin) {
      const { data: updated, error: updateError } = await db.from('tasks').update(payload).eq('id', id).select().single();
      if (updateError) return res.status(400).json({ success: false, error: updateError.message });
      return res.json({ success: true, task: updated });
    }

    if (task.assigned_to !== authData.user.id) {
      return res.status(403).json({ success: false, error: 'Accès refusé: vous ne pouvez modifier que vos propres tâches.' });
    }
    if (!payload?.status || typeof payload.status !== 'string') {
      return res.status(400).json({ success: false, error: 'Seul le statut peut être modifié.' });
    }
    const forbiddenFields = ['title', 'description', 'start_date', 'end_date', 'assigned_to', 'event_id', 'required_skills'];
    const hasForbiddenChange = forbiddenFields.some((field) => payload[field] !== undefined && payload[field] !== task[field]);
    if (hasForbiddenChange) {
      return res.status(403).json({ success: false, error: 'Seul le statut peut être modifié.' });
    }

    const { error: rpcError } = await db.rpc('update_task_status_secure', {
      target_task_id: id,
      new_status: payload.status,
    });
    if (rpcError) return res.status(400).json({ success: false, error: rpcError.message });

    const { data: updated, error: fetchUpdatedErr } = await db.from('tasks').select('*').eq('id', id).single();
    if (fetchUpdatedErr) return res.status(400).json({ success: false, error: fetchUpdatedErr.message });

    return res.json({ success: true, task: updated });
  } catch (error) {
    console.error('Erreur PUT tasks:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

/**
 * DELETE /api/auth/tasks/:id
 * Supprime une tâche (admin requis)
 */
const deleteTask = async (req, res) => {
  try {
    const access_token = req.headers.authorization?.split('Bearer ')[1];
    const id = req.params.id;

    if (!access_token) return res.status(401).json({ success: false, error: 'Token requis' });
    if (!id) return res.status(400).json({ success: false, error: 'ID requis' });

    const { data: authData, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !authData.user) return res.status(401).json({ success: false, error: 'Authentification invalide' });

    const db = supabase.createClientWithAuth(access_token);

    // fetch task to get event_id
    const { data: rows, error: fetchErr } = await db.from('tasks').select('*').eq('id', id).limit(1);
    if (fetchErr) return res.status(400).json({ success: false, error: fetchErr.message });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, error: 'Tâche introuvable' });
    const task = rows[0];

    const { data: eventRows, error: eventError } = await db.from('events').select('*').eq('id', task.event_id).limit(1);
    if (eventError) return res.status(400).json({ success: false, error: eventError.message });
    if (!eventRows || eventRows.length === 0) return res.status(404).json({ success: false, error: 'Événement introuvable' });
    const event = eventRows[0];

    const { data: memberRows } = await db.from('organization_members').select('*').eq('organization_id', event.organization_id).eq('profile_id', authData.user.id).limit(1);
    if (!memberRows || memberRows.length === 0 || memberRows[0].role !== 'admin') return res.status(403).json({ success: false, error: 'Accès refusé: administrateur requis' });

    const { error: deleteError } = await db.from('tasks').delete().eq('id', id);
    if (deleteError) return res.status(400).json({ success: false, error: deleteError.message });

    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE tasks:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
};

module.exports = {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
};
