# 🏭 Konveksi Tracker — Production Management System

MVP web app untuk tracking produksi konveksi. Built with Node.js + Express + SQLite + Vanilla JS.

---

## 📁 STRUKTUR FOLDER

```
konveksi-tracker/
├── backend/
│   ├── db/
│   │   ├── database.js     ← Schema SQLite + init DB
│   │   └── seed.js         ← Data dummy (users, orders, logs)
│   ├── middleware/
│   │   └── auth.js         ← JWT verify + role guard
│   ├── routes/
│   │   ├── auth.js         ← POST /login, GET /me
│   │   ├── orders.js       ← CRUD orders
│   │   ├── production.js   ← Input log + validasi tahap
│   │   ├── dashboard.js    ← Stats + report
│   │   └── users.js        ← CRUD users (superadmin)
│   ├── server.js           ← Entry point Express
│   └── package.json
├── frontend/
│   └── index.html          ← Single Page App (HTML + Tailwind + JS)
└── README.md
```

---

## 🚀 CARA MENJALANKAN

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Jalankan Seed (data dummy)

```bash
npm run seed
```

### 3. Start Server

```bash
# Production
npm start

# Development (auto-restart)
npm run dev
```

### 4. Buka di Browser

```
http://localhost:3000
```

---

## 🔑 LOGIN CREDENTIALS

| Role       | Email                        | Password      |
|------------|------------------------------|---------------|
| Superadmin | superadmin@konveksi.com      | admin123      |
| Admin      | admin@konveksi.com           | admin123      |
| Operator   | siti@konveksi.com            | operator123   |
| Operator   | andi@konveksi.com            | operator123   |

---

## 📋 API ENDPOINTS

### Auth
| Method | Endpoint         | Akses  | Deskripsi        |
|--------|-----------------|--------|-----------------|
| POST   | /api/auth/login | Public | Login           |
| GET    | /api/auth/me    | Auth   | Info user aktif |

### Orders
| Method | Endpoint         | Akses         | Deskripsi       |
|--------|-----------------|---------------|-----------------|
| GET    | /api/orders      | All           | List semua order|
| GET    | /api/orders/:id  | All           | Detail + logs   |
| POST   | /api/orders      | Admin+        | Buat order baru |
| PUT    | /api/orders/:id  | Admin+        | Edit order      |
| DELETE | /api/orders/:id  | Superadmin    | Hapus order     |

### Production Logs
| Method | Endpoint            | Akses      | Deskripsi          |
|--------|--------------------|-----------|--------------------|
| GET    | /api/production     | All        | List log produksi  |
| POST   | /api/production     | All        | Input log baru     |
| DELETE | /api/production/:id | Superadmin | Hapus log          |

### Dashboard & Report
| Method | Endpoint                         | Akses | Deskripsi              |
|--------|----------------------------------|-------|------------------------|
| GET    | /api/dashboard                   | All   | Stats + active orders  |
| GET    | /api/dashboard/report?period=... | All   | daily/weekly/monthly   |

### Users (Superadmin only)
| Method | Endpoint       | Deskripsi    |
|--------|---------------|--------------|
| GET    | /api/users     | List users   |
| POST   | /api/users     | Tambah user  |
| PUT    | /api/users/:id | Edit user    |
| DELETE | /api/users/:id | Hapus user   |

---

## ✅ VALIDASI SISTEM

| Kondisi                    | Response                             |
|----------------------------|--------------------------------------|
| Qty Keluar > Qty Masuk     | 400: Error dengan pesan jelas        |
| Tahap tidak urut / skip    | 400: Tampilkan tahap yang benar      |
| Order baru bukan Potong    | 400: Harus mulai dari Potong         |
| Order sudah di Gudang      | Status otomatis → Selesai            |
| Token expired              | 401: Redirect ke login               |
| Role tidak sesuai          | 403: Access denied                   |

---

## 🔄 FLOW PENGGUNAAN HARIAN

```
ADMIN — Pagi:
  1. Login → Dashboard (lihat status semua order)
  2. Orders → Tambah order baru jika ada

OPERATOR — Saat barang pindah tahap:
  1. Login → Input Produksi
  2. Pilih order dari dropdown
  3. Sistem auto-suggest tahap berikutnya
  4. Isi Qty Masuk & Qty Keluar
  5. Simpan → muncul di log terbaru

ADMIN/SUPERADMIN — Monitoring:
  1. Dashboard → lihat progress semua order visual
  2. Report → export / lihat summary harian/mingguan/bulanan
  3. Orders → klik "Detail" untuk lihat timeline tahap
```

---

## 🔧 ENVIRONMENT VARIABLES (OPSIONAL)

Buat file `.env` di folder `backend/`:

```
PORT=3000
JWT_SECRET=ganti-dengan-secret-kuat-anda
```

---

## 📦 TECH STACK

- **Backend**: Node.js + Express 4
- **Database**: SQLite via better-sqlite3 (file: `backend/db/konveksi.db`)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Frontend**: HTML + TailwindCSS CDN + Vanilla JS (Single Page App)
- **Font**: IBM Plex Sans + IBM Plex Mono

---

## 🔮 NEXT STEPS (Scale Up)

- [ ] Export report ke Excel/PDF
- [ ] Notifikasi WhatsApp/Telegram saat order selesai
- [ ] Dashboard chart (Chart.js)
- [ ] Multi-pabrik / cabang
- [ ] Migrate ke PostgreSQL saat skala besar
- [ ] Deploy ke VPS/Railway/Render
