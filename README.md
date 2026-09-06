# AutoDeploy Cloud Engine v4.0

Multi-Framework CI/CD & AutoDeploy Web Platform supporting **Laravel**, **Next.js**, and **PHP Native**.

---

## 🚀 Fitur Utama

### 1. Multi-Framework AutoDeploy & AutoBuild
- **Laravel**: `composer install`, `php artisan key:generate`, `php artisan migrate --force`, `php artisan storage:link`, cache clearing, Nginx FastCGI pass ke socket PHP-FPM (`/tmp/php-cgi-83.sock`).
- **Next.js**: deteksi package manager (`npm`/`pnpm`/`yarn`), dependency install, `next build`, runner process daemon / PM2 pada port teralokasi, Nginx reverse-proxy dengan WebSocket headers.
- **PHP Native**: Docroot synchronization, PHP-FPM fastcgi pass.

### 2. GitHub Webhook Integration (Autobuild on Git Push)
- Endpoint: `POST /api/webhook/github`
- Validasi HMAC SHA-256 (`X-Hub-Signature-256`) dengan secret token per-repo.
- Otomatis memicu autobuild & deploy saat developer melakukan `git push origin <branch>`.
- UI dilengkapi **Simulator Git Push** untuk pengujian langsung tanpa perlu push nyata ke GitHub.

### 3. Queue Mutex & Freeze Countdown Screen
- Jika deploy/autobuild sedang berjalan dan ada push/deploy baru yang masuk:
  - Job dimasukkan ke dalam antrian terurut.
  - Tampilan Web otomatis menampilkan **Freeze Overlay / Lock Screen** dengan backdrop-blur.
  - Memperlihatkan **Circular Countdown Gauge & Timer (Anime.js)** dengan estimasi waktu tersisa.
  - Step-by-step progress pipeline tracker (6 tahap).
  - Posisi antrian (Queue #1, #2...) dan estimasi waktu tunggu kumulatif.

### 4. .env Manager (Web Editor + File Upload)
- **Raw Code Editor**: Textarea bersyntax monospace untuk edit cepat.
- **Key-Value Form Editor**: Form interaktif dengan tombol toggle visibilitas password (eye icon) dan validasi.
- **Drag & Drop / Upload File `.env`**: Upload file `.env` lokal langsung dari komputer ke server.
- **Auto-Inject Snippet**: Tombol 1-klik untuk menyisipkan konfigurasi MariaDB atau PostgreSQL ke `.env`.
- Backup otomatis `.env.backup.<timestamp>` sebelum penyimpanan file baru.

### 5. Server Database Provisioning (MariaDB & PostgreSQL)
- **MariaDB / MySQL**: `CREATE DATABASE`, `CREATE USER`, `GRANT ALL PRIVILEGES` di port 3306.
- **PostgreSQL**: `CREATE DATABASE`, `CREATE USER`, `GRANT ALL PRIVILEGES ON DATABASE` di port 5432.
- Auto-generate connection string (`DATABASE_URL`) untuk framework modern seperti Prisma/Next.js/Drizzle.

### 6. Desain DevOps Modern (Anti-Gaya AI)
- Obsidian dark-mode terinspirasi dari Vercel, Railway, dan Cloudflare.
- Bebas icon generik AI (tanpa sparkle ✨, tanpa bot 🤖, tanpa magic wand). Menggunakan icon sistem asli (Git, Terminal, Database, Server, Clock, Lock).
- Mikro-animasi menggunakan **Anime.js** dan **Framer Motion**.
- Real-time ANSI Terminal streamer via Server-Sent Events (SSE).

---

## 🛠️ Menjalankan Sistem Secara Lokal / Produksi

```bash
# Install dependensi
npm install

# Menjalankan Backend API & Worker Server (Port 4000)
npm run dev:server

# Menjalankan Frontend Web Dashboard (Port 5173)
npm run dev:client

# Menjalankan Keduanya Bersamaan
npm run dev
```

Dashboard dapat diakses di: **http://localhost:5173** (atau port server produksi Anda).
