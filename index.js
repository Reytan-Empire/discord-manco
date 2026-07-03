const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ⚙️ Configura estos valores:
const SERVER_IP = "LosManqueados.aternos.me:16905"; // IP de tu server
const SERVER_PORT = "16905"; // Puerto (si aplica)
const CHANNEL_ID = "1470534215140638940"; // canal donde quieres los avisos
const CHECK_INTERVAL = 30000; // 30 segundos

let lastStatus = null; // Guardamos el estado anterior

async function checkServer() {
    try {
        const res = await fetch(`https://api.mcstatus.io/v2/status/java/${SERVER_IP}:${SERVER_PORT}`);
        const data = await res.json();

        const channel = await client.channels.fetch(CHANNEL_ID);

        if (data.online && lastStatus !== "online") {
            channel.send(`✅ El servidor está en línea con ${data.players.online} jugadores.`);
            lastStatus = "online";
        } else if (!data.online && lastStatus !== "offline") {
            channel.send("❌ El servidor se apagó.");
            lastStatus = "offline";
        }
        // Si el estado no cambió, no manda nada
    } catch (err) {
        console.error("Error al consultar mcstatus.io:", err);
    }
}

client.once('ready', () => {
    console.log(`Bot iniciado como ${client.user.tag}`);
    // Ejecuta cada 30 segundos
    setInterval(checkServer, CHECK_INTERVAL);
});

client.login(process.env.TOKEN);

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot funcionando 🚀');
});

app.listen(3000, () => {
  console.log('Servidor web activo en puerto 3000');
});
