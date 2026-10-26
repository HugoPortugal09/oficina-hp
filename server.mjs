import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

let cronModule = null;
try {
  cronModule = await import('./server-automations.mjs');
} catch (cronErr) {
  console.warn('[Server] ⚠️ server-automations.mjs não disponível ou erro ao carregar:', cronErr.message);
}

let emailImporterModule = null;
try {
  emailImporterModule = await import('./server-email-importer.mjs');
} catch (importerErr) {
  console.warn('[Server] ⚠️ server-email-importer.mjs não disponível ou erro ao carregar:', importerErr.message);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 80;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
  '.webmanifest': 'application/manifest+json; charset=UTF-8'
};

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'hp_app_sec_98fbc71a3d42';

if (!process.env.EMAIL_APP_PASSWORD) {
  console.warn('[Server] ⚠️ AVISO: EMAIL_APP_PASSWORD não configurada nas variáveis de ambiente. Configure no Easypanel.');
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_EMISSOR || 'oficinahpapp@gmail.com',
    pass: (process.env.EMAIL_APP_PASSWORD || '').replace(/\s+/g, '')
  }
});

export async function sendEmail({ to, subject, html, text, attachments }) {
  const recipients = Array.isArray(to) ? to.join(', ') : to;
  console.log(`[Server] A enviar email para: ${recipients} | Assunto: ${subject}`);
  const mailOptions = {
    from: `"Oficina HP" <${process.env.EMAIL_EMISSOR || 'oficinahpapp@gmail.com'}>`,
    to: recipients,
    subject: subject,
    html: html,
    text: text || ''
  };
  if (attachments && Array.isArray(attachments)) {
    mailOptions.attachments = attachments;
  }
  const info = await transporter.sendMail(mailOptions);
  console.log(`[Server] Email enviado com sucesso! MessageId: ${info.messageId}`);
  return info;
}

// Rate limiter for outgoing emails (max 40 emails / min)
let rateLimitWindowStart = Date.now();
let rateLimitCount = 0;

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-app-auth');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Route: POST /api/send-email
  if (req.url === '/api/send-email' && req.method === 'POST') {
    // 1. Security Check: Validate internal app key
    const authHeader = req.headers['authorization'] || '';
    const customHeader = req.headers['x-app-auth'] || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const token = customHeader.trim() || bearerToken;

    if (token !== INTERNAL_API_KEY) {
      console.warn('[Server] 🚫 Bloqueado acesso não autorizado a /api/send-email');
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Acesso não autorizado. Chave de aplicação inválida.' }));
      return;
    }

    // 2. Rate limiting check
    const now = Date.now();
    if (now - rateLimitWindowStart > 60000) {
      rateLimitWindowStart = now;
      rateLimitCount = 0;
    }
    rateLimitCount++;
    if (rateLimitCount > 40) {
      console.warn('[Server] ⚠️ Limite de envio por minuto excedido em /api/send-email');
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Limite de envio atingido. Aguarde antes de enviar novamente.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body);
        if (!payload.to || !payload.subject) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Campos "to" e "subject" são obrigatórios' }));
          return;
        }

        const info = await sendEmail(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, messageId: info.messageId, to: payload.to }));
      } catch (err) {
        console.error('[Server] Erro no envio de email:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
      }
    });
    return;
  }

  // API Route: POST or GET /api/check-incoming-emails (Processar emails novos de oficinahpapp@gmail.com)
  if (req.url.startsWith('/api/check-incoming-emails')) {
    try {
      console.log('[Server] 📥 A executar verificação de emails recebidos a pedido...');
      if (!emailImporterModule || typeof emailImporterModule.checkAndImportEmails !== 'function') {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Módulo de importação de email não disponível no servidor' }));
        return;
      }
      const result = await emailImporterModule.checkAndImportEmails();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error('[Server] Erro na verificação de emails recebidos:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message || String(err) }));
    }
    return;
  }

  // Healthcheck endpoint
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'oficina-hp-server' }));
    return;
  }

  // Debug deployment files endpoint
  if (req.url === '/api/debug-server') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    let files = [];
    try {
      files = fs.readdirSync(DIST_DIR);
    } catch (e) {
      files = [e.message];
    }
    let assetFiles = [];
    try {
      assetFiles = fs.readdirSync(path.join(DIST_DIR, 'assets'));
    } catch (e) {
      assetFiles = [e.message];
    }
    res.end(JSON.stringify({
      version: '2026-10-17-v2',
      distDir: DIST_DIR,
      files,
      assetCount: assetFiles.length,
      sampleAssets: assetFiles.slice(0, 15),
      hasNewIndex: assetFiles.includes('index-CNEDWza4.js'),
      hasOldIndex: assetFiles.includes('index-D1_ERkRS.js'),
      env: process.env.NODE_ENV,
      port: PORT
    }));
    return;
  }

  // Cron automation endpoints
  if (req.url === '/api/cron/check' || req.url === '/api/cron/run') {
    if (cronModule && typeof cronModule.runServerAutomations === 'function') {
      const isForced = req.method === 'POST';
      const cronResult = await cronModule.runServerAutomations(sendEmail, isForced);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, cronResult }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: 'Cron module não carregado' }));
    }
    return;
  }

  if (req.url === '/api/cron/status') {
    const lisbon = (cronModule && typeof cronModule.getLisbonTime === 'function')
      ? cronModule.getLisbonTime()
      : { timeStr: new Date().toISOString() };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: cronModule ? 'active' : 'idle', lisbon }));
    return;
  }

  // Static File Serving with SPA Fallback
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;
  if (pathname === '/') pathname = '/index.html';

  let filePath = path.join(DIST_DIR, pathname);
  
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA Fallback: serve index.html for client-side routing
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }

      const isNoCacheFile = ext === '.html' || pathname === '/sw.js' || pathname.endsWith('sw.js') || pathname === '/manifest.webmanifest' || pathname.endsWith('manifest.webmanifest');
      const cacheControl = isNoCacheFile
        ? 'no-cache, no-store, must-revalidate, max-age=0'
        : (pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=86400');

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl
      });
      res.end(content);
    });
  });
});

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Oficina HP Server a correr na porta ${PORT}`);
    if (cronModule && typeof cronModule.startServerAutomationCron === 'function') {
      cronModule.startServerAutomationCron(sendEmail);
    }
  });
}
