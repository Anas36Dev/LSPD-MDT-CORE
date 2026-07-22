/**
 * Rattache un identifiant Discord à un compte agent, et récupère au passage
 * son pseudo et sa photo de profil via le bot.
 *
 * Utilitaire temporaire : cette opération se fera depuis le module
 * « Gestion des comptes » une fois la phase 1 bis livrée.
 *
 *   node scripts/link-discord.mjs prenom.nom@lspd.core 123456789012345678
 *
 * Pour trouver un identifiant Discord : Paramètres → Avancés → Mode
 * développeur, puis clic droit sur la personne → Copier l'identifiant.
 */
import "dotenv/config";
import mariadb from "mariadb/promise.js";

const [email, discordId] = process.argv.slice(2);

if (!email || !discordId) {
  console.error(
    "Usage : node scripts/link-discord.mjs <email@lspd.core> <idDiscord>",
  );
  process.exit(1);
}

if (!/^\d{17,20}$/.test(discordId)) {
  console.error(
    `"${discordId}" n'est pas un identifiant Discord valide (17 à 20 chiffres).`,
  );
  process.exit(1);
}

const conn = await mariadb.createConnection({
  host: "localhost",
  user: "root",
  database: "lspd_mdt",
});

const [user] = await conn.query(
  "SELECT id, firstName, lastName FROM User WHERE email = ?",
  [email],
);
if (!user) {
  console.error("Agent introuvable :", email);
  await conn.end();
  process.exit(1);
}

// Un identifiant Discord ne peut être rattaché qu'à un seul agent : sinon,
// deux comptes deviendraient accessibles depuis le même Discord.
const [taken] = await conn.query(
  "SELECT email FROM User WHERE discordId = ? AND id <> ?",
  [discordId, user.id],
);
if (taken) {
  console.error(`Cet identifiant Discord est déjà utilisé par ${taken.email}.`);
  await conn.end();
  process.exit(1);
}

// Récupération du profil via le bot, si le token est configuré.
let username = null;
let avatarUrl = null;
const token = process.env.DISCORD_BOT_TOKEN;

if (token) {
  const res = await fetch(`https://discord.com/api/v10/users/${discordId}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (res.ok) {
    const d = await res.json();
    username = d.global_name ?? d.username;
    avatarUrl = d.avatar
      ? `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.${d.avatar.startsWith("a_") ? "gif" : "png"}?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(d.id) >> 22n) % 6n)}.png`;
  } else {
    console.warn(
      `⚠️  Le bot n'a pas pu lire ce profil (HTTP ${res.status}). Le rattachement est fait quand même ; l'avatar sera récupéré à la première connexion Discord.`,
    );
  }
} else {
  console.warn(
    "⚠️  DISCORD_BOT_TOKEN absent : l'avatar sera récupéré à la première connexion Discord.",
  );
}

await conn.query(
  "UPDATE User SET discordId = ?, discordUsername = COALESCE(?, discordUsername), discordAvatarUrl = COALESCE(?, discordAvatarUrl) WHERE id = ?",
  [discordId, username, avatarUrl, user.id],
);

console.log(`✅ ${user.firstName} ${user.lastName} (${email})`);
console.log(`   Discord ID : ${discordId}`);
if (username) console.log(`   Pseudo     : ${username}`);
if (avatarUrl) console.log(`   Avatar     : récupéré`);
console.log(`\nCet agent peut désormais utiliser « Se connecter avec Discord ».`);

await conn.end();
