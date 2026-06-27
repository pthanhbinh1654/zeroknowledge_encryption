# 🔐 Zero-Knowledge File Encryption System

> **Đồ án niên luận ngành** — Hệ thống mã hóa tệp tin Zero-Knowledge kháng lượng tử  
> Trường Đại học Mở Thành phố Hồ Chí Minh · Khoa Công nghệ Thông tin · CT492

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](docker-compose.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.116-009688?logo=fastapi)](backend/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](frontend/)

---

## 📖 Tổng quan

Hệ thống mã hóa tệp tin theo mô hình **Zero-Knowledge**: server **không bao giờ** nhìn thấy dữ liệu gốc, khóa mã hóa, hay mật khẩu người dùng. Toàn bộ quá trình mã hóa/giải mã diễn ra **hoàn toàn phía trình duyệt** (client-side).

### Vấn đề giải quyết

| Vấn đề | Giải pháp |
|--------|-----------|
| Lưu trữ file trên cloud bị lộ khi server bị hack | Mã hóa AES-256-GCM tại browser trước khi upload |
| Khóa mã hóa bị lộ khi truyền qua mạng | Khóa chỉ tồn tại trong bộ nhớ browser, không truyền lên server |
| Chữ ký số dễ bị giả mạo trong tương lai | Hỗ trợ Dilithium3/5 (post-quantum digital signature) |
| Trao đổi khóa không an toàn | Hybrid encryption X25519 + Kyber1024 (post-quantum KEM) |

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER (Client)                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React + TypeScript                                   │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │ Web Crypto  │  │ libsodium.js │  │@noble/pq   │  │   │
│  │  │ AES-256-GCM │  │ Ed25519, X25 │  │ Kyber1024  │  │   │
│  │  │ ChaCha20    │  │ 519, BLAKE2b │  │ Dilithium  │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────┘  │   │
│  │         ↑ Mã hóa xảy ra ở đây - KHÔNG lên server    │   │
│  └──────────────────────────────────────────────────────┘   │
│           │ Upload: chỉ ciphertext + metadata               │
└───────────┼─────────────────────────────────────────────────┘
            │ HTTPS
┌───────────┼─────────────────────────────────────────────────┐
│           │         SERVER (Docker Compose)                  │
│  ┌────────▼──────┐  ┌───────────┐  ┌────────────────────┐  │
│  │  FastAPI 0.116│  │  MongoDB  │  │  MinIO (S3)        │  │
│  │  Python 3.11  │  │  Metadata │  │  Encrypted files   │  │
│  │  JWT + Argon2 │  │  only     │  │  (ciphertext only) │  │
│  └───────────────┘  └───────────┘  └────────────────────┘  │
│   Server KHÔNG có plaintext, keys, hay passwords            │
└─────────────────────────────────────────────────────────────┘
```

### Stack công nghệ

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | React 18 · TypeScript · Vite · Material-UI · Tailwind CSS |
| **Mã hóa** | Web Crypto API · libsodium.js · @noble/ciphers · @noble/post-quantum |
| **Backend** | FastAPI 0.116 · Python 3.11 · Uvicorn |
| **Database** | MongoDB 6.0 (chỉ metadata) |
| **File Storage** | MinIO S3-compatible (chỉ ciphertext) |
| **Auth** | JWT · Argon2id · OTP email · hCaptcha |
| **Container** | Docker · Docker Compose |

---

## ✨ Tính năng chính

### Mã hóa
- **Đơn tệp** — AES-256-GCM, ChaCha20-Poly1305, XChaCha20-Poly1305
- **Nhiều tệp** — Batch mã hóa song song
- **Thư mục** — Nén ZIP → mã hóa → giữ nguyên cấu trúc khi giải mã
- **Tệp lớn** — Streaming theo chunks (>50MB)
- **Hybrid Encryption** — X25519/Kyber1024 key encapsulation
- **Chữ ký số** — Ed25519 + Dilithium3/5 (post-quantum)

### Bảo mật
- Zero-Knowledge: server không biết gì về nội dung
- 2FA qua OTP email
- hCaptcha chống brute-force
- Rate limiting & account lockout
- Security audit logs

### Quản lý
- Dashboard phân tích thống kê
- Quản lý tệp tin đã mã hóa
- Export offline (portable encrypted packages)
- Light/Dark theme

---

## 🚀 Cài đặt và chạy bằng Docker

### Yêu cầu
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ≥ 24.0
- 4GB RAM trống (cho MongoDB + MinIO + backend + frontend)

### Các bước

**1. Clone repository**
```bash
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>
```

**2. Cấu hình môi trường**
```bash
cp .env.example .env
```

Mở file `.env` và điền các giá trị bắt buộc:

```env
# Bắt buộc phải thay đổi:
SECRET_KEY=<tạo bằng: python -c "import secrets; print(secrets.token_hex(32))">
MONGO_ROOT_PASSWORD=<mật khẩu mạnh>
MINIO_ACCESS_KEY=<tên đăng nhập MinIO>
MINIO_SECRET_KEY=<mật khẩu MinIO, ≥8 ký tự>
SMTP_USERNAME=<email Gmail của bạn>
SMTP_PASSWORD=<App Password của Gmail>
FROM_EMAIL=<email Gmail của bạn>
```

> 💡 **Gmail App Password**: Vào [Google Account → Security → App passwords](https://myaccount.google.com/apppasswords) để tạo. Không dùng mật khẩu đăng nhập Gmail thông thường.

**3. Khởi động**
```bash
docker compose up -d
```

Docker sẽ tự động:
- Build image cho frontend và backend
- Pull image MongoDB và MinIO
- Tạo volumes lưu dữ liệu bền vững
- Khởi động tất cả services

**4. Kiểm tra hoạt động**
```bash
docker compose ps          # Xem trạng thái các services
docker compose logs -f     # Xem logs realtime
```

**5. Truy cập ứng dụng**

| Service | URL |
|---------|-----|
| 🌐 Frontend | http://localhost:3000 |
| ⚙️ Backend API | http://localhost:8000 |
| 📚 API Docs (Swagger) | http://localhost:8000/docs |
| 🗄️ MinIO Console | http://localhost:9001 |

**6. Dừng ứng dụng**
```bash
docker compose down           # Dừng, giữ dữ liệu
docker compose down -v        # Dừng, XÓA dữ liệu (reset hoàn toàn)
```

---

## 🛠️ Phát triển cục bộ (không dùng Docker)

<details>
<summary>Xem hướng dẫn phát triển không dùng Docker</summary>

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example .env      # Cấu hình .env
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # Cấu hình .env.local
npm run dev                  # Chạy trên http://localhost:5173
```

