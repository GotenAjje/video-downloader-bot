const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Konfigurasi
const TELEGRAM_TOKEN = "7853944509:AAETHjt8CCe9FE0epcXPE14LBj3KM3A7kGY";
const BOT_USERNAME = "@GotenDownlod_bot";
const ADMIN_ID = 7523981926;
const DONASI_LINK = "https://t.me/ModuleGoten/224";
const MAX_LIMIT = 10;

// Inisialisasi bot dan express
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3000;

// Deteksi environment untuk lokasi download
function getDownloadFolder() {
  const androidFolder = "/storage/emulated/0/Download/Telegram";
  if (fs.existsSync(androidFolder)) return androidFolder;
  return "D:\\Users\\Administrator\\source\\repos\\video-downloader";
}
const DOWNLOAD_FOLDER = getDownloadFolder();
if (!fs.existsSync(DOWNLOAD_FOLDER)) fs.mkdirSync(DOWNLOAD_FOLDER, { recursive: true });

// Data user premium & log harian
let premiumUsers = new Set();
let dailyLog = {};
let dailyLimit = {};
let groupLimit = {};
let groupLog = {};
let userSelections = {};

// Load premium dari file jika ada
const PREMIUM_FILE = "premium-users.json";
function savePremium() {
  fs.writeFileSync(PREMIUM_FILE, JSON.stringify([...premiumUsers]), "utf8");
}
function loadPremium() {
  if (fs.existsSync(PREMIUM_FILE)) {
    try {
      premiumUsers = new Set(JSON.parse(fs.readFileSync(PREMIUM_FILE, "utf8")));
    } catch {}
  }
}
loadPremium();

// Reset limit setiap hari
setInterval(() => {
  dailyLog = {};
  dailyLimit = {};
  groupLimit = {};
  groupLog = {};
}, 1000 * 60 * 60 * 24);

// Fungsi log ke admin TANPA SPAM
function logUserToAdmin(user, chat, isGroup) {
  // HANYA log jika benar-benar menggunakan bot (yaitu mengirim link YouTube)
  const idStr = isGroup ? `${chat.id}_${user.id}` : user.id;
  const logObj = isGroup ? groupLog : dailyLog;
  const tanggal = new Date().toISOString().slice(0, 10);

  if (logObj[idStr] !== tanggal) {
    logObj[idStr] = tanggal;
    let info = isGroup
      ? `👥 Grup: ${chat.title || chat.id}\nID Grup: ${chat.id}\nUser: @${user.username || "-"}\nID User: ${user.id}`
      : `🙍‍♂️ User: @${user.username || "-"}\nID User: ${user.id}`;
    bot.sendMessage(ADMIN_ID, `📥 Bot digunakan oleh:\n${info}\nTanggal: ${tanggal}`);
  }
}

// Endpoint Express
app.get("/", (req, res) => {
  res.send(`
    <h2>Server untuk bot Telegram Video Downloader berjalan!</h2>
    <p>
      Jika menemukan bug harap laporkan ke Admin.<br>
      Jika bot tiba-tiba mati, tunggu Admin update saja, mohon bersabar.<br>
      <b>Admin:</b> <a href="https://t.me/gotenbest">https://t.me/gotenbest</a>
    </p>
  `);
});

// Command admin untuk mengatur premium
bot.onText(/^\/addpremium (\d+)$/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const userId = parseInt(match[1]);
  premiumUsers.add(userId);
  savePremium();
  bot.sendMessage(msg.chat.id, `✅ User ID ${userId} sekarang menjadi premium.`);
});
bot.onText(/^\/removepremium (\d+)$/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const userId = parseInt(match[1]);
  premiumUsers.delete(userId);
  savePremium();
  bot.sendMessage(msg.chat.id, `❌ User ID ${userId} dihapus dari premium.`);
});
bot.onText(/^\/listpremium$/, (msg) => {
  if (msg.from.id !== ADMIN_ID) return;
  if (premiumUsers.size === 0) return bot.sendMessage(msg.chat.id, "Belum ada user premium.");
  bot.sendMessage(msg.chat.id, "Daftar user premium:\n" + [...premiumUsers].join("\n"));
});
bot.onText(/^\/resetlimit (\d+)$/, (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  const userId = match[1];
  dailyLimit[userId] = 0;
  bot.sendMessage(msg.chat.id, `Limit user ID ${userId} direset.`);
});

// Welcome & info
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `🇮🇩 *Selamat datang di GoDownload YT!*\n\n` +
    `• Download YouTube *MP3/MP4*, siap putar di Telegram Android, PC, dan web.\n` +
    `• Limit download: *${MAX_LIMIT}x per hari* per user (audio/video).\n\n` +
    `*Ingin unlimited?* Admin bisa tambah premium pakai command:\n` +
    "`/addpremium <user_id>`\n\n" +
    `*Jika menemukan bug harap laporkan ke Admin.*\n*Jika bot tiba-tiba mati, tunggu Admin update saja, mohon bersabar.*\n\nAdmin: @gotenbest`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "👨‍💻 Developer", url: "https://t.me/gotenbest" },
            { text: "💰 Donasi", url: DONASI_LINK },
          ],
        ],
      },
    }
  );
});

