const { test } = require('node:test');
const assert = require('node:assert/strict');
const { config } = require('../services/papiClient');

test('configuration allows a local frontend only in development and identifies invalid HTTPS settings', t => {
  const values = {
    PAPI_API_KEY: 'test', PAPI_WEBHOOK_SECRET: 'test',
    PAPI_BASE_URL: 'https://app.papi.mg/engine/api',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_PUBLIC_URL: 'https://toliarevent.onrender.com', NODE_ENV: 'development',
  };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  Object.assign(process.env, values);
  assert.equal(config().frontend, 'http://localhost:5173');
  process.env.NODE_ENV = 'production';
  assert.throws(config, /FRONTEND_URL doit utiliser HTTPS/);
  process.env.FRONTEND_URL = 'https://toliarevent.vercel.app';
  assert.equal(config().backend, values.BACKEND_PUBLIC_URL);
  process.env.NODE_ENV = 'development';
  process.env.BACKEND_PUBLIC_URL = 'http://localhost:5000';
  assert.throws(config, /BACKEND_PUBLIC_URL doit utiliser HTTPS/);
  process.env.BACKEND_PUBLIC_URL = values.BACKEND_PUBLIC_URL;
  process.env.PAPI_BASE_URL = 'invalid';
  assert.throws(config, /PAPI_BASE_URL doit être une URL valide/);
});
