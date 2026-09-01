/**
 * Session persistence for Stew Code — saves/loads conversations locally.
 * Zero dependency — uses fs only.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const sessionDir = path.join(os.homedir(), '.stew', 'sessions');

function ensureSessionDir() {
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
}

function saveSession(name, messages, meta = {}) {
  ensureSessionDir();
  const filename = name.replace(/[^a-zA-Z0-9-_]/g, '_') + '.json';
  const filepath = path.join(sessionDir, filename);
  const data = {
    name,
    messages,
    meta: { ...meta, savedAt: new Date().toISOString() },
  };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  return filepath;
}

function loadSession(name) {
  const filename = name.replace(/[^a-zA-Z0-9-_]/g, '_') + '.json';
  const filepath = path.join(sessionDir, filename);
  if (!fs.existsSync(filepath)) return null;
  const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  return data;
}

function listSessions() {
  ensureSessionDir();
  const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(sessionDir, f), 'utf8'));
      return {
        name: data.name || f.replace('.json', ''),
        messages: data.messages?.length || 0,
        savedAt: data.meta?.savedAt || '',
      };
    } catch {
      return { name: f.replace('.json', ''), messages: 0, savedAt: '' };
    }
  });
}

function deleteSession(name) {
  const filename = name.replace(/[^a-zA-Z0-9-_]/g, '_') + '.json';
  const filepath = path.join(sessionDir, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
    return true;
  }
  return false;
}

module.exports = { saveSession, loadSession, listSessions, deleteSession, sessionDir };
