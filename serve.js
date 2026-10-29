/* =========================================================
   游戏厅 · 本地启动器
   直接双击 .bat 即可：起一个带 index 解析的静态服务，并打开浏览器。
   不依赖任何第三方包。
   ========================================================= */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8787);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    send(res, 400, 'bad request');
    return;
  }

  /* 阻止跳到上级目录 */
  const safe = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(ROOT, safe);

  if (!file.startsWith(ROOT)) {
    send(res, 403, 'forbidden');
    return;
  }

  fs.stat(file, (err, stat) => {
    if (err) {
      send(res, 404, '404 找不到：' + pathname);
      return;
    }
    if (stat.isDirectory()) {
      const index = path.join(file, 'index.html');
      fs.stat(index, (e2, s2) => {
        if (e2 || !s2.isFile()) {
          /* 目录里没有 index.html：明确告诉人，而不是列一堆文件 */
          send(res, 404, '这个目录里没有 index.html：' + pathname);
          return;
        }
        res.writeHead(200, {
          'Content-Type': MIME['.html'],
          'Cache-Control': 'no-store'
        });
        fs.createReadStream(index).pipe(res);
      });
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/`;
  console.log('');
  console.log('  游戏厅已启动：' + url);
  console.log('  关掉这个窗口就停止。');
  console.log('');
  const open =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  if (!process.env.NO_OPEN) exec(open, () => {});
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`端口 ${PORT} 已被占用，可能已经启动过一次，直接打开 http://127.0.0.1:${PORT}/ 试试。`);
  } else {
    console.log('启动失败：', err.message);
  }
  setTimeout(() => process.exit(1), 2500);
});
