import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import * as fs from 'fs';

// Debug log helper - writes to file for analysis
const DEBUG_LOG_PATH = './debug-game.log';
function debugLog(category: string, message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${category}] ${message}${data ? ' | DATA: ' + JSON.stringify(data) : ''}\n`;
  console.log(logLine.trim());
  fs.appendFileSync(DEBUG_LOG_PATH, logLine);
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'silvester-party-jwt-secret-2025';

// Encryption key für API-Key (in Produktion aus env var)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'silvester-party-app-secret-key-32';
const IV_LENGTH = 16;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' })); // Increased limit for avatar images

// ==================== SEED DATA ====================

const CATEGORIES = [
  { nameDE: 'Filme & Serien 2025', nameTR: '2025 Film & Dizi', icon: '🎬' },
  { nameDE: 'Musik & Hits 2025', nameTR: '2025 Müzik & Hitler', icon: '🎵' },
  { nameDE: 'Sport 2025', nameTR: '2025 Spor', icon: '⚽' },
  { nameDE: 'Weltgeschehen 2025', nameTR: '2025 Dünya Olayları', icon: '🌍' },
  { nameDE: 'Österreich Spezial', nameTR: 'Avusturya Özel', icon: '🇦🇹' },
  { nameDE: 'Türkei Spezial', nameTR: 'Türkiye Özel', icon: '🇹🇷' },
  { nameDE: 'Tech & Gaming', nameTR: 'Teknoloji & Oyun', icon: '💻' },
  { nameDE: 'Popkultur & Memes', nameTR: 'Pop Kültür & Memeler', icon: '🍿' },
  { nameDE: 'Prominente & Stars', nameTR: 'Ünlüler & Starlar', icon: '🎭' },
  { nameDE: 'Essen & Trinken', nameTR: 'Yemek & İçecek', icon: '🍕' },
  { nameDE: 'Silvester & Traditionen', nameTR: 'Yılbaşı & Gelenekler', icon: '🎉' },
  { nameDE: 'Wissenschaft 2025', nameTR: '2025 Bilim', icon: '🔬' }
];

async function seedDatabase() {
  // Seed Admin
  const adminEmail = 'serhat.oesmen@gmail.com';
  const existingAdmin = await prisma.admin.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const hashedPw = await bcrypt.hash('Testen123', 10);
    await prisma.admin.create({
      data: { email: adminEmail, passwordHash: hashedPw }
    });
    console.log('✅ Admin user created');
  }

  // Seed Categories
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { id: cat.icon },
      update: cat,
      create: { id: cat.icon, ...cat }
    });
  }
  console.log('✅ Categories seeded');
}

// ==================== ENCRYPTION HELPERS ====================

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = parts.join(':');
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ==================== GEMINI SERVICE ====================

async function getGeminiClient() {
  const setting = await prisma.settings.findUnique({ where: { key: 'gemini_api_key' } });
  if (!setting) throw new Error('API key not configured');
  const apiKey = decrypt(setting.value);
  return new GoogleGenAI({ apiKey });
}

// ==================== AUTH MIDDLEWARE ====================

function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, JWT_SECRET, (err: any, admin: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.admin = admin;
    next();
  });
}

// ==================== API ROUTES ====================

// --- Admin Auth ---

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, admin.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin.id, email: admin.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, admin: { id: admin.id, email: admin.email } });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/verify', authenticateToken, (req: any, res) => {
  res.json({ admin: req.admin });
});

// --- Settings Routes ---

app.post('/api/settings/apikey', async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Validate API key
    try {
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Test'
      });
    } catch (e: any) {
      return res.status(400).json({ error: 'Invalid API key: ' + e.message });
    }

    const encrypted = encrypt(apiKey);
    await prisma.settings.upsert({
      where: { key: 'gemini_api_key' },
      update: { value: encrypted },
      create: { key: 'gemini_api_key', value: encrypted }
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings/apikey/status', async (req, res) => {
  try {
    const setting = await prisma.settings.findUnique({ where: { key: 'gemini_api_key' } });
    res.json({ hasKey: !!setting });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Categories ---

app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Session Routes ---

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.post('/api/sessions', async (req, res) => {
  try {
    const { language = 'de' } = req.body;
    const session = await prisma.gameSession.create({
      data: {
        joinCode: generateJoinCode(),
        language
      }
    });
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:joinCode', async (req, res) => {
  try {
    const session = await prisma.gameSession.findUnique({
      where: { joinCode: req.params.joinCode },
      include: { teams: true }
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:id/select-categories', async (req, res) => {
  try {
    const { categoryIds } = req.body;
    // Allow 1 or more categories (flexible selection)
    if (!Array.isArray(categoryIds) || categoryIds.length < 1) {
      return res.status(400).json({ error: 'Must select at least 1 category' });
    }

    const session = await prisma.gameSession.update({
      where: { id: req.params.id },
      data: {
        selectedCategories: JSON.stringify(categoryIds),
        phase: 'QUIZ'
      }
    });

    io.to(session.id).emit('categories-selected', { categoryIds });
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:id/toggle-tts', async (req, res) => {
  try {
    const { enabled } = req.body;
    const session = await prisma.gameSession.update({
      where: { id: req.params.id },
      data: { ttsEnabled: enabled }
    });
    io.to(session.id).emit('tts-toggled', { enabled });
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Team Routes ---

// Famous Turkish celebrities for team names
const TURKISH_CELEBRITIES = [
  // Male singers & actors
  'Tarkan', 'Müslüm Gürses', 'Barış Manço', 'Cem Yılmaz', 'Şahan Gökbakar',
  'İbrahim Tatlıses', 'Özcan Deniz', 'Serdar Ortaç', 'Yılmaz Erdoğan', 'Şener Şen',
  'Kenan İmirzalıoğlu', 'Kıvanç Tatlıtuğ', 'Cüneyt Arkın',
  // Politicians
  'Recep Tayyip Erdoğan', 'Ekrem İmamoğlu',
  // Sports
  'Fatih Terim', 'Arda Turan', 'Hakan Şükür',
  // Female singers
  'Kibariye', 'Bülent Ersoy', 'Ajda Pekkan', 'Sezen Aksu', 'Hadise', 'Demet Akalın',
  'Hande Yener', 'Hülya Avşar', 'Sibel Can', 'Yıldız Tilbe', 'Ebru Gündeş',
  // Famous Turkish actresses & women
  'Türkan Şoray', 'Müjde Ar', 'Hülya Koçyiğit', 'Fatma Girik', 'Filiz Akın',
  'Nurgül Yeşilçay', 'Bergüzar Korel', 'Beren Saat', 'Fahriye Evcen', 'Tuba Büyüküstün',
  // Musicians
  'Aşık Mahzuni Şerif', 'Neşet Ertaş', 'Zeki Müren', 'Orhan Gencebay'
];

app.post('/api/sessions/:joinCode/join', async (req, res) => {
  try {
    const { realName, isHost = false } = req.body;
    const session = await prisma.gameSession.findUnique({
      where: { joinCode: req.params.joinCode },
      include: { teams: true }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.phase !== 'LOBBY' && session.phase !== 'CATEGORY_SELECT') {
      return res.status(400).json({ error: 'Game already started' });
    }

    // Get names already used in this session
    const usedNames = session.teams.map(t => t.secretName);

    // Find available Turkish celebrity names
    const availableNames = TURKISH_CELEBRITIES.filter(name => !usedNames.includes(name));

    // Pick a random available name
    let secretName = availableNames.length > 0
      ? availableNames[Math.floor(Math.random() * availableNames.length)]
      : `Misafir ${session.teams.length + 1}`;

    // 🥚 Easter Eggs - Special secret names for specific players
    const realNameLower = realName.toLowerCase().trim();
    if (realNameLower === 'fırat' || realNameLower === 'firat') {
      secretName = 'Recep Tayyip Erdoğan';
      console.log('🥚 Easter Egg activated: Firat → Recep Tayyip Erdoğan');
    } else if (realNameLower === 'fatih') {
      secretName = 'Fatih Terim';
      console.log('🥚 Easter Egg activated: Fatih → Fatih Terim');
    }

    let avatar = null;

    // 🥚 Special fixed avatar for Recep Tayyip Erdoğan Easter egg
    if (secretName === 'Recep Tayyip Erdoğan') {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const avatarPath = path.join(process.cwd(), 'public', 'images', 'avatar', 'reci.png');
        const avatarBuffer = fs.readFileSync(avatarPath);
        avatar = `data:image/png;base64,${avatarBuffer.toString('base64')}`;
        console.log('🥚 Using fixed Erdoğan avatar from reci.png');
      } catch (avatarErr) {
        console.error('Failed to load reci.png avatar:', avatarErr);
      }
    }

    // 🥚 Special fixed avatar for Fatih Terim Easter egg
    if (secretName === 'Fatih Terim') {
      try {
        const fs = await import('fs');
        const path = await import('path');
        const avatarPath = path.join(process.cwd(), 'public', 'images', 'avatar', 'fatih.png');
        const avatarBuffer = fs.readFileSync(avatarPath);
        avatar = `data:image/png;base64,${avatarBuffer.toString('base64')}`;
        console.log('🥚 Using fixed Fatih Terim avatar from fatih.png');
      } catch (avatarErr) {
        console.error('Failed to load fatih.png avatar:', avatarErr);
      }
    }

    // Only generate AI avatar if we don't have a fixed one
    if (!avatar) {
      try {
        const ai = await getGeminiClient();

        // Celebrity profiles for caricature generation (without using actual names)
        // Maps secret names to their profession/traits for funny caricatures
        const celebrityProfiles: Record<string, { gender: string; profession: string; funTrait: string }> = {
          'Sibel Can': { gender: 'female', profession: 'pop diva singer', funTrait: 'dramatic hand gestures and sparkly dress' },
          'Tarkan': { gender: 'male', profession: 'pop star singer', funTrait: 'dramatic hair flip and leather jacket' },
          'Müjde Ar': { gender: 'female', profession: 'glamorous actress', funTrait: 'vintage Hollywood style with fur coat' },
          'Kemal Sunal': { gender: 'male', profession: 'comedy actor', funTrait: 'confused expression with messy hair' },
          'Barış Manço': { gender: 'male', profession: 'rock musician', funTrait: 'long mustache and colorful vest' },
          'Sezen Aksu': { gender: 'female', profession: 'legendary singer', funTrait: 'elegant pose with microphone' },
          'Ajda Pekkan': { gender: 'female', profession: 'superstar diva', funTrait: 'blonde hair and glamorous sunglasses' },
          'Cem Yılmaz': { gender: 'male', profession: 'stand-up comedian', funTrait: 'expressive face telling a joke' },
          'Neşet Ertaş': { gender: 'male', profession: 'folk musician', funTrait: 'playing traditional instrument with hat' },
          'Zeki Müren': { gender: 'male', profession: 'flamboyant singer', funTrait: 'colorful costume with big jewelry' },
          'Bülent Ersoy': { gender: 'female', profession: 'dramatic diva singer', funTrait: 'extravagant gown and big hair' },
          'İbrahim Tatlıses': { gender: 'male', profession: 'arabesk singer', funTrait: 'mustache and emotional expression' },
          'Hülya Avşar': { gender: 'female', profession: 'TV personality', funTrait: 'confident pose with blonde hair' },
          'Adile Naşit': { gender: 'female', profession: 'comedy actress', funTrait: 'motherly expression with apron' },
          'Münir Özkul': { gender: 'male', profession: 'theater actor', funTrait: 'wise old man with glasses' },
          'Orhan Gencebay': { gender: 'male', profession: 'arabesk musician', funTrait: 'playing saz with emotional face' },
          // Male singers & actors
          'Müslüm Gürses': { gender: 'male', profession: 'arabesk legend singer', funTrait: 'emotional tear-streaked face and microphone' },
          'Şahan Gökbakar': { gender: 'male', profession: 'comedy actor', funTrait: 'funny grimace and wacky pose' },
          'Özcan Deniz': { gender: 'male', profession: 'pop singer and actor', funTrait: 'romantic pose with rose' },
          'Serdar Ortaç': { gender: 'male', profession: 'pop singer', funTrait: 'energetic dance pose with sequins' },
          'Yılmaz Erdoğan': { gender: 'male', profession: 'director and comedian', funTrait: 'thoughtful expression with film camera' },
          'Şener Şen': { gender: 'male', profession: 'legendary actor', funTrait: 'wise expression with newspaper' },
          'Kenan İmirzalıoğlu': { gender: 'male', profession: 'TV drama star', funTrait: 'intense mysterious gaze' },
          'Kıvanç Tatlıtuğ': { gender: 'male', profession: 'heartthrob actor', funTrait: 'charming smile with styled hair' },
          'Cüneyt Arkın': { gender: 'male', profession: 'action movie star', funTrait: 'martial arts pose with cape' },
          // Politicians
          'Recep Tayyip Erdoğan': { gender: 'male', profession: 'statesman politician', funTrait: 'confident podium pose with suit' },
          'Ekrem İmamoğlu': { gender: 'male', profession: 'mayor politician', funTrait: 'friendly wave with big smile' },
          // Sports
          'Fatih Terim': { gender: 'male', profession: 'legendary football coach', funTrait: 'intense sideline pose with suit and whistle' },
          'Arda Turan': { gender: 'male', profession: 'football player', funTrait: 'celebration pose with jersey' },
          'Hakan Şükür': { gender: 'male', profession: 'football legend', funTrait: 'goal celebration with raised arms' },
          // Female singers
          'Kibariye': { gender: 'female', profession: 'folk singer', funTrait: 'joyful dancing with colorful traditional dress' },
          'Demet Akalın': { gender: 'female', profession: 'pop diva', funTrait: 'glamorous pose with blonde hair' },
          'Hande Yener': { gender: 'female', profession: 'pop star', funTrait: 'edgy modern look with fashion outfit' },
          // Famous Turkish actresses
          'Türkan Şoray': { gender: 'female', profession: 'legendary cinema actress', funTrait: 'classic movie star pose with headscarf' },
          'Hülya Koçyiğit': { gender: 'female', profession: 'cinema legend', funTrait: 'elegant vintage style with pearls' },
          'Fatma Girik': { gender: 'female', profession: 'classic actress', funTrait: 'strong feminine pose with determination' },
          'Filiz Akın': { gender: 'female', profession: 'golden age actress', funTrait: 'glamorous 60s style with beehive hair' },
          // Additional female celebrities
          'Fahriye Evcen': { gender: 'female', profession: 'glamorous actress', funTrait: 'elegant beauty with flowing hair' },
          'Bergüzar Korel': { gender: 'female', profession: 'drama actress', funTrait: 'intense dramatic expression' },
          'Tuba Büyüküstün': { gender: 'female', profession: 'TV star actress', funTrait: 'sophisticated and elegant pose' },
          'Demet Akbağ': { gender: 'female', profession: 'comedy actress', funTrait: 'funny expressive face' },
          'Yıldız Tilbe': { gender: 'female', profession: 'pop singer', funTrait: 'colorful outfit with guitar' },
          'Ebru Gündeş': { gender: 'female', profession: 'pop diva', funTrait: 'glamorous stage outfit' },
          'Hadise': { gender: 'female', profession: 'pop star', funTrait: 'dancing pose with modern style' },
          'Gülben Ergen': { gender: 'female', profession: 'pop singer', funTrait: 'energetic performance pose' },
          'Nurgül Yeşilçay': { gender: 'female', profession: 'drama actress', funTrait: 'elegant sophisticated look' },
          'Beren Saat': { gender: 'female', profession: 'TV actress', funTrait: 'intense dramatic gaze' },
          // Folk musicians
          'Aşık Mahzuni Şerif': { gender: 'male', profession: 'folk poet musician', funTrait: 'playing saz with wise beard' },
        };

        // Get profile or create generic one based on name
        // Turkish female names often end in: a, e, i (Ayşe, Fatma, Sibel, etc.)
        // Male names often end in: n, r, t, k, l (Tarkan, Orhan, Kemal, etc.)
        const femaleEndings = ['a', 'e', 'i', 'ü', 'ı'];
        const isFemale = femaleEndings.some(ending => secretName.toLowerCase().endsWith(ending));

        const profile = celebrityProfiles[secretName] || {
          gender: isFemale ? 'female' : 'male',
          profession: 'entertainer',
          funTrait: 'party hat and confetti'
        };

        const firstLetter = secretName.charAt(0).toUpperCase();

        // Create funny caricature prompt based on profession
        const avatarPrompt = `Create a hilarious cartoon caricature portrait:
