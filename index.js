const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { status } = require('minecraft-server-util');
const express = require('express');

const SERVER_IP = "LosManqueados.aternos.me";
const SERVER_PORT = 16905; // número, no string
const CHANNEL_ID = "1470534215140638940";
const CHECK_INTERVAL = 30000; // cada 30 segundos

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

let lastStatus = null;

async function checkServer() {
  try {
    const data = await status(SERVER_IP, SERVER_PORT);
    const channel = await client.channels.fetch(CHANNEL_ID);

    console.log("Ping directo:", data);

    if (data.players.online > 0) {
      if (lastStatus !== "online") {
        channel.send(`@everyone ✅ El servidor está en línea con ${data.players.online} jugadores.`);
        lastStatus = "online";
      }
    } else if (data.players.online === 0) {
      // online vacío → no mandar nada
    }
  } catch (err) {
    console.error("Error al hacer ping:", err);
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (lastStatus !== "offline") {
      channel.send("@everyone ❌ El servidor se apagó.");
      lastStatus = "offline";
    }
  }
}

client.once('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
  setInterval(checkServer, CHECK_INTERVAL);
});

client.on('messageCreate', async message => {
  if (message.content === '!ping') {
    message.reply('Pong!');
  }

  if (message.content === '!ip') {
    message.reply(`La IP del servidor es: ${SERVER_IP}:${SERVER_PORT}`);
  }

// dentro de client.on('messageCreate', async message => { ... })
if (message.content === '!players') {
  try {
    // Intentamos un ping directo ahora mismo
    const data = await status(SERVER_IP, SERVER_PORT);

    // Si la llamada tuvo éxito, data.players.online es número
    const onlineCount = data?.players?.online ?? 0;

    if (onlineCount > 0) {
      // Si hay jugadores, listarlos (si sample existe)
      const names = (data.players.sample || []).map(p => p.name).join(', ');
      const listText = names ? `: ${names}` : '';
      message.reply(`👥 Jugadores conectados (${onlineCount})${listText}`);
    } else {
      // Llamada exitosa pero sin jugadores conectados
      message.reply('👥 El servidor está en línea pero no hay jugadores conectados.');
    }
  } catch (err) {
    // Si status lanza error (no responde), consideramos el servidor apagado
    console.error('Ping fallido en !players:', err);
    message.reply('❌ El servidor no está en línea.');
  }
});

client.login(process.env.TOKEN);

const app = express();
app.get('/', (req, res) => {
  res.send('Bot funcionando 🚀');
});
app.listen(3000, () => {
  console.log('Servidor web activo en puerto 3000');
});
