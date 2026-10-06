const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const { once } = require('node:events');
const express = require('express');
const routes = require('./fixtures/api-routes.json');
const root = path.resolve(__dirname, '..');

// Isolate each app and replace only external dependencies; never load real credentials.
function loadBackend(mocks) {
  const cache = new Map();
  function load(filename) {
    const relative = path.relative(root, filename).split(path.sep).join('/');
    if (Object.hasOwn(mocks, relative)) return mocks[relative];
    if (cache.has(filename)) return cache.get(filename).exports;
    const instance = new Module(filename, module);
    instance.filename = filename;
    instance.paths = Module._nodeModulePaths(path.dirname(filename));
    const localRequire = Module.createRequire(filename);
    instance.require = (specifier) => {
      const resolved = localRequire.resolve(specifier);
      return specifier.startsWith('.') && resolved.startsWith(root + path.sep)
        ? load(resolved)
        : localRequire(specifier);
    };
    cache.set(filename, instance);
    instance._compile(fs.readFileSync(filename, 'utf8'), filename);
    return instance.exports;
  }
  return load(path.join(root, 'Routes/index.js'));
}

async function startApp(t, mocks) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', loadBackend(mocks));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }));
  return async (method, endpoint, body, token) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth${endpoint}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
  };
}

function query(result) {
  const chain = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'delete', 'update']) {
    chain[method] = () => chain;
  }
  chain.single = chain.maybeSingle = async () => result;
  chain.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return chain;
}

function database(status = 'active') {
  const calls = [];
  const user = { id: 'user-1', email: 'student@example.test', user_metadata: {} };
  const db = {
    auth: {
      async getUser(token) { calls.push(['getUser', token]); return { data: { user }, error: null }; },
      async signInWithPassword(credentials) {
        calls.push(['login', credentials]);
        return { data: { user, session: { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 } }, error: null };
      },
    },
    from(table) {
      calls.push(['from', table]);
      if (table === 'organization_members') return query({ data: { organization_id: 'org-1', organizations: { status } }, error: null });
      if (table === 'profiles') return query({ data: { id: user.id }, error: null });
      if (['event_landing_pages', 'event_categories', 'profile_skills'].includes(table)) return query({ data: [], error: null });
      throw new Error(`Unexpected database access: ${table}`);
    },
    createClientWithAuth() { return db; },
  };
  return { db, calls };
}

test('the mounted API contains legacy routes and Papi checkout routes without duplicates', () => {
  const { db } = database();
  const router = loadBackend({ 'utils/supabase.js': db });
  function inventory(current) {
    return current.stack.flatMap(layer => {
      if (layer.route) return Object.keys(layer.route.methods).map(method => `${method} ${layer.route.path}`);
      return layer.handle.stack ? inventory(layer.handle) : [];
    });
  }
  const actual = inventory(router);
  assert.equal(new Set(actual).size, actual.length);
  assert.deepEqual(actual.sort(), [...routes.map(route => `${route.method} ${route.path}`), 'post /events/:id/checkout', 'get /checkouts/:id', 'post /checkouts/:id/pay'].sort());
});

test('all 80 legacy endpoints dispatch to their domain handler; access middleware sees the full path once', async t => {
  const seen = [];
  const mocks = {
    'utils/supabase.js': database().db,
    'utils/organizationAccess.js': { organizationAccessMiddleware(req, _res, next) { seen.push(req.path); next(); } },
  };
  for (const route of routes) {
    const key = `Controllers/${route.domain}Controller.js`;
    mocks[key] ||= {};
    mocks[key][route.name] = (req, res) => res.json({ domain: route.domain, name: route.name, params: req.params });
  }
  const request = await startApp(t, mocks);
  assert.equal(routes.length, 80);
  for (const route of routes) {
    const endpoint = route.path.replace(/:([A-Za-z]+)/g, '$1-value');
    const before = seen.length;
    const response = await request(route.method.toUpperCase(), endpoint, route.method === 'get' ? undefined : {});
    assert.equal(response.status, 200, `${route.method} ${endpoint}`);
    assert.equal(response.body.domain, route.domain, endpoint);
    assert.equal(response.body.name, route.name, endpoint);
    assert.deepEqual(seen.slice(before), [endpoint]);
    for (const match of route.path.matchAll(/:([A-Za-z]+)/g)) assert.equal(response.body.params[match[1]], `${match[1]}-value`);
  }
});

test('real authentication handlers preserve registration closure, validation and login response', async t => {
  const { db, calls } = database();
  const request = await startApp(t, { 'utils/supabase.js': db });
  const closed = await request('POST', '/signup', { email: 'student@example.test', password: 'example-password' });
  assert.equal(closed.status, 403);
  assert.equal(closed.body.code, 'REGISTRATION_CLOSED');
  assert.equal((await request('POST', '/login', {})).status, 400);
  assert.equal(calls.length, 0);
  const login = await request('POST', '/login', { email: 'student@example.test', password: 'example-password' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.id, 'user-1');
  assert.deepEqual(login.body.session, { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 });
});

test('protected domains still reject requests without authentication', async t => {
  const { db, calls } = database();
  const request = await startApp(t, { 'utils/supabase.js': db });
  for (const endpoint of ['/events', '/tickets', '/organization-members', '/event-staff', '/transactions', '/tasks', '/events/event-1/orders', '/admin/organizations/pending', '/user']) {
    assert.equal((await request('GET', endpoint)).status, 401, endpoint);
  }
  assert.equal(calls.length, 0);
});

test('pending/rejected organizations stay blocked across nested routers, while public and onboarding paths remain accessible', async t => {
  for (const status of ['pending', 'rejected']) {
    const { db, calls } = database(status);
    const request = await startApp(t, { 'utils/supabase.js': db });
    for (const endpoint of ['/events', '/tickets', '/tasks', '/events/event-1/orders']) {
      const response = await request('GET', endpoint, undefined, 'token');
      assert.equal(response.status, 403, endpoint);
      assert.equal(response.body.error, `ORGANIZATION_${status.toUpperCase()}`);
    }
    const before = calls.filter(call => call[0] === 'getUser').length;
    const publicResponse = await request('GET', '/events/public', undefined, 'token');
    assert.equal(publicResponse.status, 200);
    assert.deepEqual(publicResponse.body.events, []);
    assert.equal(calls.filter(call => call[0] === 'getUser').length, before);
    assert.equal((await request('GET', '/user', undefined, 'token')).status, 200);
  }
});

test('profile skill updates return success for both empty and populated selections', async t => {
  const { db } = database();
  const request = await startApp(t, { 'utils/supabase.js': db });
  for (const skill_ids of [[], ['skill-1']]) {
    const response = await request('POST', '/profile-skills', { skill_ids }, 'token');
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.deepEqual(response.body.profile_skills, []);
  }
});
