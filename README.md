# 🤖 ChatdenPO - AI-Powered PLM Order Management

ChatGPT ile PLM Sipariş Dağılım API - Doğal dil komutlarıyla sipariş oluşturma ve dağıtım sistemi.

[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-blue)](https://openai.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Özellikler

- ✅ **OpenAI GPT-4o-mini** ile doğal dil komut parsing
- ✅ **Çoklu renk desteği** - tek Request'te birleştirilmiş sipariş
- ✅ **Infor FashionPLM** entegrasyonu (OAuth2 + OData2)
- ✅ **Asortisman bazlı** beden dağılımı
- ✅ **Kanal dağılımı** (Mağaza/İnternet)
- ✅ **StylePackAPI** ile aynı hesaplama mantığı
- ✅ **Otomatik sipariş oluşturma** PLM'de

## 🚀 Hızlı Başlangıç

### 1. Kurulum

```bash
git clone https://github.com/KaanKaraca93/chat2PO.git
cd chat2PO
npm install
```

### 2. Environment Variables

`.env` dosyası oluşturun:

```env
# OpenAI API
OPENAI_API_KEY=sk-your-openai-api-key

# Server
PORT=5000

# PLM Credentials (opsiyonel - kodda hardcoded)
PLM_TENANT=your_tenant_id
PLM_CLIENT_ID=your_client_id
PLM_CLIENT_SECRET=your_client_secret
PLM_USERNAME=your_username
PLM_PASSWORD=your_password
```

### 3. Başlat

```bash
# Production
npm start

# Development (auto-reload)
npm run dev
```

Server `http://localhost:5000` adresinde çalışacak.

## 📡 API Endpoints

### 📚 Swagger Documentation

**Interactive API Docs:**
- **Production**: [https://peaceful-spire-06845-5624ee00a891.herokuapp.com/api-docs](https://peaceful-spire-06845-5624ee00a891.herokuapp.com/api-docs)
- **Local**: http://localhost:5000/api-docs

Swagger UI üzerinden tüm endpoint'leri test edebilir ve detaylı dokümantasyonu görebilirsiniz.

### 🎯 POST `/create-order` (Önerilen)

Doğal dil komutuyla PLM'de sipariş oluşturur.

**Request:**
```json
{
  "styleId": 325,
  "command": "bej 10000 mağaza, gri 5000 %50 internet",
  "supplierId": 38,
  "dueDate": "2024-12-31",
  "udf2": "COLLECTION2024"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "2 renk için sipariş oluşturuldu",
  "isMultiColor": true,
  "data": {
    "totalColors": 2,
    "successfulColors": 2,
    "failedColors": 0,
    "results": [
      {
        "colorCode": "BEJ",
        "quantity": 10000,
        "internetPercent": 0,
        "plmResponse": { ... }
      },
      {
        "colorCode": "GRI",
        "quantity": 5000,
        "internetPercent": 50,
        "plmResponse": { ... }
      }
    ]
  }
}
```

### 📊 POST `/calculate-order`

Sadece hesaplama yapar (PLM'e yazmaz).

### 🟣 POST `/parse-command`

Sadece OpenAI parsing testi.

### 🟡 GET `/health`

Health check endpoint.

## 💬 Komut Örnekleri

```javascript
// Tek renk
"bej 5000 sadece mağaza"
"siyah rengi 10000 adet %20 internet"

// Çoklu renk (tek Request'te)
"bej 10000 mağaza, gri 5000 %50 internet"
"siyah 3000 sadece mağaza, beyaz 2000 %30 internet, gri 1500 %10 internet"

// Farklı formatlar
"BYZ renge 20000 adet sipariş geç %10'u internet kanalına ayrılsın"
"12.500 adet kırmızı renk için sadece internet"
```

## 🧮 Hesaplama Mantığı

### 1. Kanal Dağılımı

```javascript
totalStore = Quantity × (100 - internetPercent) / 100
totalInternet = Quantity × internetPercent / 100
```

### 2. Asortisman Bazlı Dağıtım

```javascript
// PLM'den gelen asortisman: [2, 2, 2, 2]
asortimanToplam = 8
paketSayisiMagaza = Math.floor(totalStore / asortimanToplam)
paketSayisiInternet = Math.floor(totalInternet / asortimanToplam)

// Her beden için
bedenMagaza = asortimanDegeri × paketSayisiMagaza
bedenInternet = asortimanDegeri × paketSayisiInternet
```

### 3. Örnek Senaryo

```
Input: 10.000 adet, %20 internet, Asortisman: [2, 2, 2, 2]

Kanal:
├─ Mağaza: 8.000 adet → 1.000 paket
└─ İnternet: 2.000 adet → 250 paket

Bedenler (001, 002, 003, 004):
001: 2.000 (Mağaza) + 500 (İnternet) = 2.500 adet
002: 2.000 (Mağaza) + 500 (İnternet) = 2.500 adet
003: 2.000 (Mağaza) + 500 (İnternet) = 2.500 adet
004: 2.000 (Mağaza) + 500 (İnternet) = 2.500 adet

Toplam: 10.000 adet ✅
```

## 🏗️ Proje Yapısı

```
chat2PO/
├── server.js              # Ana server (Express + OpenAI + PLM)
├── package.json           # Dependencies
├── .env                   # Environment variables (git ignored)
├── env_template.txt       # .env template
├── test.js                # Basic API tests
├── test-create-order.js   # Full order creation test
├── test-multi-color.js    # Multi-color command test
├── README.md              # Bu dosya
└── .gitignore             # Git ignore rules
```

## 🔧 Teknolojiler

- **Node.js** + **Express** - Web framework
- **OpenAI API** (GPT-4o-mini) - Natural language processing
- **Axios** - HTTP client (PLM API calls)
- **Infor FashionPLM** - PLM system integration
- **OAuth2** - Authentication
- **OData2** - PLM data queries

## 📦 Deployment (Heroku)

### 1. Heroku CLI ile

```bash
# Login
heroku login

# Create app
heroku create your-app-name

# Set env variables
heroku config:set OPENAI_API_KEY=sk-your-key

# Deploy
git push heroku main
```

### 2. GitHub Integration (Önerilen)

1. Heroku Dashboard → Create New App
2. Deployment method → GitHub
3. Repository seç: `KaanKaraca93/chat2PO`
4. Enable Automatic Deploys
5. Config Vars'a `OPENAI_API_KEY` ekle
6. Deploy Branch → `main`

## 🔐 Güvenlik Notları

- ⚠️ **`.env` dosyasını asla commit etmeyin**
- ⚠️ **PLM credentials kodda hardcoded** (production'da env vars kullanın)
- ✅ Token'lar otomatik yenilenir
- ✅ HTTPS kullanın (production'da)

## 🧪 Test

API test scriptleri:

```bash
# Basic tests
node test.js

# Full order creation
node test-create-order.js

# Multi-color test
node test-multi-color.js
```

## 📊 Performans

- ⚡ **OpenAI Parsing**: ~500ms
- ⚡ **PLM Data Fetch**: ~1-2s (per color)
- ⚡ **Order Creation**: ~500ms
- 🎯 **Total (2 colors)**: ~5-6 saniye

## 🐛 Bilinen Sorunlar

- `Math.floor` kullanımı nedeniyle bazı bedenler kalan adet ile tamamlanmaz (StylePackAPI ile aynı)
- Çok fazla renk olursa PLM timeout verebilir (10+ renk)

## 🔄 Changelog

### v1.0.0 (2025-11-06)
- ✅ OpenAI entegrasyonu tamamlandı
- ✅ PLM entegrasyonu tamamlandı
- ✅ Hesaplama motoru eklendi
- ✅ Sipariş oluşturma özelliği
- ✅ Çoklu renk desteği (tek Request'te birleştirilmiş)
- ✅ Production-ready

## 👨‍💻 Geliştirici

**Kaan Karaca**  
Email: kaan.karaca93@gmail.com  
GitHub: [@KaanKaraca93](https://github.com/KaanKaraca93)

## 📄 Lisans

MIT License - İstediğiniz gibi kullanabilirsiniz.

---

**🎯 Proje Hedefi:** StylePackAPI'nin hesaplama mantığını koruyarak, OpenAI/ChatGPT ile doğal dil desteği eklemek ve PLM'de otomatik sipariş oluşturmak.

**Made with ❤️ for Infor FashionPLM**
