// ISOLATED TEST ADAPTER ONLY. Not imported by app/lib and never deployed as a route.
// Real PostgreSQL RLS in PGlite; Auth and Storage protocol responses are simulated.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { testDatabase, asRole, ids } from './database.mjs';
const db = await testDatabase();
const blobs = new Map();
const safeName = (x) => {
  if (!/^[a-z_][a-z_0-9]*$/.test(x)) throw new Error('invalid_identifier');
  return '"' + x + '"';
};
const users = Object.fromEntries(
  Object.entries(ids).map(([role, id]) => [
    id,
    {
      id,
      email: role + '@review.invalid',
      aud: 'authenticated',
      role: 'authenticated',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  ]),
);
function token(id) {
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  return (
    enc({ alg: 'HS256', typ: 'JWT' }) +
    '.' +
    enc({
      sub: id,
      aud: 'authenticated',
      role: 'authenticated',
      iss: 'http://127.0.0.1:54329/auth/v1',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    }) +
    '.test-only-signature'
  );
}
function session(id) {
  return {
    access_token: token(id),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'test-refresh-' + id,
    user: users[id],
  };
}
let sequence = Promise.resolve();
const server = http.createServer((req, res) => {
  sequence = sequence
    .then(() => handle(req, res))
    .catch((e) => {
      console.error('review adapter:', e.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'isolated_adapter_error' }));
      }
    });
});
async function handle(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:3100');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization,apikey,content-type,x-client-info,x-supabase-api-version,prefer,accept',
  );
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PATCH,DELETE,PUT,OPTIONS',
  );
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  const url = new URL(req.url, 'http://127.0.0.1:54329');
  const raw = [];
  for await (const chunk of req) raw.push(chunk);
  const bytes = Buffer.concat(raw);
  let body = {};
  if (req.headers['content-type']?.includes('json') && bytes.length)
    body = JSON.parse(bytes.toString());
  const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
  let userId;
  try {
    userId = JSON.parse(
      Buffer.from(bearer.split('.')[1], 'base64url').toString(),
    ).sub;
  } catch {}
  const role =
    bearer === 'test-service-only'
      ? 'service_role'
      : users[userId]
        ? 'authenticated'
        : 'anon';
  const send = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };
  if (url.pathname === '/health') return send({ testOnly: true });
  if (url.pathname.startsWith('/auth/v1/')) {
    if (url.pathname.endsWith('/token')) {
      const name = String(body.email || '').split('@')[0];
      const id = body.refresh_token?.replace('test-refresh-', '') || ids[name];
      if (!id || (!body.refresh_token && body.password !== 'TestPassword123!'))
        return send(
          { msg: 'Invalid login', error_code: 'invalid_credentials' },
          400,
        );
      return send(session(id));
    }
    if (url.pathname.endsWith('/user'))
      return users[userId]
        ? send(users[userId])
        : send({ msg: 'unauthorized' }, 401);
    if (url.pathname.endsWith('/recover')) return send({});
    if (url.pathname.endsWith('/verify'))
      return body.token_hash === 'test-invite'
        ? send(session(ids.member))
        : send({ msg: 'expired' }, 403);
    if (url.pathname.endsWith('/logout')) return send({});
    return send({ msg: 'unsupported auth test endpoint' }, 400);
  }
  if (url.pathname.startsWith('/storage/v1/object/')) {
    const key = decodeURIComponent(
      url.pathname
        .replace('/storage/v1/object/', '')
        .replace(/^authenticated\//, ''),
    );
    if (req.method === 'POST') {
      try {
        await asRole(db, role, userId, (tx) =>
          tx.query(
            'insert into storage.objects(bucket_id,name) values($1,$2)',
            [key.split('/')[0], key.split('/').slice(1).join('/')],
          ),
        );
      } catch {
        return send({ message: 'Forbidden' }, 403);
      }
      blobs.set(key, { bytes, mime: req.headers['content-type'] });
      return send({ Key: key });
    }
    if (role !== 'service_role' || !blobs.has(key))
      return send({ message: 'Not found' }, 404);
    const blob = blobs.get(key);
    res.writeHead(200, { 'Content-Type': blob.mime });
    return res.end(blob.bytes);
  }
  if (!url.pathname.startsWith('/rest/v1/'))
    return send({ error: 'not_found' }, 404);
  const path = url.pathname.replace('/rest/v1/', '');
  try {
    if (path.startsWith('rpc/')) {
      const fn = path.slice(4);
      if (fn !== 'has_article_access')
        return send({ error: 'rpc_unavailable' }, 403);
      const result = await asRole(db, role, userId, (tx) =>
        tx.query('select has_article_access() as value'),
      );
      return send(result.rows[0].value);
    }
    const table = safeName(path);
    const values = [];
    const bind = (value) => {
      values.push(value);
      return '$' + values.length;
    };
    const filters = [];
    for (const [key, value] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(key))
        continue;
      const col = safeName(key);
      const dot = value.indexOf('.');
      const op = value.slice(0, dot),
        v = value.slice(dot + 1);
      if (op === 'eq') filters.push(col + '=' + bind(v));
      else if (op === 'is' && v === 'null') filters.push(col + ' is null');
      else if (op === 'gt') filters.push(col + '>' + bind(v));
      else if (op === 'in') {
        filters.push(
          col + ' in (' + v.slice(1, -1).split(',').map(bind).join(',') + ')',
        );
      } else throw new Error('unsupported_filter');
    }
    const where = filters.length ? ' where ' + filters.join(' and ') : '';
    let sql;
    if (req.method === 'GET' || req.method === 'HEAD') {
      const selection = url.searchParams.get('select') || '*';
      const columns =
        selection === '*' ? '*' : selection.split(',').map(safeName).join(',');
      sql = 'select ' + columns + ' from ' + table + where;
      if (url.searchParams.has('order')) {
        sql +=
          ' order by ' +
          url.searchParams
            .get('order')
            .split(',')
            .map((item) => {
              const [col, dir] = item.split('.');
              return safeName(col) + (dir === 'desc' ? ' desc' : ' asc');
            })
            .join(',');
      }
      if (url.searchParams.has('limit'))
        sql += ' limit ' + bind(Number(url.searchParams.get('limit')));
    } else if (req.method === 'POST') {
      const entry = Array.isArray(body) ? body[0] : body;
      const keys = Object.keys(entry);
      sql =
        'insert into ' +
        table +
        '(' +
        keys.map(safeName).join(',') +
        ') values(' +
        keys.map((k) => bind(entry[k])).join(',') +
        ') returning *';
    } else if (req.method === 'PATCH') {
      sql =
        'update ' +
        table +
        ' set ' +
        Object.entries(body)
          .map(([k, v]) => safeName(k) + '=' + bind(v))
          .join(',') +
        where +
        ' returning *';
    } else return send({ error: 'unsupported' }, 405);
    const result = await asRole(db, role, userId, (tx) =>
      tx.query(sql, values),
    );
    if (req.headers.accept?.includes('vnd.pgrst.object'))
      return result.rows.length === 1
        ? send(result.rows[0])
        : send({ code: 'PGRST116', message: 'not found' }, 406);
    return send(result.rows, req.method === 'POST' ? 201 : 200);
  } catch (e) {
    return send({ code: e.code || 'TEST_ERROR', message: e.message }, 403);
  }
}
server.listen(54329, '127.0.0.1', () =>
  console.log('Isolated Auth/Storage adapter + PGlite on 54329'),
);
const child = spawn(
  process.execPath,
  [
    'node_modules/next/dist/bin/next',
    process.env.WWW_REVIEW_PRODUCTION === '1' ? 'start' : 'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3100',
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_SITE_URL: 'http://127.0.0.1:3100',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public-only',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-only',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
);
process.on('SIGINT', () => {
  child.kill();
  server.close();
  process.exit();
});
process.on('SIGTERM', () => {
  child.kill();
  server.close();
  process.exit();
});
child.on('exit', () => {
  server.close();
  process.exit();
});
