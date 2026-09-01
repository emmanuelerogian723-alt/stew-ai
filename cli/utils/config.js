const fs = require('fs');
const path = require('path');
const os = require('os');

const configDir = path.join(os.homedir(), '.stew');
const configFile = path.join(configDir, 'config.json');

function ensureConfigDir() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

function getConfig() {
  try {
    if (fs.existsSync(configFile)) {
      return JSON.parse(fs.readFileSync(configFile, 'utf8'));
    }
  } catch (e) {
  }
  return { apiKey: '' };
}

function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

function getApiKey() {
  if (process.env.STEW_API_KEY) return process.env.STEW_API_KEY;
  const config = getConfig();
  return config.apiKey || '';
}

function setApiKey(apiKey) {
  const config = getConfig();
  config.apiKey = apiKey;
  saveConfig(config);
}

function clearApiKey() {
  if (fs.existsSync(configFile)) {
    fs.unlinkSync(configFile);
  }
}

module.exports = { getConfig, saveConfig, getApiKey, setApiKey, clearApiKey, configDir };
