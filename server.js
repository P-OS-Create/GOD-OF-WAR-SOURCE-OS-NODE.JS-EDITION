const WebSocket = require('ws');
const ccxt = require('ccxt');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const PORT = process.env.PORT || 3001;
const wss = new WebSocket.Server({ port: PORT });

let totalWealth = 0;
const toolStatus = {
  crypto: 'IDLE',
  trader: 'STANDBY',
  nft: 'READY'
};

const clients = new Set();
const sessions = new Map();

function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function getToolPayload() {
  return {
    type: 'tool_status',
    crypto: toolStatus.crypto,
    trader: toolStatus.trader,
    nft: toolStatus.nft
  };
}

async function createBinanceClient() {
  try {
    const config = {};
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET) {
      config.apiKey = process.env.BINANCE_API_KEY;
      config.secret = process.env.BINANCE_API_SECRET;
    }
    return new ccxt.binance(config);
  } catch (error) {
    console.warn('[server] Binance client creation failed:', error.message);
    return null;
  }
}

async function fetchMarketStatus() {
  const binance = await createBinanceClient();
  if (!binance) return;
  try {
    const ticker = await binance.fetchTicker('BTC/USDT');
    toolStatus.crypto = `BTC $${Number(ticker.last).toFixed(2)}`;
    toolStatus.trader = 'ACTIVE';
  } catch (error) {
    toolStatus.crypto = 'MARKET UNAVAILABLE';
    toolStatus.trader = 'STANDBY';
  }
}

async function fetchNFTStatus() {
  if (!process.env.OPENSEA_API_KEY) {
    toolStatus.nft = 'READY';
    return;
  }
  try {
    const res = await axios.get('https://api.opensea.io/api/v1/collections?offset=0&limit=1', {
      headers: { 'X-API-KEY': process.env.OPENSEA_API_KEY }
    });
    toolStatus.nft = 'CONNECTED';
  } catch (error) {
    toolStatus.nft = 'READY';
  }
}

function spawnBackendSoul() {
  const soulId = `BACKEND_SOUL_${Date.now()}`;
  const missions = [
    'Reconcile crypto flow',
    'Mint battle artifact',
    'Analyze market sentiment',
    'Launch compute swarm',
    'Sync to OpenSea',
    'Signal auto-trader'
  ];
  const mission = missions[Math.floor(Math.random() * missions.length)];
  broadcast({ type: 'soul_spawn', soulId, mission });
  console.log('[server] Spawned backend soul:', soulId, mission);
}

function updateWealth(amount) {
  totalWealth = Number((totalWealth + amount).toFixed(2));
  broadcast({ type: 'wealth_update', totalWealth });
}

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('[server] WebSocket client connected. Total clients:', clients.size);
  send(ws, { type: 'welcome', message: 'Source OS backend online.' });
  send(ws, getToolPayload());
  send(ws, { type: 'wealth_update', totalWealth });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'init') {
        sessions.set(data.sessionId, { game: data.game, startedAt: Date.now() });
        console.log('[server] Session init:', data.sessionId, data.game);
      }
      if (data.type === 'wealth') {
        updateWealth(data.amount || 0);
        console.log('[server] Wealth event:', data.amount, data.action, data.target);
      }
      if (data.type === 'soul_complete') {
        updateWealth(data.value || 0);
        console.log('[server] Soul complete:', data.soulId, data.mission, data.value);
      }
    } catch (error) {
      console.warn('[server] Invalid WS message:', error.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('[server] Client disconnected. Remaining clients:', clients.size);
  });
});

wss.on('listening', () => {
  console.log(`🔌 Full Stack Tools Backend running on ws://localhost:${PORT}`);
});

setInterval(async () => {
  await fetchMarketStatus();
  await fetchNFTStatus();
  broadcast(getToolPayload());
}, 15000);

setInterval(() => {
  spawnBackendSoul();
}, 20000);

setInterval(() => {
  updateWealth(0.15);
}, 25000);