- Subject: A funny ${profile.gender} ${profile.profession}
- Style: Exaggerated cartoon caricature, colorful, comedic
- Expression: ${profile.funTrait}
- The character has a big letter "${firstLetter}" badge on their outfit
- Celebrating New Year's Eve with confetti and sparkles
- Humorous, over-the-top personality shining through
- Square format, vibrant colors, fun and silly mood
- NO text except the letter badge, NO real person likeness`;

        console.log(`🎨 Generating avatar for ${secretName}...`);

        // Use simple format from Nano Banana documentation
        const avatarResponse = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: avatarPrompt,
        });

        // Debug logging
        console.log(`📦 Avatar response received for ${secretName}`);

        // Log full response for debugging
        const hasResponse = !!avatarResponse;
        const hasCandidates = !!avatarResponse?.candidates;
        const candidatesLength = avatarResponse?.candidates?.length || 0;
        console.log(`📦 hasResponse=${hasResponse}, hasCandidates=${hasCandidates}, candidatesLength=${candidatesLength}`);

        if (candidatesLength > 0) {
          const firstCandidate = avatarResponse.candidates![0];
          console.log(`📦 firstCandidate has content=${!!firstCandidate?.content}`);
          console.log(`📦 content parts length=${firstCandidate?.content?.parts?.length || 0}`);
        }

        const parts = avatarResponse.candidates?.[0]?.content?.parts || [];
        console.log(`📦 Number of parts: ${parts.length}`);

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          console.log(`📦 Part ${i}: has inlineData=${!!part.inlineData}, has text=${!!part.text}`);
          if (part.inlineData) {
            const mimeType = part.inlineData.mimeType;
            const dataLength = part.inlineData.data?.length || 0;
            console.log(`📦 Part ${i}: mimeType=${mimeType}, dataLength=${dataLength}`);
            avatar = `data:${mimeType};base64,${part.inlineData.data}`;
            console.log(`✅ Avatar extracted for ${secretName}, length: ${avatar.length}`);
            break;
          }
        }

        if (!avatar) {
          console.log(`⚠️ No image data found in response for ${secretName}, using text model fallback`);
          // Log what we did get
          console.log(`📦 Full response keys:`, Object.keys(avatarResponse || {}));
        }
      } catch (e: any) {
        console.error(`❌ Avatar generation error for ${secretName}:`, e.message || e);
        // Avatar remains null, fallback will be used in UI
      }
    } // End of if (!avatar) block
    const team = await prisma.team.create({
      data: {
        realName,
        secretName,
        avatar,
        isHost,
        sessionId: session.id
      }
    });

    debugLog('TEAM_JOIN', `Team created for ${realName}`, { teamId: team.id, realName, secretName, sessionId: session.id, isHost });

    io.to(session.id).emit('team-joined', { team: { ...team, realName: undefined } }); // Hide real name from others

    res.json(team);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- AI Routes ---

app.post('/api/ai/generate-questions', async (req, res) => {
  try {
    const { sessionId, categoryId, language } = req.body;

    console.log('Generating questions for:', { sessionId, categoryId, language });

    const ai = await getGeminiClient();

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      console.log('Category not found:', categoryId);
      return res.status(404).json({ error: 'Category not found' });
    }

    const categoryName = language === 'de' ? category.nameDE : category.nameTR;
    console.log('Category name:', categoryName);

    // Generate bilingual questions
    const prompt = `Du bist ein Quiz-Master für eine zweisprachige Silvester-Party.
