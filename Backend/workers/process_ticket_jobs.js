const supabase = require('../utils/supabase');
const generateTickets = require('../services/generateTickets');

const POLL_INTERVAL_MS = Number(process.env.JOB_POLL_INTERVAL_MS) || 5000;

async function processOneJob() {
  const admin = supabase.admin;
  if (!admin) {
    console.error('Admin client not configured');
    return;
  }

  // fetch one pending job
  const { data: jobs, error: fetchErr } = await admin.from('ticket_jobs').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(1);
  if (fetchErr) {
    console.error('Failed to fetch jobs:', fetchErr);
    return;
  }
  if (!jobs || jobs.length === 0) return;

  const job = jobs[0];

  try {
    // claim job (optimistic)
    await admin.from('ticket_jobs').update({ status: 'processing', worker: process.env.HOSTNAME || 'worker', started_at: new Date().toISOString() }).eq('id', job.id);

    console.log('Processing job', job.id);
    const result = await generateTickets({ admin, payload: job.payload, frontendUrl: process.env.FRONTEND_URL });

    // upload PDF to storage bucket
    const bucket = process.env.TICKET_DESIGNS_BUCKET || 'ticket-designs';
    const storagePath = `jobs/${job.id}/${result.filename}`;
    const fileBuffer = Buffer.from(result.pdfBase64, 'base64');
    const { data: uploadData, error: uploadErr } = await admin.storage.from(bucket).upload(storagePath, fileBuffer, { contentType: 'application/pdf', upsert: true });
    if (uploadErr) {
      throw uploadErr;
    }

    // get public url
    let publicUrl = null;
    try {
      const { data: urlData } = await admin.storage.from(bucket).getPublicUrl(storagePath);
      publicUrl = urlData?.publicUrl || null;
    } catch (e) {
      // ignore
    }

    await admin.from('ticket_jobs').update({ status: 'completed', result_url: publicUrl, result_meta: { filename: result.filename }, finished_at: new Date().toISOString() }).eq('id', job.id);
    console.log('Job completed', job.id, publicUrl || storagePath);
  } catch (err) {
    console.error('Job processing failed', job.id, err);
    await admin.from('ticket_jobs').update({ status: 'failed', error: (err && err.message) ? err.message : String(err), finished_at: new Date().toISOString() }).eq('id', job.id);
  }
}

async function loop() {
  while (true) {
    try {
      await processOneJob();
    } catch (e) {
      console.error('Worker loop error', e);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

if (require.main === module) {
  console.log('Starting ticket jobs worker, polling every', POLL_INTERVAL_MS, 'ms');
  loop();
}
