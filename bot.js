const TelegramBot = require("node-telegram-bot-api");
const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Token API Telegram
const TELEGRAM_TOKEN = "7853944509:AAETHjt8CCe9FE0epcXPE14LBj3KM3A7kGY";
const BOT_USERNAME = "@GotenDownlod_bot"; // Ganti dengan username bot kamu

// Inisialisasi bot Telegram
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Inisialisasi Express.js
const app = express();
const PORT = process.env.PORT || 3000;

// Folder untuk menyimpan video
const DOWNLOAD_FOLDER = "/storage/emulated/0/Download/Telegram/vdan";

// Buat folder download jika belum ada
if (!fs.existsSync(DOWNLOAD_FOLDER)) {
  fs.mkdirSync(DOWNLOAD_FOLDER, { recursive: true });
  console.log(`Folder 'vdan' berhasil dibuat di ${DOWNLOAD_FOLDER}`);
} else {
  console.log(`Folder 'vdan' sudah ada di ${DOWNLOAD_FOLDER}`);
}

// Objek untuk menyimpan URL dan jenis unduhan sementara
const userSelections = {};

// Endpoint untuk mengecek server Express.js
app.get("/", (req, res) => {
  res.send("Server untuk bot Telegram Video Downloader berjalan!");
});

// Perintah Telegram untuk memulai bot
bot.onText(/\/start/, (msg) => {
  console.log(`Pesan '/start' diterima dari pengguna @${msg.chat.username || "tidak diketahui"}`);
  bot.sendMessage(
    msg.chat.id,
    `🇮🇩 *Selamat datang di GoDownload YT!* 🎥\n\n🚀 Kirim link YouTube favoritmu, dan Gue akan bantu kamu download jadi *MP4 (Video)* atau *MP3 (Audio)*. Simpel dan cepat! Boss 😎`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "👨‍💻 Developer", url: "https://t.me/gotenbest" },
            { text: "💰 Donasi", url: "https://t.me/ModuleGoten/224" },
          ],
        ],
      },
    }
  );
});

// Auto-deteksi link YouTube di grup atau privat chat
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Abaikan jika pesan bukan teks
  if (!text) return;

  console.log(`Pesan diterima dari @${msg.chat.username || "tidak diketahui"}: ${text}`);

  // Periksa apakah teks adalah URL YouTube
  if (text.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/)) {
    userSelections[chatId] = { url: text };

    // Kirim menu pilihan jenis unduhan
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
      userSelections[chatId].formatMessageId = sentMessage.message_id; // Simpan ID pesan
    });
  }
});