Generiere 10 interessante Quiz-Fragen zum Thema "${category.nameDE}" (Türkisch: "${category.nameTR}").

WICHTIG: Jede Frage und Antwort MUSS in BEIDEN Sprachen sein!

Antworte NUR mit JSON-Array:
[
  {
    "question": {"de": "Deutsche Frage?", "tr": "Türkçe soru?"},
    "options": [
      {"de": "Antwort A", "tr": "Cevap A"},
      {"de": "Antwort B", "tr": "Cevap B"},
      {"de": "Antwort C", "tr": "Cevap C"},
      {"de": "Antwort D", "tr": "Cevap D"}
    ],
    "correctIndex": 0
  }
]

correctIndex ist 0-3 (0=A, 1=B, 2=C, 3=D). NUR JSON!`;

    console.log('Calling Gemini 3 Flash API...');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt
    });

    const responseText = response.text || '';
    console.log('Gemini response length:', responseText.length);

    // Extract JSON from response (in case there's extra text)
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    let questions;
    try {
      questions = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Raw response:', responseText.substring(0, 500));
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      console.error('Invalid questions format:', questions);
      return res.status(500).json({ error: 'Invalid questions format' });
    }

    // Save questions to database
    const savedQuestions = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !q.options || q.correctIndex === undefined) {
        console.log('Skipping invalid question:', q);
        continue;
      }
      const saved = await prisma.question.create({
        data: {
          sessionId,
          categoryId,
          question: typeof q.question === 'object' ? JSON.stringify(q.question) : q.question,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          questionIndex: i
        }
      });
      savedQuestions.push(saved);
    }

    console.log(`Saved ${savedQuestions.length} questions for category ${categoryId}`);
    res.json(savedQuestions);
  } catch (error: any) {
    console.error('Question generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Seed 100 questions per category using Gemini 3 Flash
app.post('/api/seed-questions/:categoryId', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { batchSize = 25 } = req.body; // Generate in batches of 25

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    // Check how many questions already exist for this category
    const existingCount = await prisma.seededQuestion.count({
      where: { categoryId }
    });

    if (existingCount >= 100) {
      return res.json({ message: 'Already have 100+ questions for this category', count: existingCount });
    }

    const ai = await getGeminiClient();
    const questionsNeeded = 100 - existingCount;
    const batches = Math.ceil(questionsNeeded / batchSize);
    let totalSaved = 0;

    for (let batch = 0; batch < batches; batch++) {
      const count = Math.min(batchSize, questionsNeeded - (batch * batchSize));

      const prompt = `Du bist ein Quiz-Master für eine zweisprachige Silvester-Party.
Generiere ${count} EINZIGARTIGE und interessante Quiz-Fragen zum Thema "${category.nameDE}" (Türkisch: "${category.nameTR}").

Die Fragen sollen vielfältig sein und verschiedene Aspekte des Themas abdecken.

WICHTIG: Jede Frage und Antwort MUSS in BEIDEN Sprachen sein!

Antworte NUR mit JSON-Array:
[
  {
    "questionDE": "Deutsche Frage?",
    "questionTR": "Türkçe soru?",
    "optionA_DE": "Antwort A (DE)", "optionA_TR": "Cevap A (TR)",
    "optionB_DE": "Antwort B (DE)", "optionB_TR": "Cevap B (TR)",
    "optionC_DE": "Antwort C (DE)", "optionC_TR": "Cevap C (TR)",
    "optionD_DE": "Antwort D (DE)", "optionD_TR": "Cevap D (TR)",
    "correctIndex": 0
  }
]

