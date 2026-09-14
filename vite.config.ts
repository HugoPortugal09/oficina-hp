import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-ignore
import nodemailer from 'nodemailer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'email-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/send-email', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method not allowed');
            return;
          }
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body);
              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                  user: process.env.EMAIL_EMISSOR || 'oficinahpapp@gmail.com',
                  pass: process.env.EMAIL_APP_PASSWORD || 'ewhzzvysccrptkns'
                }
              });
              const recipients = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
              console.log(`[Vite Server] A enviar email para: ${recipients}`);
              const info = await transporter.sendMail({
                from: '"Oficina HP" <oficinahpapp@gmail.com>',
                to: recipients,
                subject: payload.subject,
                html: payload.html,
                text: payload.text || ''
              });
              console.log(`[Vite Server] Email enviado com sucesso! MessageId: ${info.messageId}`);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, messageId: info.messageId, to: payload.to }));
            } catch (err: any) {
              console.error('[Vite Server] Erro ao enviar email:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err?.message || String(err) }));
            }
          });
        });
      }
    }
  ],
  server: {
    port: 3000,
    host: true
  }
});
