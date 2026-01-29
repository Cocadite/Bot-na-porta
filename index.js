const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require("discord.js");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

const API_BASE = (process.env.API_BASE || "").replace(/\/$/, "");
const API_KEY = process.env.API_KEY || "";
const POLL_MS = Number(process.env.POLL_MS || 25000);

if (!BOT_TOKEN) throw new Error("Faltou BOT_TOKEN no .env");
if (!GUILD_ID) throw new Error("Faltou GUILD_ID no .env");
if (!ROLE_ID) throw new Error("Faltou ROLE_ID no .env");
if (!LOG_CHANNEL_ID) throw new Error("Faltou LOG_CHANNEL_ID no .env");
if (!API_BASE) throw new Error("Faltou API_BASE no .env");
if (!API_KEY) throw new Error("Faltou API_KEY no .env");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember],
});

let running = false;

async function api(path, opts = {}) {
  const url = API_BASE + path;
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + API_KEY,
    ...(opts.headers || {}),
  };

  const res = await fetch(url, { ...opts, headers });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function safeStr(v) {
  return (v === null || v === undefined) ? "" : String(v);
}

async function logToChannel(embed) {
  const guild = await client.guilds.fetch(GUILD_ID);
  const ch = await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
  if (!ch || !ch.isTextBased()) return;
  await ch.send({ embeds: [embed] });
}

async function approveLoop() {
  if (running) return;
  running = true;

  try {
    const guild = await client.guilds.fetch(GUILD_ID);
    await guild.members.fetch({ withPresences: false }).catch(() => null);

    const data = await api("/bot/approved", { method: "GET" });
    const items = Array.isArray(data.items) ? data.items : [];

    for (const item of items) {
      const formId = safeStr(item.id);
      const userId = safeStr(item.userId || item.discordId || item.discord_id || item.memberId);
      const discordTag = safeStr(item.discordTag);
      const nick = safeStr(item.nick);
      const idade = item.idade;
      const token = safeStr(item.token);

      if (!formId) continue;

      if (!userId) {
        const embed = new EmbedBuilder()
          .setTitle("⚠️ Aprovado sem userId (não dá pra dar cargo)")
          .setDescription("O formulário aprovado veio **sem ID do Discord**. Ajuste o form/API pra mandar `userId`.")
          .addFields(
            { name: "Form ID", value: formId, inline: true },
            { name: "Nick", value: nick || "—", inline: true },
            { name: "Token", value: token || "—", inline: true },
          )
          .setTimestamp(new Date());
        await logToChannel(embed);
        continue;
      }

      let ok = false;
      let errMsg = "";

      try {
        const member = await guild.members.fetch(userId);
        await member.roles.add(ROLE_ID, "Aprovado no painel (API)");
        ok = true;
      } catch (e) {
        errMsg = (e && e.message) ? e.message : String(e);
      }

      if (ok) {
        const embed = new EmbedBuilder()
          .setTitle("✅ Aprovado no painel — cargo aplicado")
          .setDescription(`Cargo aplicado em <@${userId}>`)
          .addFields(
            { name: "Discord", value: discordTag || `<@${userId}>`, inline: true },
            { name: "Nick", value: nick || "—", inline: true },
            { name: "Idade", value: (idade === undefined || idade === null) ? "—" : String(idade), inline: true },
            { name: "Form ID", value: formId, inline: true },
          )
          .setFooter({ text: "É Os Pé Na Porta • Bot" })
          .setTimestamp(new Date());
        await logToChannel(embed);

        await api("/bot/mark-done", {
          method: "POST",
          body: JSON.stringify({ id: formId }),
        });
      } else {
        const embed = new EmbedBuilder()
          .setTitle("❌ Falha ao aplicar cargo")
          .setDescription(`Não consegui aplicar o cargo em <@${userId}>`)
          .addFields(
            { name: "Erro", value: (errMsg || "—").slice(0, 900) },
            { name: "Form ID", value: formId, inline: true },
            { name: "Nick", value: nick || "—", inline: true },
          )
          .setTimestamp(new Date());
        await logToChannel(embed);
        // NÃO marca done, pra poder re-tentar depois
      }
    }
  } catch (e) {
    console.error("[loop] erro:", e);
  } finally {
    running = false;
  }
}

client.once("ready", async () => {
  console.log(`✅ Logado como ${client.user.tag}`);
  console.log("🔁 Loop de aprovados ativo. Intervalo:", POLL_MS, "ms");
  await approveLoop();
  setInterval(approveLoop, Math.max(8000, POLL_MS));
});

client.login(BOT_TOKEN);
