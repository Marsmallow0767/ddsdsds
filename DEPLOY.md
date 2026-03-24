# Denizstagram Render Deploy

## Bu repoda ne hazir?

- `server.js`: Render uyumlu Node.js backend
- `app.js`, `index.html`, `styles.css`: frontend
- `render.yaml`: Render servis konfigurasyonu
- `package.json`: start komutu
- `data/db.json`: veri dosyasi
- `uploads/`: yuklenen medya klasoru

## GitHub'a yukleme

Ben bu ortamdan senin GitHub hesabina otomatik push yapamam. Bunun icin senin:

- GitHub repo olusturman
- ya da bana burada kullanabilecegim kimlik/uzak repo bilgisi vermen

gerekir.

## En hizli Render akisi

1. GitHub'da yeni repo olustur
2. Bu klasordeki dosyalari o repoya yukle
3. Render'da `New +` -> `Blueprint` sec
4. GitHub repoyu bagla
5. Render `render.yaml` dosyasini okuyup servisi olustursun

## Onemli not

Uygulama verileri `data/db.json` dosyasinda tutuluyor. Kalici veri icin Render disk gerekir.
Bu repo icindeki `render.yaml` buna gore ayarlandi.

## Render'da acilis komutu

Bu repoda:

- Build: `npm install`
- Start: `npm start`

## Domain baglama

Deploy bittikten sonra Render panelinde:

- `Settings`
- `Custom Domains`

bolumunden domain baglayabilirsin.
