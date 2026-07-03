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

  if (message.content === '!players') {
    try {
      const data = await status(SERVER_IP, SERVER_PORT);
      if (data.players.online > 0) {
        message.reply(`👥 Jugadores conectados (${data.players.online}): ${data.players.sample.map(p => p.name).join(', ')}`);
      } else {
        message.reply("👥 El servidor está en línea pero vacío.");
      }
    } catch (err) {
      console.error("Error al obtener jugadores:", err);
      message.reply("⚠️ El servidor parece apagado.");
    }
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