correctIndex ist 0-3 (0=A, 1=B, 2=C, 3=D). NUR JSON, keine zusätzlichen Kommentare!`;

      console.log(`🎯 Generating batch ${batch + 1}/${batches} (${count} questions) for ${category.nameDE}...`);

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      const responseText = response.text || '';

      // Extract JSON from response
      let jsonStr = responseText;
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      try {
        const questions = JSON.parse(jsonStr);
        if (Array.isArray(questions)) {
          for (const q of questions) {
            if (q.questionDE && q.questionTR && q.optionA_DE) {
              await prisma.seededQuestion.create({
                data: {
                  categoryId,
                  questionDE: q.questionDE,
                  questionTR: q.questionTR,
                  optionA_DE: q.optionA_DE,
                  optionA_TR: q.optionA_TR,
                  optionB_DE: q.optionB_DE,
                  optionB_TR: q.optionB_TR,
                  optionC_DE: q.optionC_DE,
                  optionC_TR: q.optionC_TR,
                  optionD_DE: q.optionD_DE,
                  optionD_TR: q.optionD_TR,
                  correctIndex: q.correctIndex ?? 0
                }
              });
              totalSaved++;
            }
          }
        }
      } catch (parseError) {
        console.error(`Parse error in batch ${batch + 1}:`, parseError);
      }

      // Small delay between batches to avoid rate limiting
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Seeded ${totalSaved} questions for ${category.nameDE}`);
    res.json({ message: `Seeded ${totalSaved} questions`, total: existingCount + totalSaved });
  } catch (error: any) {
    console.error('Question seeding error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get 10 random questions from seeded pool for a category
app.get('/api/seeded-questions/:categoryId/random', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { excludeIds = '' } = req.query;

    const excludeArray = excludeIds ? (excludeIds as string).split(',') : [];

    // Get all seeded questions for this category, excluding already used ones
    const allQuestions = await prisma.seededQuestion.findMany({
      where: {
        categoryId,
        id: { notIn: excludeArray }
      }
    });

    // Fisher-Yates shuffle for truly random selection
    const shuffled = [...allQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      // Use cryptographically better randomness
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const selected = shuffled.slice(0, 10);

    // Format for game use
    const formatted = selected.map((q, idx) => ({
      id: q.id,
      categoryId: q.categoryId,
      question: JSON.stringify({ de: q.questionDE, tr: q.questionTR }),
      options: JSON.stringify([
        { de: q.optionA_DE, tr: q.optionA_TR },
        { de: q.optionB_DE, tr: q.optionB_TR },
        { de: q.optionC_DE, tr: q.optionC_TR },
        { de: q.optionD_DE, tr: q.optionD_TR }
      ]),
      correctIndex: q.correctIndex,
      questionIndex: idx
    }));

    res.json(formatted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Regenerate ALL questions (delete existing and create new ones)
app.post('/api/regenerate-all-questions', async (req, res) => {
  try {
    // Delete all existing seeded questions
    await prisma.seededQuestion.deleteMany({});
    console.log('🗑️ Deleted all existing seeded questions');

    const categories = await prisma.category.findMany();
    const ai = await getGeminiClient();

    // Start background seeding process
    res.json({
      message: 'Regeneration started! This will take several minutes.',
      categories: categories.length
    });

    // Run seeding in background (after response sent)
    (async () => {
      for (const category of categories) {
        const batchSize = 25;
        const batches = 4; // 4 batches of 25 = 100 questions
        let totalSaved = 0;

        for (let batch = 0; batch < batches; batch++) {
          const prompt = `Du bist ein Quiz-Master für eine zweisprachige Silvester-Party.
Generiere ${batchSize} EINZIGARTIGE und interessante Quiz-Fragen zum Thema "${category.nameDE}" (Türkisch: "${category.nameTR}").

Die Fragen sollen vielfältig sein und verschiedene Aspekte des Themas abdecken.
Mache die Fragen interessant und unterhaltsam für eine Party!

WICHTIG: Jede Frage und Antwort MUSS in BEIDEN Sprachen sein!

Antworte NUR mit JSON-Array:
[
  {
    "questionDE": "Deutsche Frage?",
    "questionTR": "Türkçe soru?",
    "optionA_DE": "Antwort A (DE)", "optionA_TR": "Cevap A (TR)",
    "optionB_DE": "Antwort B (DE)", "optionB_TR": "Cevap B (TR)",
    "optionC_DE": "Antwort C (DE)", "optionC_TR": "Cevap C (TR)",
    "optionD_DE": "Antwort D (DE)", "optionD_TR": "Cevap D (TR)",
    "correctIndex": 0
  }
]

correctIndex ist 0-3 (0=A, 1=B, 2=C, 3=D). NUR JSON!`;

          console.log(`🎯 [${category.nameDE}] Generating batch ${batch + 1}/4...`);

          try {
            const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: prompt
            });

            const responseText = response.text || '';
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              const questions = JSON.parse(jsonMatch[0]);
              if (Array.isArray(questions)) {
                for (const q of questions) {
                  if (q.questionDE && q.questionTR && q.optionA_DE) {
                    await prisma.seededQuestion.create({
                      data: {
                        categoryId: category.id,
                        questionDE: q.questionDE,
                        questionTR: q.questionTR,
                        optionA_DE: q.optionA_DE,
                        optionA_TR: q.optionA_TR,
                        optionB_DE: q.optionB_DE,
                        optionB_TR: q.optionB_TR,
                        optionC_DE: q.optionC_DE,
                        optionC_TR: q.optionC_TR,
                        optionD_DE: q.optionD_DE,
                        optionD_TR: q.optionD_TR,
                        correctIndex: q.correctIndex ?? 0
                      }
                    });
                    totalSaved++;
                  }
                }
              }
            }
          } catch (e: any) {
            console.error(`Error in batch ${batch + 1} for ${category.nameDE}:`, e.message);
          }

          // Delay between batches
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`✅ [${category.nameDE}] Saved ${totalSaved} questions`);
      }
      console.log('🎉 All categories seeded!');
    })();
  } catch (error: any) {
    console.error('Regeneration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Regenerate ALL Bingo cards (delete existing and create new ones)
const BINGO_CATEGORIES = [
  { id: 'filme_serien', nameDE: 'Filme & Serien 2025', nameTR: 'Filmler & Diziler 2025' },
  { id: 'musik_hits', nameDE: 'Musik & Hits 2025', nameTR: 'Müzik & Hitlar 2025' },
  { id: 'sport', nameDE: 'Sport 2025', nameTR: 'Spor 2025' },
  { id: 'weltgeschehen', nameDE: 'Weltgeschehen 2025', nameTR: 'Dünya Olayları 2025' },
  { id: 'oesterreich', nameDE: 'Österreich Spezial', nameTR: 'Avusturya Özel' },
  { id: 'tuerkei', nameDE: 'Türkei Spezial', nameTR: 'Türkiye Özel' },
  { id: 'tech_gaming', nameDE: 'Tech & Gaming', nameTR: 'Teknoloji & Oyunlar' },
  { id: 'popkultur', nameDE: 'Popkultur & Memes', nameTR: 'Popüler Kültür & Memeler' },
  { id: 'prominente', nameDE: 'Prominente & Stars', nameTR: 'Ünlüler & Yıldızlar' },
  { id: 'essen_trinken', nameDE: 'Essen & Trinken', nameTR: 'Yemek & İçecek' },
  { id: 'silvester', nameDE: 'Silvester & Traditionen', nameTR: 'Yılbaşı & Gelenekler' },
  { id: 'wissenschaft', nameDE: 'Wissenschaft 2025', nameTR: 'Bilim 2025' },
];

const ACTIVITY_TYPES = ['EXPLAIN', 'PANTOMIME', 'DRAW'];

app.post('/api/regenerate-bingo-cards', async (req, res) => {
  try {
    // Delete all existing bingo cards
    await prisma.bingoCard.deleteMany({});
    console.log('🗑️ Deleted all existing Bingo cards');

    const ai = await getGeminiClient();

    // Start background generation process
    res.json({
      message: '🎲 Bingo-Karten Generierung gestartet! Dies kann 10-15 Minuten dauern (6000 Begriffe).',
      categories: BINGO_CATEGORIES.length,
      totalExpected: BINGO_CATEGORIES.length * 5 * 50 * 2 // 12 × 5 × 50 × 2 = 6000
    });

    // Difficulty definitions with examples
    const DIFFICULTY_DEFS = {
      de: {
        1: { name: 'SEHR LEICHT', desc: 'Kinderleicht - ein 8-jähriges Kind kennt es', examples: 'Pizza, Hund, Handy, Fußball, Weihnachten' },
        2: { name: 'LEICHT', desc: 'Sehr bekannt - jeder Teenager kennt es', examples: 'Supermarkt, Flugzeug, Geburtstag, Joggen, Fahrrad' },
        3: { name: 'MITTEL', desc: 'Bekannt - die meisten Erwachsenen kennen es', examples: 'Streaming-Dienst, Silvesterrakete, Yoga, Taylor Swift' },
        4: { name: 'SCHWER', desc: 'Spezifisch - braucht etwas Wissen', examples: 'Inflation, Podcast, Fechten, Astronaut, Klimawandel' },
        5: { name: 'SEHR SCHWER', desc: 'Anspruchsvoll - braucht Spezialwissen', examples: 'Kryptowährung, Metaverse, DNA-Doppelhelix, Quantencomputer' }
      },
      tr: {
        1: { name: 'ÇOK KOLAY', desc: '8 yaşında bir çocuk bile bilir', examples: 'Pizza, Köpek, Telefon, Futbol, Uyumak' },
        2: { name: 'KOLAY', desc: 'Her genç bilir', examples: 'Market, Uçak, Doğum günü, Koşmak, Bisiklet' },
        3: { name: 'ORTA', desc: 'Çoğu yetişkin bilir', examples: 'Streaming platformu, Yoga, Eyfel Kulesi' },
        4: { name: 'ZOR', desc: 'Biraz bilgi gerektirir', examples: 'Enflasyon, Podcast, Eskrim, Astronot' },
        5: { name: 'ÇOK ZOR', desc: 'Uzmanlık bilgisi gerektirir', examples: 'Kripto para, Metaverse, Kuantum bilgisayar' }
      }
    };

    // Run generation in background
    (async () => {
      let totalCards = 0;
      const CARDS_PER_DIFFICULTY = 50;
      const DIFFICULTIES = [1, 2, 3, 4, 5];

      for (const category of BINGO_CATEGORIES) {
        console.log(`\n📦 Processing: ${category.nameDE}`);

        for (const language of ['de', 'tr'] as const) {
          const langFlag = language === 'de' ? '🇩🇪' : '🇹🇷';
          const categoryName = language === 'de' ? category.nameDE : category.nameTR;
          const defs = DIFFICULTY_DEFS[language];

          for (const difficulty of DIFFICULTIES) {
            const def = defs[difficulty as keyof typeof defs];
            console.log(`  ${langFlag} Stufe ${difficulty} (${def.name})...`);

            const prompt = language === 'de'
              ? `Generiere ${CARDS_PER_DIFFICULTY} SPEZIFISCHE Begriffe für ein Partyspiel (Tabu/Activity-Stil).

KATEGORIE: "${categoryName}"
SCHWIERIGKEIT: Stufe ${difficulty} - ${def.name}

WICHTIGSTE REGELN:
1. Jeder Begriff MUSS eindeutig zur Kategorie "${categoryName}" gehören!
2. KEINE generischen Begriffe wie "Eis", "Ball", "Musik" die zu mehreren Kategorien passen könnten
3. Stufe ${difficulty} bedeutet: ${def.desc}
4. Beispiele für Stufe ${difficulty}: ${def.examples}

KATEGORIE-SPEZIFISCHE ANFORDERUNGEN:
${categoryName.includes('Sport') ? '- NUR Sportarten, Sportler, Sportereignisse, Sportausrüstung (z.B. "Ronaldo", "Olympiade", "Bundesliga")' : ''}
${categoryName.includes('Musik') ? '- NUR Musiker, Songs, Musikgenres, Instrumente (z.B. "Taylor Swift", "Gitarre", "Hip-Hop")' : ''}
${categoryName.includes('Filme') ? '- NUR Filme, Serien, Schauspieler, Regisseure (z.B. "Barbie", "Netflix", "Tom Hanks")' : ''}
${categoryName.includes('Essen') ? '- NUR Gerichte, Zutaten, Getränke, Restaurants (z.B. "Döner", "Sushi", "Cappuccino")' : ''}
${categoryName.includes('Silvester') ? '- NUR Silvester-Traditionen, Neujahr, Party (z.B. "Feuerwerk", "Bleigießen", "Countdown")' : ''}
${categoryName.includes('Österreich') ? '- NUR österreichische Promis, Orte, Kultur (z.B. "Falco", "Wiener Schnitzel", "Lipizzaner")' : ''}
${categoryName.includes('Türkei') ? '- NUR türkische Kultur, Stars, Traditionen (z.B. "Tarkan", "Baklava", "Cappadocia")' : ''}
${categoryName.includes('Tech') ? '- NUR Technik, Games, Apps, Gadgets (z.B. "iPhone", "Fortnite", "ChatGPT")' : ''}
${categoryName.includes('Popkultur') ? '- NUR Memes, Internet-Trends, Social Media (z.B. "TikTok", "Influencer", "Viral")' : ''}
${categoryName.includes('Prominente') ? '- NUR bekannte Persönlichkeiten, Stars (z.B. "Beyoncé", "Elon Musk", "Angela Merkel")' : ''}
${categoryName.includes('Wissenschaft') ? '- NUR wissenschaftliche Begriffe, Erfindungen (z.B. "Teleskop", "Dinosaurier", "Rakete")' : ''}
${categoryName.includes('Weltgeschehen') ? '- NUR aktuelle Ereignisse, Politik, Länder (z.B. "Klimawandel", "Wahlen", "Olympische Spiele")' : ''}

Für JEDEN Begriff:
1. "term": Ein SPEZIFISCHER Begriff der EINDEUTIG zu "${categoryName}" gehört
2. "forbiddenWords": 5 Wörter, die beim Erklären NICHT benutzt werden dürfen
3. "hint": Ein hilfreicher Hinweis (1 kurzer Satz)

Antworte als JSON Array.`
              : `${CARDS_PER_DIFFICULTY} adet parti oyunu terimi oluştur (Tabu/Activity tarzında).
KATEGORİ: "${categoryName}"
ZORLUK: Seviye ${difficulty} - ${def.name}

ÖNEMLİ - Seviye ${difficulty}: ${def.desc}
Örnek terimler: ${def.examples}

Her terim için:
1. "term": Terim (seviye ${difficulty}'e uygun!)
2. "forbiddenWords": Açıklarken KULLANILMAMASI gereken 5 kelime
3. "hint": Yardımcı ipucu (1 kısa cümle)

JSON Array olarak cevap ver.`;

            try {
              const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json'
                }
              });

              const responseText = response.text || '';
              const jsonMatch = responseText.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const cards = JSON.parse(jsonMatch[0]);
                if (Array.isArray(cards)) {
                  for (const card of cards) {
                    if (card.term && card.forbiddenWords) {
                      const type = ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)];
                      await prisma.bingoCard.create({
                        data: {
                          category: category.id,
                          term: card.term,
                          type,
                          forbiddenWords: JSON.stringify(card.forbiddenWords.slice(0, 5)),
                          language,
                          difficulty,
                          hint: card.hint || ''
                        }
                      });
                      totalCards++;
                    }
                  }
                }
              }
              console.log(`     → Begriffe erstellt (gesamt: ${totalCards})`);
            } catch (e: any) {
              console.error(`Error ${language} difficulty ${difficulty} for ${categoryName}:`, e.message);
            }

            // Rate limiting between difficulty levels
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        console.log(`✅ [${category.nameDE}] Fertig!`);
        // Longer pause between categories
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      console.log(`\n🎭 Regenerating pantomime terms...`);
      // Regenerate pantomime_universal terms by running the seed script
      try {
        const { execSync } = await import('child_process');
        execSync('npx tsx scripts/seed-pantomime.ts', {
          cwd: process.cwd(),
          stdio: 'inherit'
        });
        console.log('✅ Pantomime terms regenerated!');
      } catch (err) {
        console.error('❌ Failed to regenerate pantomime terms:', err);
      }

      console.log(`\n🎉 Bingo card generation complete! Total: ${totalCards} cards + pantomime terms`);
    })();
  } catch (error: any) {
    console.error('Bingo regeneration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Seed all categories at once
app.post('/api/seed-all-questions', async (req, res) => {
  try {
    const categories = await prisma.category.findMany();
    const results: { category: string; count: number }[] = [];

    for (const category of categories) {
      const existingCount = await prisma.seededQuestion.count({
        where: { categoryId: category.id }
      });

      if (existingCount < 100) {
        // Trigger seeding for this category
        console.log(`Starting seed for ${category.nameDE}...`);
        results.push({ category: category.nameDE, count: existingCount });
      } else {
        results.push({ category: category.nameDE, count: existingCount });
      }
    }

    res.json({ message: 'Seeding status checked', categories: results });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get questions for a session category (for players to fetch same questions as host)
app.get('/api/sessions/:sessionId/questions/:categoryId', async (req, res) => {
  try {
    const { sessionId, categoryId } = req.params;

    const questions = await prisma.question.findMany({
      where: { sessionId, categoryId },
      orderBy: { questionIndex: 'asc' }
    });

    res.json(questions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:id/answer', async (req, res) => {
  try {
    const { teamId, questionId, answerIndex } = req.body;
    const session = await prisma.gameSession.findUnique({ where: { id: req.params.id } });
    const question = await prisma.question.findUnique({ where: { id: questionId } });

    if (!session || !question) {
      return res.status(404).json({ error: 'Session or question not found' });
    }

    const isCorrect = answerIndex === question.correctIndex;

    // Check if already answered
    const existingAnswer = await prisma.playerAnswer.findFirst({
      where: { teamId, questionId }
    });
    if (existingAnswer) {
      return res.status(400).json({ error: 'Already answered' });
    }

    // Count existing correct answers for speed rank
    const correctAnswersCount = await prisma.playerAnswer.count({
      where: { questionId, isCorrect: true }
    });
    const speedRank = isCorrect ? correctAnswersCount + 1 : 0;

    // Calculate points based on speed
    let points = 0;
    if (isCorrect) {
      points = 100;
      if (speedRank === 1) points += 50;
      else if (speedRank === 2) points += 40;
      else if (speedRank === 3) points += 30;
      else if (speedRank === 4) points += 20;
      else if (speedRank === 5) points += 10;
    }

    const answer = await prisma.playerAnswer.create({
      data: {
        teamId,
        questionId,
        sessionId: session.id,
        answerIndex,
        isCorrect,
        speedRank,
        points
      }
    });

    debugLog('ANSWER_SUBMIT', `Answer submitted`, { teamId, questionId, answerIndex, isCorrect, speedRank, points });

    // Update team score
    if (isCorrect) {
      await prisma.team.update({
        where: { id: teamId },
        data: { score: { increment: points } }
      });
      debugLog('SCORE_UPDATE', `Team score updated`, { teamId, pointsAdded: points });
    }

    io.to(session.id).emit('answer-received', { teamId, speedRank });
    res.json({ answer, points, speedRank });
  } catch (error: any) {
    debugLog('ANSWER_ERROR', `Answer submission failed`, { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/results', async (req, res) => {
  try {
    const session = await prisma.gameSession.findUnique({
      where: { id: req.params.id },
      include: {
        teams: { orderBy: { score: 'desc' } },
        questions: true,
        answers: { include: { team: true } }
      }
    });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- AI TTS ---

app.post('/api/ai/tts', async (req, res) => {
  try {
    const { text, language } = req.body;
    const ai = await getGeminiClient();

    // Use German or Turkish voice based on language
    const voiceName = language === 'de' ? 'Kore' : 'Puck';

    console.log(`🔊 TTS request: "${text.substring(0, 50)}..." in ${language}`);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'], // Use string 'AUDIO' per docs
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (audioData) {
      console.log(`✅ TTS audio generated, length: ${audioData.length}`);
      res.json({ audio: audioData });
    } else {
      console.log(`⚠️ TTS no audio in response`);
      res.status(500).json({ error: 'No audio generated' });
    }
  } catch (error: any) {
    console.error(`❌ TTS error:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/roast', async (req, res) => {
  try {
    const { teams, language } = req.body;
    const ai = await getGeminiClient();

    const teamsInfo = teams.map((t: any) => `${t.secretName}: ${t.score} Punkte`).join(', ');
    const prompt = language === 'de'
      ? `Du bist ein zynischer, witziger Silvester-Showmaster. Kommentiere kurz und knackig (max 2 Sätze) den aktuellen Spielstand: ${teamsInfo}`
      : `Sen iğneleyici ve komik bir yılbaşı sunucususun. Mevcut skor tablosunu kısa ve esprili bir şekilde yorumla (max 2 cümle): ${teamsInfo}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== SOCKET.IO ====================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-session', async (joinCode: string) => {
    const session = await prisma.gameSession.findUnique({
      where: { joinCode }
    });
    if (session) {
      socket.join(session.id);
      console.log(`Client ${socket.id} joined session ${joinCode}`);
    }
  });

  socket.on('start-game', async (sessionId: string) => {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { phase: 'GAME_SELECT', currentRound: 1 }
    });
    io.to(sessionId).emit('game-started');
    io.to(sessionId).emit('phase-changed', { phase: 'GAME_SELECT' });
  });

  socket.on('select-game', async (data: { sessionId: string; gameType: 'QUIZ' | 'BINGO' }) => {
    const { sessionId, gameType } = data;
    // BINGO goes to LOBBY_DRAFT first (Team Draft), then to BINGO after teams are confirmed
    const newPhase = gameType === 'QUIZ' ? 'CATEGORY_SELECT' : 'LOBBY_DRAFT';

    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        activeGame: gameType,
        phase: newPhase
      }
    });

    io.to(sessionId).emit('phase-changed', { phase: newPhase });
    console.log(`🎮 Game selected: ${gameType}, phase now: ${newPhase}`);
  });

  socket.on('next-question', async (data: { sessionId: string; questionIndex: number }) => {
    await prisma.gameSession.update({
      where: { id: data.sessionId },
      data: { currentQuestion: data.questionIndex }
    });
    io.to(data.sessionId).emit('question-changed', { questionIndex: data.questionIndex });
  });

  socket.on('start-break', async (sessionId: string) => {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { phase: 'BREAK' }
    });
    io.to(sessionId).emit('break-started', { duration: 180 }); // 3 minutes
  });

  socket.on('end-break', async (sessionId: string) => {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { phase: 'QUIZ' }
    });
    io.to(sessionId).emit('break-ended');
  });

  socket.on('next-category', async (data: { sessionId: string; categoryIndex: number }) => {
    await prisma.gameSession.update({
      where: { id: data.sessionId },
      data: { currentCategory: data.categoryIndex, currentQuestion: 0 }
    });
    io.to(data.sessionId).emit('category-changed', { categoryIndex: data.categoryIndex });
  });

  socket.on('reveal-answers', async (sessionId: string) => {
    console.log('🏁 [Server] reveal-answers received for session:', sessionId);

    // Update session phase
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { showAnswers: true, phase: 'LEADERBOARD' }
    });

    // Fetch fresh team data with updated scores
    const teams = await prisma.team.findMany({
      where: { sessionId },
      orderBy: { score: 'desc' }
    });

    debugLog('REVEAL_ANSWERS', 'Fetched teams with scores', teams.map(t => ({ id: t.id, realName: t.realName, secretName: t.secretName, score: t.score })));
    debugLog('REVEAL_ANSWERS', 'Emitting answers-revealed with teams to session', { sessionId, teamCount: teams.length });

    // Include fresh team data in the event
    io.to(sessionId).emit('answers-revealed', { teams });
    debugLog('REVEAL_ANSWERS', 'answers-revealed emitted', { sessionId });
  });

  // Real-time category toggle sync
  socket.on('toggle-category', (data: { sessionId: string; categoryId: string; isSelected: boolean }) => {
    // Broadcast to all players in session except sender
    socket.to(data.sessionId).emit('category-toggled', {
      categoryId: data.categoryId,
      isSelected: data.isSelected
    });
  });

  // Broadcast questions from host to all players
  socket.on('broadcast-questions', (data: { sessionId: string; questions: any[] }) => {
    console.log(`Broadcasting ${data.questions.length} questions to session ${data.sessionId}`);
    // Send to all players in session except host
    socket.to(data.sessionId).emit('questions-broadcast', {
      questions: data.questions
    });
  });

  // ========== DEBUG LOGGING (from client) ==========
  socket.on('debug-log', (data: string) => {
    console.log('🔍 CLIENT DEBUG:', data);
  });

  // ========== TEAM DRAFT EVENTS ==========

  // Player joins a faction (Team A or B)
  socket.on('join-faction', async (data: { sessionId: string; teamId: string; faction: 'A' | 'B' }) => {
    console.log(`🎯 Team ${data.teamId} joining faction ${data.faction}`);

    try {
      // Update team faction in DB
      const updatedTeam = await prisma.team.update({
        where: { id: data.teamId },
        data: { faction: data.faction }
      });

      // Get all teams for this session and broadcast
      const teams = await prisma.team.findMany({
        where: { sessionId: data.sessionId }
      });

      io.to(data.sessionId).emit('teams-updated', { teams });
    } catch (e) {
      console.error('Failed to update faction:', e);
    }
  });

  // Host confirms teams and starts Bingo
  socket.on('confirm-teams', async (data: { sessionId: string; difficulty: number }) => {
    console.log(`✅ Teams confirmed for session ${data.sessionId} with difficulty ${data.difficulty}`);

    try {
      // Save difficulty to session
      await prisma.gameSession.update({
        where: { id: data.sessionId },
        data: {
          phase: 'BINGO',
          bingoDifficulty: data.difficulty
        }
      });

      io.to(data.sessionId).emit('phase-changed', { phase: 'BINGO' });
    } catch (e) {
      console.error('Failed to confirm teams:', e);
    }
  });

  // ========== BINGO GAME EVENTS ==========

  // Categories for Bingo grid
  const BINGO_GRID_CATEGORIES = [
    { id: 'tuerkei', icon: '🇹🇷', image: '/images/categories/tuerkei.png' },
    { id: 'musik_hits', icon: '🎵', image: '/images/categories/musik_hits.png' },
    { id: 'filme_serien', icon: '🎬', image: '/images/categories/filme_serien.png' },
    { id: 'sport', icon: '⚽', image: '/images/categories/sport.png' },
    { id: 'prominente', icon: '⭐', image: '/images/categories/prominente.png' },
    { id: 'tech_gaming', icon: '🎮', image: '/images/categories/tech_gaming.png' },
    { id: 'popkultur', icon: '📱', image: '/images/categories/popkultur.png' },
    { id: 'essen_trinken', icon: '🍕', image: '/images/categories/essen_trinken.png' },
    { id: 'silvester', icon: '🎆', image: '/images/categories/silvester.png' },
    { id: 'oesterreich', icon: '🇦🇹', image: '/images/categories/oesterreich.png' },
    { id: 'weltgeschehen', icon: '🌍', image: '/images/categories/weltgeschehen.png' },
    { id: 'wissenschaft', icon: '🔬', image: '/images/categories/wissenschaft.png' },
  ];

  const GRID_ACTIVITY_TYPES = ['EXPLAIN', 'PANTOMIME', 'DRAW'];

  // Initialize synchronized grid for all players
  socket.on('bingo-init-grid', async (data: { sessionId: string }) => {
    console.log(`🎲 Initializing Bingo grid for session ${data.sessionId}`);

    // Shuffle categories and pick 9
    const shuffled = [...BINGO_GRID_CATEGORIES].sort(() => Math.random() - 0.5).slice(0, 9);

    // Create balanced activity types: 3 of each type for 9 cells
    const balancedActivityTypes = [
      'EXPLAIN', 'EXPLAIN', 'EXPLAIN',
      'PANTOMIME', 'PANTOMIME', 'PANTOMIME',
      'DRAW', 'DRAW', 'DRAW'
    ].sort(() => Math.random() - 0.5); // Shuffle the types

    // Create grid with balanced activity types
    const grid = shuffled.map((cat, index) => ({
      category: cat.id,
      categoryIcon: cat.icon,
      categoryImage: cat.image,
      type: balancedActivityTypes[index],
      status: 'empty',
      wonByTeamId: null
    }));

    try {
      // Get teams for this session to select first performer
      const session = await prisma.gameSession.findUnique({
        where: { id: data.sessionId },
        include: { teams: true }
      });

      const teams = session?.teams || [];
      const factionAPlayers = teams.filter(t => t.faction === 'A');
      const factionBPlayers = teams.filter(t => t.faction === 'B');

      // Pick random first performer from Faction A (since they start)
      const firstPerformerId = factionAPlayers.length > 0
        ? factionAPlayers[Math.floor(Math.random() * factionAPlayers.length)].id
        : null;

      console.log(`🎭 First performer selected: ${firstPerformerId}`);

      // Store grid in session bingoState with performer info
      const bingoState = {
        grid,
        currentTurnFaction: 'A',
        currentPerformerId: firstPerformerId,
        usedPerformersA: firstPerformerId ? [firstPerformerId] : [],
        usedPerformersB: []
      };

      await prisma.gameSession.update({
        where: { id: data.sessionId },
        data: { bingoState: JSON.stringify(bingoState) }
      });

      // Broadcast to all players with performer info
      io.to(data.sessionId).emit('bingo-grid-sync', bingoState);
      console.log(`📡 Grid synced to all players in ${data.sessionId}`);
    } catch (e) {
      console.error('Failed to save bingo state:', e);
    }
  });

  // Request current grid state (for late joiners)
  socket.on('bingo-request-grid', async (data: { sessionId: string }) => {
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: data.sessionId }
      });
      if (session?.bingoState) {
        const state = JSON.parse(session.bingoState);
        socket.emit('bingo-grid-sync', state);
        console.log(`📡 Sent existing grid to player in session ${data.sessionId}`);
      } else {
        // No grid yet - notify client to wait and retry
        console.log(`⏳ No grid yet for session ${data.sessionId}, telling client to wait...`);
        socket.emit('bingo-grid-pending', { sessionId: data.sessionId });
      }
    } catch (e) {
      console.error('Failed to fetch bingo state:', e);
      socket.emit('bingo-grid-error', { error: 'Failed to fetch grid state' });
    }
  });

  // Team selects a cell - fetch real card from DB (NEVER show same term twice!)
  socket.on('bingo-select-cell', async (data: {
    sessionId: string;
    cellIndex: number;
    teamId: string;
    category: string;
    type: string;
    language: string;
  }) => {
    console.log(`🎲 Bingo cell ${data.cellIndex} selected by team ${data.teamId}`);

    try {
      // Get session to retrieve used terms
      const session = await prisma.gameSession.findUnique({
        where: { id: data.sessionId }
      });

      // Parse bingoState to get usedTermIds
      let usedTermIds: string[] = [];
      if (session?.bingoState) {
        try {
          const state = JSON.parse(session.bingoState);
          usedTermIds = state.usedTermIds || [];
        } catch (e) {
          console.error('Failed to parse bingoState:', e);
        }
      }

      // For PANTOMIME type, always use pantomime_universal category
      const categoryToUse = data.type === 'PANTOMIME' ? 'pantomime_universal' : data.category;

      // Fetch random card from DB matching category and type, EXCLUDING already used terms
      const cards = await prisma.bingoCard.findMany({
        where: {
          category: categoryToUse,
          type: data.type,
          language: data.language,
          // Exclude already used terms by ID
          id: {
            notIn: usedTermIds
          }
        }
      });

      if (cards.length === 0) {
        console.log(`⚠️ No UNUSED cards found for category=${categoryToUse}, type=${data.type}, lang=${data.language}`);
        // Fallback: get any card even if used (last resort)
        const fallbackCards = await prisma.bingoCard.findMany({
          where: {
            category: categoryToUse,
            type: data.type,
            language: data.language
          }
        });

        if (fallbackCards.length === 0) {
          io.to(data.sessionId).emit('bingo-cell-selected', {
            cellIndex: data.cellIndex,
            teamId: data.teamId,
            card: {
              term: `Kein Begriff für ${data.category}`,
              forbiddenWords: [],
              type: data.type,
              category: data.category
            }
          });
          return;
        }

        // Use fallback card
        const randomCard = fallbackCards[Math.floor(Math.random() * fallbackCards.length)];
        const forbiddenWords = randomCard.forbiddenWords ? JSON.parse(randomCard.forbiddenWords) : [];
        console.log(`⚠️ Using fallback card (may be repeated): "${randomCard.term}"`);

        io.to(data.sessionId).emit('bingo-cell-selected', {
          cellIndex: data.cellIndex,
          teamId: data.teamId,
          card: {
            term: randomCard.term,
            forbiddenWords,
            type: randomCard.type,
            category: randomCard.category,
            hint: randomCard.hint || undefined,
            difficulty: randomCard.difficulty || 3
          }
        });
        return;
      }

      // Pick random card from UNUSED cards
      const randomCard = cards[Math.floor(Math.random() * cards.length)];
      const forbiddenWords = randomCard.forbiddenWords
        ? JSON.parse(randomCard.forbiddenWords)
        : [];

      console.log(`✅ Found NEW card: "${randomCard.term}" with ${forbiddenWords.length} forbidden words (${usedTermIds.length} terms already used)`);

      // Add this term to usedTermIds and save back to session
      usedTermIds.push(randomCard.id);
      const currentState = session?.bingoState ? JSON.parse(session.bingoState) : {};
      await prisma.gameSession.update({
        where: { id: data.sessionId },
        data: {
          bingoState: JSON.stringify({
            ...currentState,
            usedTermIds
          })
        }
      });

      io.to(data.sessionId).emit('bingo-cell-selected', {
        cellIndex: data.cellIndex,
        teamId: data.teamId,
        card: {
          term: randomCard.term,
          forbiddenWords,
          type: randomCard.type,
          category: randomCard.category,
          hint: randomCard.hint || undefined,
          difficulty: randomCard.difficulty || 3
        }
      });
    } catch (e) {
      console.error('Failed to fetch bingo card:', e);
    }
  });

  // Host starts the round (60s timer begins)
  socket.on('bingo-start-round', (data: { sessionId: string }) => {
    console.log(`▶️ Bingo round started in session ${data.sessionId}`);
    io.to(data.sessionId).emit('bingo-round-started');
  });

  // Player presses buzzer (cell gets LOCKED)
  socket.on('bingo-buzz', (data: { sessionId: string; teamId: string; teamName?: string }) => {
    console.log(`🚨 BUZZER! ${data.teamName || data.teamId} buzzed!`);
    io.to(data.sessionId).emit('bingo-buzzed', {
      teamId: data.teamId,
      teamName: data.teamName || 'Unknown'
    });
  });

  // Host marks cell as correct (faction wins the cell)
  socket.on('bingo-correct', async (data: { sessionId: string; cellIndex: number; faction: 'A' | 'B' }) => {
    console.log(`✅ Bingo cell ${data.cellIndex} won by faction ${data.faction}`);

    // Get session to find all players in the winning faction
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: data.sessionId },
        include: { teams: true }
      });

      if (session) {
        // Update scores for ALL players in the winning faction
        const winningFactionPlayers = session.teams.filter(t => t.faction === data.faction);
        for (const player of winningFactionPlayers) {
          await prisma.team.update({
            where: { id: player.id },
            data: { score: { increment: 100 } }
          });
        }
        console.log(`📈 Awarded 100 points to ${winningFactionPlayers.length} players in faction ${data.faction}`);
      }
    } catch (e) {
      console.error('Failed to update scores:', e);
    }

    io.to(data.sessionId).emit('bingo-correct', {
      cellIndex: data.cellIndex,
      faction: data.faction // Send faction instead of teamId
    });
  });

  // Host marks cell as fail (wrong answer or buzzer) -> cell gets LOCKED
  socket.on('bingo-fail', (data: { sessionId: string; cellIndex: number }) => {
    console.log(`❌ Bingo cell ${data.cellIndex} locked`);
    io.to(data.sessionId).emit('bingo-cell-locked', { cellIndex: data.cellIndex });
  });

  // Time ran out -> cell stays empty for next attempt
  socket.on('bingo-timeout', (data: { sessionId: string }) => {
    console.log(`⏰ Bingo round timed out in session ${data.sessionId}`);
    io.to(data.sessionId).emit('bingo-timeout');
  });

  // Advance to next turn - switch faction and select new performer
  socket.on('bingo-advance-turn', async (data: { sessionId: string }) => {
    console.log(`⏭️ Advancing turn in session ${data.sessionId}`);

    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: data.sessionId },
        include: { teams: true }
      });

      if (!session?.bingoState) {
        console.error('No bingo state found for session');
        return;
      }

      const state = JSON.parse(session.bingoState);
      const teams = session.teams;

      // Switch faction
      const newFaction = state.currentTurnFaction === 'A' ? 'B' : 'A';

      // Get players from new faction
      const newFactionPlayers = teams.filter(t => t.faction === newFaction);
      const usedPerformers = newFaction === 'A' ? (state.usedPerformersA || []) : (state.usedPerformersB || []);

      // Find players who haven't performed yet
      let availablePlayers = newFactionPlayers.filter(p => !usedPerformers.includes(p.id));

      // If everyone has performed, reset the cycle
      if (availablePlayers.length === 0) {
        console.log(`🔄 All players in faction ${newFaction} have performed, resetting cycle`);
        availablePlayers = newFactionPlayers;
        // Clear used performers for this faction
        if (newFaction === 'A') {
          state.usedPerformersA = [];
        } else {
          state.usedPerformersB = [];
        }
      }

      // Pick random performer from available players
      const newPerformerId = availablePlayers.length > 0
        ? availablePlayers[Math.floor(Math.random() * availablePlayers.length)].id
        : null;

      // Add to used performers list
      if (newPerformerId) {
        if (newFaction === 'A') {
          state.usedPerformersA = [...(state.usedPerformersA || []), newPerformerId];
        } else {
          state.usedPerformersB = [...(state.usedPerformersB || []), newPerformerId];
        }
      }

      // Update state
      state.currentTurnFaction = newFaction;
      state.currentPerformerId = newPerformerId;

      console.log(`🎭 New turn: Faction ${newFaction}, Performer: ${newPerformerId}`);

      // Save to database
      await prisma.gameSession.update({
        where: { id: data.sessionId },
        data: { bingoState: JSON.stringify(state) }
      });

      // Broadcast to all clients
      io.to(data.sessionId).emit('bingo-turn-advanced', {
        currentTurnFaction: newFaction,
        currentPerformerId: newPerformerId,
        usedPerformersA: state.usedPerformersA,
        usedPerformersB: state.usedPerformersB
      });
    } catch (e) {
      console.error('Failed to advance turn:', e);
    }
  });

  // Bingo winner detected (3 in a row!)
  socket.on('bingo-winner', async (data: { sessionId: string; teamId: string }) => {
    console.log(`🏆 BINGO! Team ${data.teamId} wins!`);

    // Award bonus points for winning
    await prisma.team.update({
      where: { id: data.teamId },
      data: { score: { increment: 500 } }
    });

    io.to(data.sessionId).emit('bingo-winner', { teamId: data.teamId });
  });

  // ========== GOLDEN SHOWDOWN EVENTS ==========

  // Start Golden Showdown (triggered when grid full + close game)
  socket.on('showdown-start', async (data: {
    sessionId: string;
    factionA: 'A' | 'B';
    factionB: 'A' | 'B';
    factionACells?: number;
    factionBCells?: number;
  }) => {
    console.log(`🥇 GOLDEN SHOWDOWN! Faction A (${data.factionACells || '?'} cells) vs Faction B (${data.factionBCells || '?'} cells)`);

    try {
      // Fetch hard difficulty cards for the showdown (prefer difficulty 3+)
      let showdownCards = await prisma.bingoCard.findMany({
        where: {
          difficulty: { gte: 3 } // Hard cards (difficulty 3+)
        },
        take: 10
      });

      // Fallback: if no hard cards, get ANY cards
      if (showdownCards.length < 3) {
        console.log('⚠️ Not enough hard cards, falling back to any cards');
        showdownCards = await prisma.bingoCard.findMany({
          take: 10
        });
      }

      // Shuffle and pick 3 (or less if not enough cards)
      const shuffledCards = showdownCards.sort(() => Math.random() - 0.5).slice(0, 3);

      // Format cards for frontend
      const cards = shuffledCards.map((card, index) => ({
        round: index + 1,
        term: card.term,
        hint: card.hint,
        forbiddenWords: card.forbiddenWords ? JSON.parse(card.forbiddenWords) : [],
        category: card.category,
        // Alternate types for variety, prefer PANTOMIME and DRAW
        type: index === 2 ? 'PANTOMIME' : (index % 2 === 0 ? 'DRAW' : 'PANTOMIME')
      }));

      // Random first performer
      const firstPerformer: 'A' | 'B' = Math.random() > 0.5 ? 'A' : 'B';

      console.log(`🎴 Showdown cards prepared:`, cards.map(c => c.term));
      console.log(`🎭 First performer: Faction ${firstPerformer}`);

      io.to(data.sessionId).emit('showdown-started', {
        factionA: 'A',
        factionB: 'B',
        firstPerformer,
        score: { a: 0, b: 0 },
        round: 1,
        cards, // All 3 showdown cards
        factionACells: data.factionACells || 0,
        factionBCells: data.factionBCells || 0
      });
    } catch (e) {
      console.error('Failed to start showdown:', e);
    }
  });

  // Start a showdown round with a card
  socket.on('showdown-round-start', (data: {
    sessionId: string;
    round: number;
    card: { term: string; forbiddenWords: string[]; type: string; category: string };
    performer: 'A' | 'B'
  }) => {
    console.log(`🎯 Showdown round ${data.round} started`);
    io.to(data.sessionId).emit('showdown-round-started', {
      round: data.round,
      card: data.card,
      performer: data.performer
    });
  });

  // Showdown correct - performer wins the point
  socket.on('showdown-correct', (data: { sessionId: string; round: number; winner: 'A' | 'B' }) => {
    console.log(`✅ Showdown round ${data.round} won by Team ${data.winner}`);
    io.to(data.sessionId).emit('showdown-point', { winner: data.winner, round: data.round });
  });

  // Showdown fail - opponent wins the point (sudden death!)
  socket.on('showdown-fail', (data: { sessionId: string; round: number; performer: 'A' | 'B' }) => {
    const winner = data.performer === 'A' ? 'B' : 'A';
    console.log(`❌ Showdown round ${data.round} - Performer ${data.performer} failed, ${winner} wins!`);
    io.to(data.sessionId).emit('showdown-point', { winner, round: data.round });
  });

  // Showdown final winner
  socket.on('showdown-winner', async (data: { sessionId: string; faction: 'A' | 'B' }) => {
    console.log(`🏆 SHOWDOWN WINNER! Faction ${data.faction}`);

    try {
      // Award mega bonus to all players in the winning faction
      await prisma.team.updateMany({
        where: {
          sessionId: data.sessionId,
          faction: data.faction
        },
        data: { score: { increment: 500 } } // 500 bonus for showdown victory
      });

      io.to(data.sessionId).emit('showdown-finished', { winnerFaction: data.faction });
    } catch (e) {
      console.error('Failed to update showdown winner scores:', e);
    }
  });

  // Emoji reactions during quiz
  socket.on('send-reaction', (data: { sessionId: string; emoji: string; teamName: string }) => {
    io.to(data.sessionId).emit('reaction-received', {
      emoji: data.emoji,
      teamName: data.teamName,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${socket.id}`
    });
  });

  // Short messages to all players
  socket.on('send-message', (data: { sessionId: string; message: string; teamName: string }) => {
    io.to(data.sessionId).emit('message-received', {
      message: data.message,
      teamName: data.teamName,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${socket.id}`
    });
  });

  // Request scores for anonymous scoreboard - broadcast to ALL players
  socket.on('request-scores', async (sessionId: string) => {
    const teams = await prisma.team.findMany({
      where: { sessionId },
      select: { score: true }
    });
    // Sort scores descending for display (anonymized)
    const sortedScores = teams.map(t => t.score).sort((a, b) => b - a);
    // Broadcast to ALL players in the session, not just the requester
    io.to(sessionId).emit('scores-received', { scores: sortedScores });
    // Also tell all players to show the scoreboard
    io.to(sessionId).emit('show-scoreboard');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// ==================== START SERVER ====================

async function start() {
  await seedDatabase();

  httpServer.listen(PORT, () => {
    console.log(`🎉 Silvester Party Server running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);

export { app, io, prisma };
