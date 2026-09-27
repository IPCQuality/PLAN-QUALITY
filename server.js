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
app.post('/api/history/save', async (req, res) => {
  try {
    const { payload, fileName } = req.body;
    if (!payload || !fileName) {
      return res.status(400).json({ success: false, error: 'Payload dan fileName wajib diisi' });
    }

    const cleanFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!cleanFileName.endsWith('.json')) {
      return res.status(400).json({ success: false, error: 'Format berkas harus berupa .json' });
    }

    const historyDir = path.join(__dirname, 'history');
    await fs.promises.mkdir(historyDir, { recursive: true });

    const filePath = path.join(historyDir, cleanFileName);
    await fs.promises.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');

    return res.json({ success: true, fileName: cleanFileName });
  } catch (err) {
    console.error('Error saving history:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API List History endpoint (asynchronous non-blocking reads directly from /history folder)
app.get('/api/history/list', async (req, res) => {
  try {
    const historyDir = path.join(__dirname, 'history');
    if (!fs.existsSync(historyDir)) {
      return res.json({ success: true, files: [], items: [] });
    }
    const dirEntries = await fs.promises.readdir(historyDir);
    const files = dirEntries
      .filter(f => f.endsWith('.json') && f !== 'manifest.json' && f !== 'learning_data.json')
      .sort((a, b) => b.localeCompare(a));

    const items = await Promise.all(
      files.map(async file => {
        try {
          const filePath = path.join(historyDir, file);
          const content = await fs.promises.readFile(filePath, 'utf8');
          const json = JSON.parse(content);
          const meta = json.meta || {};

          const match = file.match(/^planning-(\d{4}-\d{2}-\d{2})-shift(\d+)\.json$/);
          const date = meta.date || (match ? match[1] : '');
          const shift = meta.shift !== undefined ? meta.shift : (match ? parseInt(match[2], 10) : 1);
          const totalCqi = meta.total_cqi || (Array.isArray(json.planning) ? json.planning.length : 0);
          const totalMachines = meta.total_machines_running || (Array.isArray(json.planning) ? json.planning.reduce((acc, slot) => acc + ((slot.machines || []).length), 0) : 0);
          const totalCore = meta.total_core !== undefined ? meta.total_core : (Array.isArray(json.planning) ? json.planning.filter(s => s.core && s.core !== '-').length : 0);
          const totalNonCore = meta.total_non_core !== undefined ? meta.total_non_core : (Array.isArray(json.planning) ? json.planning.reduce((acc, s) => acc + ((s.non_core || []).length), 0) : 0);
          const totalLongshift = meta.total_longshift !== undefined ? meta.total_longshift : (Array.isArray(json.planning) ? json.planning.reduce((acc, s) => acc + ((s.longshift || []).length), 0) : 0);

          const special = json.special_assignments || {};

          return {
            fileName: file,
            date,
            shift,
            totalCqi,
            totalMachines,
            totalCore,
            totalNonCore,
            totalLongshift,
            specialAssignments: {
              qcPassedCount: Array.isArray(special.qc_passed) ? special.qc_passed.length : 0,
              milStd: special.mil_std || '',
              supportFg: special.support_fg || ''
            },
            generatedAt: meta.generated_at || null
          };
        } catch (err) {
          return {
            fileName: file,
            date: '',
            shift: 1,
            totalCqi: 0,
            totalMachines: 0,
            totalCore: 0,
            totalNonCore: 0,
            totalLongshift: 0,
            specialAssignments: { qcPassedCount: 0, milStd: '', supportFg: '' },
            generatedAt: null
          };
        }
      })
    );

    return res.json({ success: true, files, items });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// API Delete History endpoint
app.post('/api/history/delete', async (req, res) => {
  try {
    const { fileName, shift } = req.body;
    const historyDir = path.join(__dirname, 'history');
    if (!fs.existsSync(historyDir)) {
      return res.json({ success: true, deleted: [] });
    }

    const deleted = [];
    if (fileName) {
      const cleanFileName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '');
      const filePath = path.join(historyDir, cleanFileName);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        deleted.push(cleanFileName);
      }
    } else if (shift !== undefined) {
      const shiftPattern = `-shift${shift}.json`;
      const allFiles = await fs.promises.readdir(historyDir);
      const files = allFiles.filter(f => f.endsWith(shiftPattern));
      for (const f of files) {
        await fs.promises.unlink(path.join(historyDir, f));
        deleted.push(f);
      }
    }

    return res.json({ success: true, deleted });
  } catch (err) {
    console.error('Error deleting history:', err);
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
