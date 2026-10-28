import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

function celebriaApiPlugin(): Plugin {
  return {
    name: 'celebria-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) return next();

        if (req.url === '/api/download-zip' && req.method === 'GET') {
          const fs = await import('fs');
          const zipPath = path.resolve(__dirname, 'celebria-ai-source.zip');
          if (fs.existsSync(zipPath)) {
            const stat = fs.statSync(zipPath);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', 'attachment; filename="celebria-ai-source.zip"');
            fs.createReadStream(zipPath).pipe(res);
            return;
          } else {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'Zip file not generated yet' }));
            return;
          }
        }

        if (req.url === '/api/health' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'ok',
              service: 'Celebria AI Planner API (Dev)',
              geminiConfigured: Boolean(
                process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
              ),
              timestamp: new Date().toISOString(),
            })
          );
          return;
        }

        if (req.url === '/api/plan' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { event, customFocus } = JSON.parse(body);
              const { processPlanRequest } = await import('./src/server/geminiBackend.ts');
              const result = await processPlanRequest(event, customFocus);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: 'Internal server error processing plan',
                  details: 'Unexpected server error',
                })
              );
            }
          });
          return;
        }

        if (req.url === '/api/ideas' && req.method === 'POST') {
          const requestController = new AbortController();
          res.once('close', () => {
            if (!res.writableEnded) requestController.abort();
          });

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const { event, prompt } = JSON.parse(body);
              const { processIdeasRequest } = await import('./src/server/geminiBackend.ts');
              const result = await processIdeasRequest(event, prompt, { signal: requestController.signal });
              if (res.destroyed) return;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch {
              if (res.destroyed) return;
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: 'Internal server error processing ideas',
                })
              );
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), celebriaApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
