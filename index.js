// index.js - Ping directo con minecraft-server-util y manejo correcto de !players
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { status } = require('minecraft-server-util');
const express = require('express');

const SERVER_IP = "LosManqueados.aternos.me";
const SERVER_PORT = 16905;
const CHANNEL_ID = "1470534215140638940";
const CHECK_INTERVAL = 30000; // milisegundos

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

let lastStatus = null; // "online" | "offline" | null
let lastOnlineAt = null; // timestamp cuando se detectó online por última vez
let lastPingData = null; // guarda la última respuesta válida de status()

async function checkServer() {
  try {
    const data = await status(SERVER_IP, SERVER_PORT);
    lastPingData = data;
    console.log('Ping directo OK:', data);

    if (data.players && data.players.online > 0) {
      if (lastStatus !== 'online') {
        const channel = await client.channels.fetch(CHANNEL_ID);
        channel.send(`@everyone ✅ El servidor está en línea con ${data.players.online} jugadores.`);
      }
      lastStatus = 'online';
      lastOnlineAt = Date.now();
    } else {
      // Responde correctamente pero sin jugadores
      if (lastStatus !== 'online') {
        // Si antes estaba offline y ahora responde pero sin jugadores, lo marcamos online
        const channel = await client.channels.fetch(CHANNEL_ID);
        channel.send(`@everyone ✅ El servidor está en línea pero sin jugadores.`);
      }
      lastStatus = 'online';
      lastOnlineAt = Date.now();
    }
  } catch (err) {
    console.error('Ping directo falló:', err);
    // Si falla el ping, consideramos el servidor apagado
    if (lastStatus !== 'offline') {
      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        channel.send('@everyone ❌ El servidor se apagó.');
      } catch (e) {
        console.error('No se pudo notificar en el canal:', e);
      }
    }
    lastStatus = 'offline';
    lastPingData = null;
  }
}

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
    // Intentamos ping directo en el momento del comando
    try {
      const data = await status(SERVER_IP, SERVER_PORT);
      // Guardamos la última respuesta válida
      lastPingData = data;
      lastStatus = 'online';
      lastOnlineAt = lastOnlineAt || Date.now();

      const onlineCount = data?.players?.online ?? 0;

      if (onlineCount > 0) {
        const sample = data.players.sample || [];
        const names = sample.map(p => p.name).join(', ');
        const listText = names ? `: ${names}` : '';
        return message.reply(`👥 Jugadores conectados (${onlineCount})${listText}`);
      } else {
        return message.reply('👥 El servidor está en línea pero no hay jugadores conectados.');
      }
    } catch (err) {
      console.error('Ping fallido en !players:', err);
      // Si falla el ping, respondemos que el servidor no está en línea
      lastStatus = 'offline';
      lastPingData = null;
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

// Login con TOKEN en variables de entorno
client.login(process.env.TOKEN).catch(err => {
  console.error('Error al iniciar sesión en Discord:', err);
});

// Express para mantener el proceso vivo en plataformas como Railway
const app = express();
app.get('/', (req, res) => res.send('Bot funcionando 🚀'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor web activo en puerto ${PORT}`));
