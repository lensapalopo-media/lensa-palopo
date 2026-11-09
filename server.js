const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);

  // Clean URLs & Aliases
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  } else if (reqPath === '/admin' || reqPath === '/admin/' || reqPath === '/dashboard') {
    reqPath = '/admin.html';
  }

  let filePath = path.join(__dirname, reqPath);

  fs.stat(filePath, (err, stats) => {
    // Jika tidak ditemukan dan tidak ada ekstensi, coba tambahkan .html
    if ((err || !stats.isFile()) && !path.extname(filePath)) {
      const htmlPath = filePath + '.html';
      if (fs.existsSync(htmlPath)) {
        filePath = htmlPath;
        err = null;
      }
    }

    if (err || (stats && !stats.isFile() && !fs.existsSync(filePath))) {
      // Fallback ke index.html untuk Single Page Application
      const indexPath = path.join(__dirname, 'index.html');
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ext === '.json' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server Lensa Palopo aktif di port ${PORT}:`);
  console.log(`- Web Utama : http://localhost:${PORT}/`);
  console.log(`- Admin     : http://localhost:${PORT}/admin.html`);
});