// Pesan masuk (deteksi link Youtube)
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";

  if (!text) return;

  if (text.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/)) {
    // Log user ke admin HANYA JIKA mengirim link YouTube
    logUserToAdmin(msg.from, msg.chat, isGroup);

    // Limit check (private)
    if (!isGroup && userId !== ADMIN_ID && !premiumUsers.has(userId)) {
      if (!dailyLimit[userId]) dailyLimit[userId] = 0;
      if (dailyLimit[userId] >= MAX_LIMIT) {
        return bot.sendMessage(chatId,
          `❗️ Limit download harian anda sudah habis (maksimal ${MAX_LIMIT}x/hari).\n\nIngin limit lebih besar? Silakan donasi:\n${DONASI_LINK}`);
      }
    }
    // Limit check (grup)
    if (isGroup && userId !== ADMIN_ID && !premiumUsers.has(userId)) {
      const key = `${chatId}_${userId}`;
      if (!groupLimit[key]) groupLimit[key] = 0;
      if (groupLimit[key] >= MAX_LIMIT) {
        return bot.sendMessage(chatId,
          `❗️ Limit download harian anda di grup ini sudah habis (maksimal ${MAX_LIMIT}x/hari).\n\nIngin limit lebih besar? Silakan donasi:\n${DONASI_LINK}`);
      }
    }

    userSelections[chatId] = { url: text };
    bot.sendMessage(chatId, "🎬 Pilih format unduhan yang kamu mau:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🎥 Video (MP4)", callback_data: "video" },
            { text: "🎵 Audio (MP3)", callback_data: "audio" },
          ],
        ],
      },
    }).then((sentMessage) => {
      userSelections[chatId].formatMessageId = sentMessage.message_id;
      setTimeout(() => {
        bot.deleteMessage(chatId, sentMessage.message_id).catch(() => {});
      }, 10000);
    });
  }
});

