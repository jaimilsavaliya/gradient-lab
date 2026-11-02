const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Handle Next.js RSC requests
  if (parsedUrl.searchParams.has('_rsc')) {
    res.writeHead(204, { 'Content-Type': 'text/plain' });
    res.end();
    return;
  }

  // Redirect root to /gradient-lab so it matches Next.js App Router's SSR route
  if (pathname === '/') {
    res.writeHead(302, { 'Location': '/gradient-lab' });
    res.end();
    return;
  }

  // Serve app HTML
  if (pathname === '/gradient-lab' || pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath));
      return;
    }
  }

  // Normalize chunk and asset requests
  let baseName = path.basename(pathname);

  // Map font styles
  if (baseName === 'css' || pathname.includes('satoshi.css')) {
    baseName = 'satoshi.css';
  } else if (pathname.includes('0hb3ae-78g0aw')) {
    baseName = '0hb3ae-78g0aw.css';
  }

  // Look for target file
  let candidate = path.join(__dirname, baseName);
  if (!fs.existsSync(candidate)) {
    candidate = path.join(__dirname, pathname);
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    const ext = path.extname(candidate).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(candidate).pipe(res);
    return;
  }

  // Mock API endpoints (lead capture, analytics, tracking)
  if (pathname.startsWith('/api/') || pathname.includes('/track') || pathname.includes('/ba2f') || pathname.includes('/c973')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, status: 'mocked' }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(`404 Not Found: ${pathname}`);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/gradient-lab`;
  console.log(`\n======================================================`);
  console.log(`  Gradient Lab is running!`);
  console.log(`  Local URL: \x1b[36m${url}\x1b[0m`);
  console.log(`======================================================\n`);

  // Open browser in development
  if (process.env.NO_OPEN !== '1') {
    const startCmd = process.platform === 'win32' ? `start ${url}` : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`;
    exec(startCmd, () => {});
  }
});
