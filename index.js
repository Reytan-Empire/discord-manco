// index.js - Bot Discord con ping robusto a servidor Minecraft
// Requisitos: npm install discord.js minecraft-server-util express
// Opcional para pruebas locales: npm install dotenv y crear un .env con TOKEN=tu_token

// Si usas .env para pruebas locales, descomenta la siguiente línea:
// require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { status } = require('minecraft-server-util');
const express = require('express');

// --- Configuración --- (ajusta según tu servidor y canal)
const SERVER_IP = 'LosManqueados.aternos.me';
const SERVER_PORT = 16905;
const CHANNEL_ID = '1470534215140638940';

// Intervalo de chequeo automático (ms)
const CHECK_INTERVAL = 30000; // 30s, sube a 45-60s si hay mucho flapping

// Umbrales para evitar flapping
const FAIL_THRESHOLD = 3;     // pings fallidos seguidos para marcar offline
const SUCCESS_THRESHOLD = 2;  // éxitos seguidos para marcar online (sube a 3 si es necesario)

// --- Cliente Discord ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// --- Estado y contadores ---
let lastStatus = null; // 'online' | 'offline' | null
let lastOnlineAt = null;
let lastPingData = null;
let failCount = 0;
let successCount = 0;

// --- Utilidad: detectar respuestas "falsas" de hosts que devuelven MOTD offline ---
function isValidOnlineResponse(data) {
  if (!data) return false;

  // players.online debe ser número
  if (!data.players || typeof data.players.online !== 'number') return false;

  // Si el protocolo es negativo suele indicar respuesta "offline" del host
  if (data.version && typeof data.version.protocol === 'number' && data.version.protocol < 0) {
    return false;
  }

  // Revisar motd por palabras clave típicas de "server offline"
  const motdRaw = (data.motd && (data.motd.clean || data.motd.raw || '')).toString().toLowerCase();
  if (motdRaw.includes('offline') || motdRaw.includes('this server is offline')) {
    return false;
  }

  // Si pasa todas las comprobaciones, consideramos la respuesta válida
  return true;
}

// --- Función de chequeo robusta ---
async function checkServer() {
  try {
    const data = await status(SERVER_IP, SERVER_PORT);
    console.debug('checkServer: raw data:', JSON.stringify(data));

    const valid = isValidOnlineResponse(data);

    if (!valid) {
      console.debug('checkServer: respuesta inválida o indica offline, contando como fallo');
      failCount++;
      successCount = 0;
    } else {
      lastPingData = data;
      successCount++;
      failCount = 0;
    }

    // Marcar online solo tras SUCCESS_THRESHOLD éxitos seguidos
    if (successCount >= SUCCESS_THRESHOLD && lastStatus !== 'online') {
      lastStatus = 'online';
      lastOnlineAt = Date.now();
      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        const onlineCount = lastPingData?.players?.online ?? 0;
        await channel.send(`@everyone ✅ El servidor está en línea (${onlineCount} jugadores).`);
        console.log('Notificado: servidor ONLINE');
      } catch (e) {
        console.error('checkServer: no pude notificar online:', e);
      }
    }

    // Marcar offline solo tras FAIL_THRESHOLD fallos seguidos
    if (failCount >= FAIL_THRESHOLD && lastStatus !== 'offline') {
      lastStatus = 'offline';
      lastPingData = null;
      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        await channel.send('@everyone ❌ El servidor se apagó.');
        console.log('Notificado: servidor OFFLINE');
      } catch (e) {
        console.error('checkServer: no pude notificar offline:', e);
      }
    }
  } catch (err) {
    // Excepción de la librería -> contar como fallo
    console.error('checkServer: Ping fallido (excepción):', err);
    failCount++;
    successCount = 0;

    if (failCount >= FAIL_THRESHOLD && lastStatus !== 'offline') {
      lastStatus = 'offline';
      lastPingData = null;
      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        await channel.send('@everyone ❌ El servidor se apagó.');
        console.log('Notificado (catch): servidor OFFLINE');
      } catch (e) {
        console.error('checkServer: no pude notificar offline (catch):', e);
      }
    }
  }
}

// --- Eventos Discord ---
client.once('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
  // Primer chequeo inmediato y luego intervalos
  checkServer();
  setInterval(checkServer, CHECK_INTERVAL);
});

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const content = message.content.trim();

  if (content === '!ping') {
    return message.reply('Pong!');
  }

  if (content === '!ip') {
    return message.reply(`La IP del servidor es: ${SERVER_IP}:${SERVER_PORT}`);
  }

  if (content === '!players') {
    try {
      const data = await status(SERVER_IP, SERVER_PORT);
      console.debug('!players: raw data:', JSON.stringify(data));

      if (!isValidOnlineResponse(data)) {
        console.debug('!players: datos inválidos o indican offline, respondiendo offline');
        return message.reply('❌ El servidor no está en línea.');
      }

      const onlineCount = data.players.online;
      if (onlineCount > 0) {
        const sample = data.players.sample || [];
        const names = sample.map(p => p.name).join(', ');
        const listText = names ? `: ${names}` : '';
        return message.reply(`👥 Jugadores conectados (${onlineCount})${listText}`);
      } else {
        return message.reply('👥 El servidor está en línea pero no hay jugadores conectados.');
      }
    } catch (err) {
      console.error('!players: Ping fallido (excepción):', err);
      return message.reply('❌ El servidor no está en línea.');
    }
  }

  if (content === '!uptime') {
    if (lastStatus === 'offline' || !lastOnlineAt) {
      return message.reply('❌ El servidor no está en línea actualmente.');
    }
    const ms = Date.now() - lastOnlineAt;
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));

    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return message.reply(`⏱️ Uptime desde que se detectó online: ${parts.join(' ')}`);
  }
});

// --- Login ---
// En producción usa process.env.TOKEN
// Para pruebas locales puedes exportar TOKEN en la terminal o usar .env (no subir a Git)
const token = process.env.TOKEN;
if (!token) {
  console.warn('Aviso: process.env.TOKEN no está definido. Para pruebas locales exporta TOKEN o usa .env con dotenv.');
}
client.login(token).catch(err => {
  console.error('Error al iniciar sesión en Discord:', err);
  process.exit(1);
});

// --- Express para mantener el proceso vivo en plataformas como Railway ---
const app = express();
app.get('/', (req, res) => res.send('Bot funcionando 🚀'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor web activo en puerto ${PORT}`));
