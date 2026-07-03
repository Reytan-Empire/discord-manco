const { Client, GatewayIntentBits, Partials } = require('discord.js');
const fetch = require('node-fetch');
const express = require('express');

// ⚙️ Configura estos valores:
const SERVER_IP = "LosManqueados.aternos.me"; 
const SERVER_PORT = "16905"; 
const CHANNEL_ID = "1470534215140638940"; 
const CHECK_INTERVAL = 30000; // 30 segundos

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

// Función para consultar el estado del server
async function checkServer() {
  try {
    const res = await fetch(`https://api.mcstatus.io/v2/status/java/${SERVER_IP}:${SERVER_PORT}`);
    const data = await res.json();
    const channel = await client.channels.fetch(CHANNEL_ID);

    if (data.online === true) {
      // Online con jugadores
      if (data.players && data.players.online > 0 && lastStatus !== "online") {
        channel.send(`@everyone ✅ El servidor está en línea con ${data.players.online} jugadores.`);
        lastStatus = "online";
      }
      // Online con 0 jugadores → no mandar nada
    } else {
      // Offline real
      if (lastStatus !== "offline") {
        channel.send("@everyone ❌ El servidor se apagó.");
        lastStatus = "offline";
      }
    }
  } catch (err) {
    console.error("Error al consultar mcstatus.io:", err);
  }
}

client.once('clientReady', () => {
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
      const res = await fetch(`https://api.mcstatus.io/v2/status/java/${SERVER_IP}:${SERVER_PORT}`);
      const data = await res.json();

      if (data.online === true) {
        if (data.players && data.players.online > 0) {
          if (data.players.list && data.players.list.length > 0) {
            message.reply(`👥 Jugadores conectados (${data.players.online}): ${data.players.list.map(p => p.name).join(', ')}`);
          } else {
            message.reply(`👥 El servidor está en línea con ${data.players.online} jugadores.`);
          }
        } else {
          // Online con 0 jugadores → no responder nada
        }
      } else {
        message.reply(`❌ El servidor está apagado.`);
      }
    } catch (err) {
      console.error("Error al consultar jugadores:", err);
      message.reply("⚠️ No pude obtener la lista de jugadores.");
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