### Dịch vụ ngoài (cần chạy riêng)
```bash
# MongoDB
docker run -d -p 27017:27017 --name mongo mongo:6.0

# MinIO
docker run -d -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin \
  minio/minio server /data --console-address ":9001"
```

</details>

---

## 📁 Cấu trúc dự án

```
.
├── backend/                    # FastAPI backend
│   ├── main.py                 # Entry point, router registration
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile
│   ├── app/
│   │   ├── api/                # HTTP route handlers
│   │   │   ├── auth.py         # Đăng ký, đăng nhập, OTP, reset password
│   │   │   ├── encrypted_file.py  # Upload/download/quản lý file mã hóa
│   │   │   ├── crypto.py       # Hỗ trợ thao tác mật mã
│   │   │   ├── security.py     # Audit logs, security events
│   │   │   ├── analytics.py    # Thống kê và phân tích
│   │   │   ├── dashboard.py    # Dashboard data
│   │   │   ├── activity.py     # Lịch sử hoạt động
│   │   │   └── user.py         # Quản lý profile người dùng
│   │   ├── core/
│   │   │   ├── config.py       # Cấu hình ứng dụng (pydantic-settings)
│   │   │   ├── security.py     # JWT, Argon2id, password hashing
│   │   │   └── minio_client.py # Kết nối MinIO S3
│   │   ├── models/             # Pydantic models (request/response schemas)
│   │   ├── services/           # Business logic layer
│   │   │   ├── auth_service.py / user_service.py
│   │   │   ├── email_service.py / otp_service.py
│   │   │   ├── encrypted_file_service.py
│   │   │   ├── crypto_service.py
│   │   │   ├── security_service.py / session_service.py
│   │   │   ├── activity_service.py / analytics_service.py
│   │   │   ├── captcha_service.py / storage_service.py
│   │   │   └── performance.py
│   │   ├── utils/
│   │   └── database.py         # MongoDB connection
│   └── scripts/
│       ├── setup_db.py         # Tạo indexes MongoDB
│       └── setup_minio.py      # Tạo bucket MinIO
│
├── frontend/                   # React + TypeScript frontend
│   ├── src/
│   │   ├── main.tsx            # Entry point
│   │   ├── App.tsx             # Router setup
│   │   ├── pages/              # Các trang chính
│   │   │   ├── LoginPage.tsx / RegisterPage.tsx
│   │   │   ├── EncryptPage.tsx / DecryptPage.tsx
│   │   │   ├── AdvancedEncryptPage.tsx
│   │   │   ├── HybridEncryptPage.tsx
│   │   │   ├── FilesPage.tsx / Dashboard.tsx
│   │   │   └── ...
│   │   ├── crypto/             # ⭐ Logic mã hóa client-side
│   │   │   ├── zero_knowledge.ts      # AES-GCM, ChaCha20, Argon2id
│   │   │   ├── advanced_features.ts   # Hybrid, post-quantum
│   │   │   └── chunked_encryption.ts  # Streaming cho file lớn
│   │   ├── components/         # UI components tái sử dụng
│   │   ├── services/           # API call wrappers
│   │   ├── contexts/           # React Context (Auth, Theme)
│   │   ├── types/              # TypeScript type definitions
│   │   └── config/env.ts       # Biến môi trường frontend
│   ├── nginx.conf              # Nginx config cho production
│   ├── Dockerfile
│   └── .env.example
│
├── docs/                       # Tài liệu kỹ thuật
│   ├── API_DOCUMENTATION.md    # REST API reference
│   ├── SECURITY_GUIDE.md       # Kiến trúc bảo mật
│   ├── DEPLOYMENT_GUIDE.md     # Hướng dẫn deploy production
│   └── SYSTEM-OVERVIEW.md      # Tổng quan hệ thống
│
├── scripts/
│   ├── deploy.sh               # Bash script tự động hóa deployment
│   └── mongo-init.js           # Khởi tạo MongoDB indexes
│
├── docker-compose.yml          # Orchestration cho tất cả services
├── .env.example                # Template biến môi trường
└── .gitignore
```

