# Matching Wealth - HR & Project Management System

ระบบจัดการพนักงานและโครงการสำหรับ Matching Wealth Co., Ltd.

## การติดตั้ง

### 1. Clone & Install

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
npm install
```

### 2. ตั้งค่า Environment Variables

คัดลอก `.env.example` เป็น `.env.local` แล้วกรอกค่า:

```bash
cp .env.example .env.local
```

#### GitHub (สำหรับ PIN Storage)
1. สร้าง Personal Access Token ที่ https://github.com/settings/tokens
   - ต้องมี permission: `repo` (Full control of private repositories)
2. กรอกค่าใน `.env.local`:
   - `GITHUB_TOKEN` = Personal Access Token
   - `GITHUB_OWNER` = GitHub username
   - `GITHUB_REPO` = ชื่อ repo
   - `GITHUB_PINS_PATH` = `data/pins.json`

**สำคัญ**: Push ไฟล์ `data/pins.json` ขึ้น repo ก่อน deploy

#### Google Drive (สำหรับเก็บข้อมูลใบสมัคร) — OAuth2
1. สร้าง OAuth 2.0 Client ID (ประเภท Web/Desktop) ที่ Google Cloud Console
2. เปิด Google Drive API
3. ขอ Refresh Token ด้วย OAuth Playground หรือสคริปต์ของคุณ (scope: `https://www.googleapis.com/auth/drive`)
4. กรอกค่าใน `.env.local`:
   - `GOOGLE_CLIENT_ID` = Client ID
   - `GOOGLE_CLIENT_SECRET` = Client Secret
   - `GOOGLE_REFRESH_TOKEN` = Refresh Token
   - `GOOGLE_DRIVE_FOLDER_ID` = `1N-LFC6F_Bv0zpJoGaw1S0EEuQhIZSIcU`

> ไฟล์แนบ (รูป/เรซูเม่/สำเนาบัตร) จะถูกเก็บแบบ **ไม่เปิดสาธารณะ** และเสิร์ฟผ่าน `/api/files` ที่ต้องล็อกอินเป็น admin เท่านั้น

#### Security (จำเป็น)
- `PIN_SECRET` = คีย์ลับสำหรับเซ็น session cookie (HMAC) — **ต้องตั้งค่าใน production** และเก็บเป็นความลับ ถ้าเปลี่ยนค่า ผู้ใช้ทุกคนจะต้องล็อกอินใหม่

#### ข้อจำกัดไฟล์อัปโหลด
- ไฟล์ละไม่เกิน **4MB** และรวมทุกไฟล์ต่อการส่ง 1 ครั้งไม่เกิน **4MB** (ตามลิมิต body ของ Vercel serverless ~4.5MB)

### 3. รัน Development Server

```bash
npm run dev
```

เปิด http://localhost:3000

### 4. Deploy ไป Vercel

1. Push code ขึ้น GitHub
2. เชื่อม repo กับ Vercel
3. ตั้งค่า Environment Variables ใน Vercel Dashboard
4. Deploy

## ค่าเริ่มต้น

| ชื่อ  | PIN    | Role  |
|-------|--------|-------|
| Admin | 111111 | admin |
| User  | 222222 | user  |

## โครงสร้างโปรเจค

```
src/
├── app/
│   ├── page.tsx              # หน้า Login (PIN)
│   ├── dashboard/            # หน้าหลัก
│   ├── apply/                # ฟอร์มสมัครงาน
│   ├── admin/                # จัดการ PIN
│   │   └── applications/     # ดูใบสมัคร
│   └── api/                  # API Routes
├── components/               # UI Components
├── lib/                      # Utilities
└── middleware.ts              # Auth Middleware
```

## ฟีเจอร์

- ระบบ Login ด้วย PIN (เก็บใน GitHub)
- ฟอร์มสมัครงาน (เก็บใน Google Drive)
- จัดการ PIN (Admin เท่านั้น)
- ดูใบสมัคร (Admin เท่านั้น)
- Responsive Design
- Loading Spinner & Save Overlay
- Thai Date Picker (flatpickr)
- Toggle Switch แทน Radio Button
