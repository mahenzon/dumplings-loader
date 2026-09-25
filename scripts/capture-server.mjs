// Receives the README hero image from scripts/capture.html and writes it to docs/.
// Usage: node scripts/capture-server.mjs [--port 5180] [--docs ./docs]
// Then open http://localhost:5173/scripts/capture.html (vite dev server); the server exits when done.
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((arg, i, all) => (arg.startsWith('--') ? [arg.slice(2), all[i + 1]] : null))
    .filter(Boolean),
);
const port = Number(args.port || 5180);
const docs = args.docs || join(process.cwd(), 'docs');
mkdirSync(docs, { recursive: true });

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, headers);
    return res.end();
  }
  const url = new URL(req.url, `http://localhost:${port}`);
  if (req.method === 'POST' && url.pathname === '/image') {
    const name = (url.searchParams.get('name') || 'demo.webp').replace(/[^\w.-]/g, '');
    const body = await readBody(req);
    writeFileSync(join(docs, name), body);
    res.writeHead(200, headers);
    res.end(`${name}: ${(body.length / 1024).toFixed(1)} KB`);
    process.stdout.write(`wrote ${join(docs, name)} (${(body.length / 1024).toFixed(1)} KB)\n`);
    if (url.searchParams.get('last') === '1') setTimeout(() => process.exit(0), 100);
    return undefined;
  }
  res.writeHead(404, headers);
  return res.end();
}).listen(port, () => {
  process.stdout.write(`capture server on http://localhost:${port} → ${docs}\n`);
});
