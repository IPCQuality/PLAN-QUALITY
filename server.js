import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API Save History endpoint
app.post('/api/history/save', (req, res) => {
  try {
    const { payload, fileName } = req.body;
    if (!payload || !fileName) {
      return res.status(400).json({ success: false, error: 'Payload dan fileName wajib diisi' });
    }

    const historyDir = path.join(__dirname, 'history');
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }

    const cleanFileName = path.basename(fileName);
    const filePath = path.join(historyDir, cleanFileName);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');

    return res.json({ success: true, fileName: cleanFileName });
  } catch (err) {
    console.error('Error saving history:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API List History endpoint (reads directly from /history folder planning-*.json)
app.get('/api/history/list', (req, res) => {
  try {
    const historyDir = path.join(__dirname, 'history');
    if (!fs.existsSync(historyDir)) {
      return res.json({ success: true, files: [] });
    }
    const files = fs.readdirSync(historyDir)
      .filter(f => f.endsWith('.json') && f !== 'manifest.json' && f !== 'learning_data.json')
      .sort((a, b) => b.localeCompare(a));
    return res.json({ success: true, files });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Serve history static folder
app.use('/history', express.static(path.join(__dirname, 'history')));

// PWA static assets and Service Worker
app.use('/pwa', express.static(path.join(__dirname, 'pwa'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Backward-compatible routes for PWA assets located in /pwa
app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(__dirname, 'pwa', 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'pwa', 'sw.js'));
});

app.get('/apple-touch-icon.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'pwa', 'icons', 'apple-touch-icon.png'));
});

app.get(['/pwa-192x192.png', '/pwa-512x512.png', '/pwa-maskable-512x512.png'], (req, res) => {
  const iconName = path.basename(req.path);
  res.sendFile(path.join(__dirname, 'pwa', 'icons', iconName));
});

// Serve static assets with extension handling
app.use(express.static(__dirname, {
  extensions: ['html', 'htm'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Explicit route for config page
app.get('/config', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'config.html'));
});

// Catch-all SPA / static fallback
app.get('*', (req, res) => {
  // If request has a file extension (e.g. .js, .css, .json, .png), return 404 instead of HTML
  const ext = path.extname(req.path);
  if (ext && ext !== '.html' && ext !== '.htm') {
    res.status(404).send('Not found');
    return;
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
