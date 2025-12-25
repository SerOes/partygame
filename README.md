# Silvester Party App

Eine mobile-first Multiplayer Party-Game Web-App für Silvester mit AI-generiertem Quiz und Chaos-Bingo.

## Features

- 🎮 **Pub Quiz** - AI-generierte Fragen mit Timer und Punktesystem
- 🎯 **Chaos Bingo** - Taboo-Style Spiel mit Buzzer
- 🎭 **Geheimidentitäten** - AI-generierte lustige Teamnamen
- 🎙️ **AI Moderator** - Text-to-Speech Kommentare
- 📱 **Mobile-First** - Optimiert für Smartphones
- 🌍 **Mehrsprachig** - Deutsch & Türkisch

## Setup

### 1. Dependencies installieren

```bash
npm install
```

### 2. Datenbank einrichten

```bash
npx prisma generate
npx prisma db push
```

### 3. Server starten

```bash
# Backend + Frontend zusammen
npm start

# Oder einzeln:
npm run server  # Backend auf Port 3001
npm run dev     # Frontend auf Port 3000
```

### 4. API-Key konfigurieren

1. Öffne die App im Browser: <http://localhost:3000>
2. Klicke auf das Zahnrad-Symbol (⚙️)
3. Gib deinen Gemini API-Key ein
4. Der Key wird verschlüsselt in der Datenbank gespeichert

## Spielablauf

1. **Host** öffnet die App und klickt "Admin"
2. **Host** erstellt eine neue Party → QR-Code erscheint
3. **Spieler** scannen den QR-Code oder geben den Code ein
4. **Spieler** geben ihren Teamnamen ein → bekommen Geheimidentität
5. **Host** startet das Spiel
6. **Quiz-Runde** → Multiple Choice Fragen
7. **Bingo-Runde** → Taboo mit Buzzer
8. **Endergebnis** → Identitäten werden enthüllt

## Technologie

- **Frontend**: React 19 + Vite + Tailwind CSS
- **Backend**: Express.js + Socket.io
- **Datenbank**: Prisma + SQLite
- **AI**: Google Gemini API (Quiz, TTS, Bilder)

## Projektstruktur

```
game/
├── prisma/           # Datenbankschema
├── server/           # Express Backend
├── src/
│   ├── components/   # React Komponenten
│   ├── stores/       # Zustand State Management
│   └── styles/       # CSS
├── components/       # Legacy Komponenten
├── App.tsx           # Haupt-App
└── package.json
```