// Menangani pilihan format unduhan
bot.on("callback_query", (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const format = callbackQuery.data;

  console.log(`Format dipilih oleh @${callbackQuery.from.username || "tidak diketahui"}: ${format}`);

  // Periksa apakah pengguna telah memberikan URL sebelumnya
  if (!userSelections[chatId] || !userSelections[chatId].url) {
    bot.sendMessage(chatId, "Harap kirim URL video terlebih dahulu.");
    return;
  }

  const videoUrl = userSelections[chatId].url;

  // Jika format adalah video, tampilkan menu resolusi
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
        bot.deleteMessage(chatId, userSelections[chatId].formatMessageId); // Hapus pesan format
      }
      userSelections[chatId].resolutionMessageId = sentMessage.message_id; // Simpan ID pesan
    });
  } else if (format === "audio") {
    // Format audio MP3
    bot.sendMessage(chatId, `⏳ Sedang mendownload audio MP3, tunggu sebentar ya...`).then((sentMessage) => {
      if (userSelections[chatId].formatMessageId) {
        bot.deleteMessage(chatId, userSelections[chatId].formatMessageId); // Hapus pesan format
      }
      console.log(`Memulai unduhan audio MP3 untuk URL: ${videoUrl}`);

      const command = `yt-dlp -f 'bestaudio[ext=m4a]/bestaudio' --extract-audio --audio-format mp3 -o "${DOWNLOAD_FOLDER}/%(title)s.%(ext)s" ${videoUrl}`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error("Error downloading audio:", error);
          bot.editMessageText("❌ Gagal mendownload audio.", {
            chat_id: chatId,
            message_id: sentMessage.message_id,
          });
          return;
        }

        console.log("Download selesai:", stdout);

        // Cari file hasil download
        const files = fs.readdirSync(DOWNLOAD_FOLDER);
        const downloadedFile = files.find((file) => file.endsWith(".mp3")); // Ambil file dengan format MP3

        if (!downloadedFile) {
          bot.editMessageText("❌ Gagal menemukan file yang didownload.", {
            chat_id: chatId,
            message_id: sentMessage.message_id,
          });
          return;
        }

        const filePath = path.join(DOWNLOAD_FOLDER, downloadedFile);

        // Kirim file ke Telegram
        bot
          .sendDocument(chatId, filePath)
          .then(() => {
            console.log(
              `Audio berhasil dikirim ke @${callbackQuery.from.username || "tidak diketahui"}: ${downloadedFile}`
            );
            bot.deleteMessage(chatId, sentMessage.message_id); // Hapus pesan status
            // Hapus file setelah dikirim untuk menghemat ruang
            fs.unlinkSync(filePath);
            console.log(`File ${downloadedFile} telah dihapus dari folder 'vdan'`);
          })
          .catch((err) => {
            console.error("Error sending file:", err);
            bot.editMessageText("❌ Gagal mengirim file.", {
              chat_id: chatId,
              message_id: sentMessage.message_id,
            });
          });
      });
    });
  } else {
    // Jika format adalah resolusi video
    const resolution = format;
    bot.sendMessage(chatId, `⏳ Sedang mendownload video dengan resolusi ${resolution}p, tunggu sebentar ya...`).then((sentMessage) => {
      if (userSelections[chatId].resolutionMessageId) {
        bot.deleteMessage(chatId, userSelections[chatId].resolutionMessageId); // Hapus pesan resolusi
      }
      console.log(`Memulai unduhan video untuk URL: ${videoUrl} dengan resolusi ${resolution}p`);

      const command = `yt-dlp -f 'bestvideo[ext=mp4][height<=${resolution}]+bestaudio[ext=m4a]/best[ext=mp4][height<=${resolution}]' --merge-output-format mp4 -o "${DOWNLOAD_FOLDER}/%(title)s.%(ext)s" ${videoUrl}`;

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error("Error downloading video:", error);
          bot.editMessageText("❌ Gagal mendownload video.", {
            chat_id: chatId,
            message_id: sentMessage.message_id,
          });
          return;
        }

        console.log("Download selesai:", stdout);

        // Cari file hasil download
        const files = fs.readdirSync(DOWNLOAD_FOLDER);
        const downloadedFile = files.find((file) => file.endsWith(".mp4")); // Ambil file dengan format MP4

        if (!downloadedFile) {
          bot.editMessageText("❌ Gagal menemukan file yang didownload.", {
            chat_id: chatId,
            message_id: sentMessage.message_id,
          });
          return;
        }

        const filePath = path.join(DOWNLOAD_FOLDER, downloadedFile);

        // Kirim file ke Telegram
        bot
          .sendDocument(chatId, filePath)
          .then(() => {
            console.log(
              `Video berhasil dikirim ke @${callbackQuery.from.username || "tidak diketahui"}: ${downloadedFile}`
            );
            bot.deleteMessage(chatId, sentMessage.message_id); // Hapus pesan status
            // Hapus file setelah dikirim untuk menghemat ruang
            fs.unlinkSync(filePath);
            console.log(`File ${downloadedFile} telah dihapus dari folder 'vdan'`);
          })
          .catch((err) => {
            console.error("Error sending file:", err);
            bot.editMessageText("❌ Gagal mengirim file.", {
              chat_id: chatId,
              message_id: sentMessage.message_id,
            });
          });
      });
    });
  }
});

// Jalankan server Express.js
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
  console.log(`Bot Telegram ${BOT_USERNAME} berhasil dijalankan.`);
});