import { config } from "dotenv";
config();

import fetch from "node-fetch";
import { XMLParser } from "fast-xml-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";
import cron from "node-cron";

// Fungsi utama — ini yang akan dijalankan setiap hari jam 8 pagi
async function jalankanPipeline() {
  console.log("Pipeline mulai:", new Date().toLocaleString("id-ID"));

  // Fetch data
  const res = await fetch("https://www.coindesk.com/arc/outboundfeeds/rss/");
  const xml = await res.text();

  // Parse XML ke JSON
  const parser = new XMLParser();
  const json = parser.parse(xml);
  const articles = json.rss.channel.item.slice(0, 5);
  const headlines = articles.map(a => a.title).join("\n");

  // Kirim ke AI
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(
    `Ini headline crypto hari ini:\n${headlines}\n\nBuat summary singkat dalam Bahasa Indonesia, apa yang perlu diperhatikan investor hari ini.`
  );

  console.log("\n=== ANALISIS AI ===\n");
  console.log(result.response.text());
}

// Scheduler — jalankan setiap hari jam 8 pagi
// Format: "menit jam * * *"
cron.schedule("0 8 * * *", jalankanPipeline);

console.log("Scheduler aktif. Pipeline akan jalan setiap hari jam 08:00.");

// Untuk testing — jalankan sekali sekarang tanpa nunggu jam 8
jalankanPipeline();

// Fungsi retry — coba maksimal 3 kali kalau gagal
async function callGeminiWithRetry(model, prompt, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result;
    } catch (err) {
      console.log(`Percobaan ${i + 1} gagal: ${err.message}`);
      if (i < maxRetries - 1) {
        console.log("Tunggu 10 detik, coba lagi...");
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  }
  throw new Error("Gemini gagal setelah 3 percobaan");
}

// Ganti baris ini:
// const result = await model.generateContent(...)
// Jadi:
const result = await callGeminiWithRetry(model,
  `Ini headline crypto hari ini:\n${headlines}\n\nBuat summary singkat dalam Bahasa Indonesia, apa yang perlu diperhatikan investor hari ini.`
);