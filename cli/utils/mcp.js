// Minimal MCP (Model Context Protocol) stdio client — zero dependencies
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const MCP_FILE = path.join(os.homedir(), '.stew', 'mcp.json');

function mcpConfig() {
  try { return JSON.parse(fs.readFileSync(MCP_FILE, 'utf8')); } catch (e) { return {}; }
}

function saveMcpConfig(cfg) {
  fs.mkdirSync(path.dirname(MCP_FILE), { recursive: true });
  fs.writeFileSync(MCP_FILE, JSON.stringify(cfg, null, 2));
}

function addServer(name, command) {
  var cfg = mcpConfig();
  cfg[name] = { command: command };
  saveMcpConfig(cfg);
  return 'Added "' + name + '": ' + command;
}

function removeServer(name) {
  var cfg = mcpConfig();
  if (!cfg[name]) return 'No MCP server named "' + name + '"';
  delete cfg[name];
  saveMcpConfig(cfg);
  return 'Removed MCP server "' + name + '"';
}

// One JSON-RPC session over stdio
function rpc(proc, method, params, timeoutMs) {
  return new Promise(function (resolve, reject) {
    var cmd = proc.command.split(' ');
    var child = spawn(cmd[0], cmd.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
    var buf = '';
    var timer = setTimeout(function () { child.kill(); reject(new Error('MCP timeout (' + (timeoutMs / 1000) + 's)')); }, timeoutMs || 20000);
    child.stdout.on('data', function (d) {
      buf += d;
      var lines = buf.split('\n');
      buf = lines.pop();
      for (var ln of lines) {
        ln = ln.trim();
        if (!ln) continue;
        var msg;
        try { msg = JSON.parse(ln); } catch (e) { continue; }
        if (msg.id === 1) {
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
          child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: method, params: params || {} }) + '\n');
        } else if (msg.id === 2) {
          clearTimeout(timer);
          child.kill();
          if (msg.error) reject(new Error(msg.error.message || 'MCP error'));
          else resolve(msg.result);
        }
      }
    });
    child.on('error', function (e) { clearTimeout(timer); reject(e); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'stew-ai', version: '1.0.0' } } }) + '\n');
  });
}

function listTools(name) {
  var cfg = mcpConfig();
  if (!cfg[name]) return Promise.reject(new Error('No MCP server named "' + name + '"'));
  return rpc(cfg[name], 'tools/list').then(function (r) { return (r && r.tools) || []; });
}

function callTool(name, tool, args) {
  var cfg = mcpConfig();
  if (!cfg[name]) return Promise.reject(new Error('No MCP server named "' + name + '"'));
  return rpc(cfg[name], 'tools/call', { name: tool, arguments: args || {} }).then(function (r) {
    var text = '';
    if (r && r.content) for (var ci = 0; ci < r.content.length; ci++) text += (r.content[ci].type === 'text' ? r.content[ci].text : '') + '\n';
    return { ok: !(r && r.isError), output: (text || JSON.stringify(r)).trim().slice(0, 3000) };
  });
}

module.exports = { mcpConfig, addServer, removeServer, listTools, callTool };
