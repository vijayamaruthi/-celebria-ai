/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { processPlanRequest, processIdeasRequest } from './src/server/geminiBackend.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Port 3000 is required by the environment where Nginx reverse proxies 8080 -> 3000
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'Celebria AI Planner API',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    timestamp: new Date().toISOString(),
  });
});

// Download complete source code ZIP
app.get('/api/download-zip', (_req: Request, res: Response) => {
  const zipPath = path.resolve(__dirname, 'celebria-ai-source.zip');
  if (fs.existsSync(zipPath)) {
    res.download(zipPath, 'celebria-ai-source.zip', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Failed to stream ZIP archive' });
      }
    });
  } else {
    res.status(404).json({ error: 'Source archive not found' });
  }
});

// Comprehensive AI Plan endpoint
app.post('/api/plan', async (req: Request, res: Response) => {
  const requestController = new AbortController();
  const abortIfDisconnected = () => {
    if (!res.writableEnded) requestController.abort();
  };
  req.once('aborted', abortIfDisconnected);
  res.once('close', abortIfDisconnected);
  if (req.aborted) requestController.abort();

  try {
    const { event, customFocus } = req.body;
    if (!event || !event.name || !event.type) {
      res.status(400).json({ error: 'Missing required celebration event specifications' });
      return;
    }

    const result = await processPlanRequest(event, customFocus, { signal: requestController.signal });
    if (res.destroyed) return;
    res.json(result);
  } catch {
    if (res.destroyed || requestController.signal.aborted) return;
    // Unexpected provider/request errors can contain sensitive details; keep them out of logs and responses.
    console.error('Failed to process /api/plan request.');
    res.status(500).json({
      error: 'Failed to process AI planning request',
      details: 'Unexpected server error',
    });
  } finally {
    req.off('aborted', abortIfDisconnected);
    res.off('close', abortIfDisconnected);
  }
});

// Creative Ideas endpoint
app.post('/api/ideas', async (req: Request, res: Response) => {
  const requestController = new AbortController();
  res.once('close', () => {
    if (!res.writableEnded) requestController.abort();
  });

  try {
    const { event, prompt } = req.body;
    if (!event || !prompt) {
      res.status(400).json({ error: 'Missing event or prompt parameters' });
      return;
    }

    const result = await processIdeasRequest(event, prompt, { signal: requestController.signal });
    if (res.destroyed) return;
    res.json(result);
  } catch {
    if (res.destroyed) return;
    // Avoid logging raw request/provider errors, which may contain user content or credentials.
    console.error('Failed to process /api/ideas request.');
    res.status(500).json({
      error: 'Failed to generate ideas',
    });
  }
});

// Serve production assets from dist/
const distPath = path.resolve(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // Fallback all navigation routes to index.html
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('*', (_req: Request, res: Response) => {
    res.send('Application built. Please run npm run build to produce dist assets.');
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Celebria AI production server listening on 0.0.0.0:${PORT}`);
});
