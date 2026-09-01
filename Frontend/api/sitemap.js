const SITE_URL = (
  process.env.SITE_URL ||
  process.env.FRONTEND_URL ||
  'https://toliarevent.vercel.app'
).replace(/\/$/, '');

const API_URL = (
  process.env.VITE_API_URL ||
  process.env.API_URL ||
  'https://toliarevent.onrender.com/api/auth'
).replace(/\/$/, '');

const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/evenements', changefreq: 'daily', priority: '0.9' },
  { path: '/confidentialite', changefreq: 'yearly', priority: '0.3' },
  { path: '/cgu', changefreq: 'yearly', priority: '0.3' },
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
  ];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  parts.push('  </url>');
  return parts.join('\n');
}

async function fetchPublicEvents() {
  try {
    const response = await fetch(`${API_URL}/events/public`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const payload = await response.json();
    return Array.isArray(payload?.events) ? payload.events : [];
  } catch {
    return [];
  }
}

export default async function handler() {
  const today = new Date().toISOString().slice(0, 10);
  const events = await fetchPublicEvents();

  const entries = [
    ...STATIC_PAGES.map((page) =>
      urlEntry({
        loc: `${SITE_URL}${page.path}`,
        lastmod: today,
        changefreq: page.changefreq,
        priority: page.priority,
      }),
    ),
    ...events.map((event) =>
      urlEntry({
        loc: `${SITE_URL}/evenements/${event.id}`,
        lastmod: toIsoDate(event.updated_at || event.start_date || event.created_at) || today,
        changefreq: 'weekly',
        priority: '0.8',
      }),
    ),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
