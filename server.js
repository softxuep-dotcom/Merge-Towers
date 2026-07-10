// 开发用零依赖静态服务器
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = __dirname;
const HOST = process.env.HOST || '0.0.0.0';
const PORT = process.env.PORT || 8080;
const EDITOR_PATH = '/?editor=1';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

function isPrivateLanIp(address) {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(address);
}

function getLanIp() {
  const candidates = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const info of interfaces || []) {
      if (info.family === 'IPv4' && !info.internal && !info.address.startsWith('169.254.')) {
        candidates.push(info.address);
      }
    }
  }
  return candidates.find(isPrivateLanIp) || candidates[0] || 'localhost';
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(ROOT, urlPath);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, HOST, () => {
  const localUrl = `http://localhost:${PORT}`;
  const mobileUrl = `http://${getLanIp()}:${PORT}`;
  console.log('');
  console.log('SSA Dev Server');
  console.log(`手机访问: ${mobileUrl}`);
  console.log(`电脑编辑: ${localUrl}${EDITOR_PATH}`);
  console.log('按 Ctrl+C 停止服务器');
  console.log('');
});
