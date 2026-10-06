const supabase = require('../utils/supabase');
const { createCheckoutService } = require('../services/papiCheckout');
const { config } = require('../services/papiClient');

function startPapiReconciliation() {
  if (process.env.PAPI_RECONCILE_ENABLED !== 'true' || !supabase.admin) return;
  config();
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const { data, error } = await supabase.admin.from('papi_checkouts').select('*')
        .neq('status', 'paid').not('payment_link', 'is', null)
        .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(Date.now() - 60000).toISOString()}`)
        .order('last_checked_at', { ascending: true, nullsFirst: true }).limit(20);
      if (error) throw new Error('Papi reconciliation query failed');
      const svc = createCheckoutService(supabase.admin);
      for (const checkout of data || []) {
        try { await svc.reconcile(checkout); }
        catch { console.warn('Papi: confirmation à revérifier', checkout.id); }
      }
    } catch { console.warn('Papi: rattrapage indisponible, vérifier la configuration et la migration.'); }
    finally { running = false; }
  };
  const timer = setInterval(run, 60000);
  timer.unref();
  void run();
}
module.exports = { startPapiReconciliation };