// Proses unduhan & increment limit
bot.on("callback_query", (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const format = callbackQuery.data;
  const isGroup = callbackQuery.message.chat.type === "group" || callbackQuery.message.chat.type === "supergroup";

  if (!userSelections[chatId] || !userSelections[chatId].url) {
    bot.sendMessage(chatId, "Harap kirim URL video terlebih dahulu.");
    return;
  }
  const videoUrl = userSelections[chatId].url;

  // Limit check (private)
  if (!isGroup && userId !== ADMIN_ID && !premiumUsers.has(userId)) {
    if (!dailyLimit[userId]) dailyLimit[userId] = 0;
    if (dailyLimit[userId] >= MAX_LIMIT) {
      return bot.sendMessage(chatId,
        `❗️ Limit download harian anda sudah habis (maksimal ${MAX_LIMIT}x/hari).\n\nIngin limit lebih besar? Silakan donasi:\n${DONASI_LINK}`);
    }
  }
  // Limit check (grup)
  if (isGroup && userId !== ADMIN_ID && !premiumUsers.has(userId)) {
    const key = `${chatId}_${userId}`;
    if (!groupLimit[key]) groupLimit[key] = 0;
    if (groupLimit[key] >= MAX_LIMIT) {
      return bot.sendMessage(chatId,
        `❗️ Limit download harian anda di grup ini sudah habis (maksimal ${MAX_LIMIT}x/hari).\n\nIngin limit lebih besar? Silakan donasi:\n${DONASI_LINK}`);
    }
  }

  // Hitung limit setelah sukses
  function updateLimit() {
    if (!isGroup && userId !== ADMIN_ID && !premiumUsers.has(userId)) dailyLimit[userId]++;
    if (isGroup && userId !== ADMIN_ID && !premiumUsers.has(userId)) {
      const key = `${chatId}_${userId}`;
      groupLimit[key]++;
    }
  }
  function getLimitMsg() {
    if (!isGroup && userId !== ADMIN_ID && !premiumUsers.has(userId))
      return `Kamu sudah download ${dailyLimit[userId]}/${MAX_LIMIT} hari ini.`;
    if (isGroup && userId !== ADMIN_ID && !premiumUsers.has(userId)) {
      const key = `${chatId}_${userId}`;
      return `Kamu sudah download ${groupLimit[key]}/${MAX_LIMIT} di grup ini hari ini.`;
    }
    return "Akses premium: tanpa batas!";
  }

  // Fungsi untuk mengirim notifikasi selesai download dan auto hapus setelah 10 detik
  function sendTimedMessage(text) {
    bot.sendMessage(chatId, text).then((sentMsg) => {
      setTimeout(() => {
        bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
      }, 10000);
    });
  }

  // Proses format video/audio
  if (format === "video") {
    bot.sendMessage(chatId, "🔍 Pilih resolusi video yang ingin diunduh:", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "720p", callback_data: "720" },
            { text: "480p", callback_data: "480" },
          ],
          [
            { text: "360p", callback_data: "360" },
            { text: "240p", callback_data: "240" },
          ],
        ],
      },
    }).then((sentMessage) => {
      if (userSelections[chatId].formatMessageId) {
        bot.deleteMessage(chatId, userSelections[chatId].formatMessageId).catch(()=>{});
      }
      userSelections[chatId].resolutionMessageId = sentMessage.message_id;
      setTimeout(() => {
        bot.deleteMessage(chatId, sentMessage.message_id).catch(()=>{});
      }, 10000);
    });
  } else if (format === "audio") {
    bot.sendMessage(chatId, `⏳ Sedang mendownload audio MP3, tunggu sebentar ya...`).then((sentMessage) => {
      if (userSelections[chatId].formatMessageId) {
        bot.deleteMessage(chatId, userSelections[chatId].formatMessageId).catch(()=>{});
      }
      const safeTimestamp = Date.now();
      const outTemplate = path.join(DOWNLOAD_FOLDER, `%(title)s_${safeTimestamp}.mp3`);
      const command = `yt-dlp -f "bestaudio[ext=m4a]/bestaudio" --extract-audio --audio-format mp3 --audio-quality 192K -o "${outTemplate}" "${videoUrl}"`;
      exec(command, (error) => {
        if (error) {
          bot.editMessageText("❌ Gagal mendownload audio. Coba beberapa menit lagi atau cek link YouTube kamu.", {
            chat_id: chatId,
            message_id: sentMessage.message_id,
          });
          return;
        }
        const files = fs.readdirSync(DOWNLOAD_FOLDER)
          .filter((file) => file.endsWith(".mp3"))
          .map((file) => ({
            file,
            time: fs.statSync(path.join(DOWNLOAD_FOLDER, file)).mtime.getTime(),
          }))
          .sort((a, b) => b.time - a.time);
        if (!files.length) {
          bot.editMessageText("❌ Gagal menemukan file audio yang didownload.", {
            chat_id: chatId,
            message_id: sentMessage.message_id,
          });
          return;
        }
        const downloadedFile = files[0].file;
        const filePath = path.join(DOWNLOAD_FOLDER, downloadedFile);
        bot
          .sendAudio(chatId, filePath)
          .then(() => {
            sendTimedMessage(`✅ Download audio selesai! ${getLimitMsg()}`);
            bot.deleteMessage(chatId, sentMessage.message_id).catch(()=>{});
            fs.unlinkSync(filePath);
            updateLimit();
          })
          .catch((err) => {
            bot.editMessageText("❌ Gagal mengirim file ke Telegram.", {
              chat_id: chatId,
              message_id: sentMessage.message_id,
            });
          });
      });
    });
  } else {
    const resolution = format;
    bot.sendMessage(chatId, `⏳ Sedang mendownload video dengan resolusi ${resolution}p, tunggu sebentar ya...`).then((sentMessage) => {
      if (userSelections[chatId].resolutionMessageId) {
        bot.deleteMessage(chatId, userSelections[chatId].resolutionMessageId).catch(()=>{});
      }
      const safeTimestamp = Date.now();
      const outTemplate = path.join(DOWNLOAD_FOLDER, `%(title)s_${safeTimestamp}.mp4`);
      const command = `yt-dlp -f "bestvideo[ext=mp4][height<=${resolution}]+bestaudio[ext=m4a]/best[ext=mp4][height<=${resolution}]" --merge-output-format mp4 -o "${outTemplate}" "${videoUrl}"`;
      exec(command, (error) => {
        if (error) {
          bot.editMessageText("❌ Gagal mendownload video.", {
            chat_id: chatId,
            message_id: sentMessage.message_id,
          });
          return;
        }
        const files = fs.readdirSync(DOWNLOAD_FOLDER)
          .filter((file) => file.endsWith(".mp4"))
          .map((file) => ({
            file,
            time: fs.statSync(path.join(DOWNLOAD_FOLDER, file)).mtime.getTime(),
          }))
          .sort((a, b) => b.time - a.time);
        if (!files.length) {
          bot.editMessageText("❌ Gagal menemukan file video yang didownload.", {
            chat_id: chatId,
            message_id: sentMessage.message_id,
          });
          return;
        }
        const downloadedFile = files[0].file;
        const filePath = path.join(DOWNLOAD_FOLDER, downloadedFile);
        bot
          .sendDocument(chatId, filePath)
          .then(() => {
            sendTimedMessage(`✅ Download video selesai! ${getLimitMsg()}`);
            bot.deleteMessage(chatId, sentMessage.message_id).catch(()=>{});
            fs.unlinkSync(filePath);
            updateLimit();
          })
          .catch((err) => {
            bot.editMessageText("❌ Gagal mengirim file ke Telegram.", {
              chat_id: chatId,
              message_id: sentMessage.message_id,
            });
          });
      });
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Bot Telegram ${BOT_USERNAME} berhasil dijalankan.`);
});