---

## 🔑 Hướng dẫn sử dụng cơ bản

### Mã hóa tệp tin
1. Đăng ký tài khoản → xác thực email OTP
2. Đăng nhập → vào trang **Encrypt**
3. Kéo-thả tệp vào vùng upload
4. Chọn thuật toán mã hóa (khuyến nghị: AES-256-GCM)
5. Nhập mật khẩu mã hóa (lưu lại cẩn thận — server KHÔNG lưu)
6. Nhấn **Encrypt & Upload** → tệp được mã hóa tại browser, chỉ ciphertext lên server

### Giải mã tệp tin
1. Vào trang **Files** → chọn tệp cần giải mã
2. Hoặc vào **Decrypt** → upload tệp `.encrypted`
3. Nhập đúng mật khẩu đã dùng khi mã hóa
4. Tệp được giải mã tại browser → tải về máy

> ⚠️ **Quan trọng**: Nếu quên mật khẩu mã hóa, **KHÔNG THỂ khôi phục** dữ liệu — đây là bản chất của Zero-Knowledge.

---

## 🧪 Kiểm thử

```bash
# Frontend tests
cd frontend
npm run test          # Chạy tất cả tests
npm run test:run      # One-time run (không watch)

# Backend tests  
cd backend
pytest -v             # Chạy với verbose output
pytest --cov=app      # Kèm coverage report
```

---

## 🌐 API Overview

API documentation đầy đủ tại: `http://localhost:8000/docs` (khi đang chạy)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/register` | Đăng ký tài khoản |
| POST | `/api/auth/login` | Đăng nhập, nhận JWT |
| POST | `/api/auth/verify-otp` | Xác thực OTP email |
| POST | `/api/encrypted/upload` | Upload file đã mã hóa |
| GET | `/api/encrypted/list` | Danh sách file của user |
| GET | `/api/encrypted/download/{id}` | Download ciphertext |
| DELETE | `/api/encrypted/{id}` | Xóa file |
| GET | `/api/security/audit-logs` | Xem audit logs |
| GET | `/api/analytics/advanced` | Thống kê nâng cao |
| GET | `/health` | Health check |

---

## 📚 Tài liệu

| Tài liệu | Nội dung |
|----------|----------|
| [API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md) | Tài liệu REST API đầy đủ |
| [SECURITY_GUIDE.md](docs/SECURITY_GUIDE.md) | Kiến trúc Zero-Knowledge, threat model |
| [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) | Deploy production với SSL |
| [SYSTEM-OVERVIEW.md](docs/SYSTEM-OVERVIEW.md) | Tổng quan kiến trúc hệ thống |

---

## 🔒 Lưu ý bảo mật

- **Không commit file `.env`** — chứa secret keys thật
- File `SMTP_PASSWORD` là Gmail App Password — không phải mật khẩu Gmail thông thường
- Trong production: đổi tất cả default passwords trong `.env`
- `SECRET_KEY` phải là chuỗi ngẫu nhiên 32+ bytes: `python -c "import secrets; print(secrets.token_hex(32))"`

---

## 📄 Giấy phép

MIT License — xem [LICENSE](LICENSE)

---

## 👤 Tác giả

Đồ án niên luận ngành CT492 — Trường Đại học Mở TP.HCM

---

> ⚠️ **Disclaimer**: Đây là đồ án học thuật. Trước khi sử dụng trong môi trường production thực tế, cần thực hiện kiểm thử bảo mật chuyên sâu (penetration testing).
