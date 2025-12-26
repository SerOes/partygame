/**
 * Seed Bingo Cards for Chaos Bingo
 * Generates Taboo-style content for 12 categories in DE and TR
 * 
 * Usage: npx ts-node scripts/seed-bingo.ts
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Encryption key must match server/index.ts
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'silvester-party-app-secret-key-32';

function decrypt(text: string): string {
    try {
        const parts = text.split(':');
        const iv = Buffer.from(parts.shift()!, 'hex');
        const encryptedText = parts.join(':');
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        console.log(`✅ Decryption successful: starts with ${decrypted.substring(0, 10)}...`);
        return decrypted;
    } catch (error) {
        console.error(`❌ Decryption failed:`, error);
        return text; // Return original if decryption fails
    }
}

async function getApiKey(): Promise<string | null> {
    const setting = await prisma.settings.findUnique({
        where: { key: 'gemini_api_key' }
    });
    if (setting?.value) {
        // Try to decrypt if it looks encrypted (contains :)
        const isEncrypted = setting.value.includes(':');
        const value = isEncrypted ? decrypt(setting.value) : setting.value;
        console.log(`🔑 API Key from DB: encrypted=${isEncrypted}, length=${value.length}, starts with: ${value.substring(0, 10)}...`);
        return value;
    }
    // Fallback to environment variable
    const envKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (envKey) {
        console.log(`🔑 API Key from ENV: length=${envKey.length}, starts with: ${envKey.substring(0, 10)}...`);
        return envKey;
    }
    return null;
}

const CATEGORIES = [
    { id: 'filme_serien', nameDE: 'Filme & Serien 2025', nameTR: 'Filmler & Diziler 2025', icon: '🎬' },
    { id: 'musik_hits', nameDE: 'Musik & Hits 2025', nameTR: 'Müzik & Hitlar 2025', icon: '🎵' },
    { id: 'sport', nameDE: 'Sport 2025', nameTR: 'Spor 2025', icon: '⚽' },
    { id: 'weltgeschehen', nameDE: 'Weltgeschehen 2025', nameTR: 'Dünya Olayları 2025', icon: '🌍' },
    { id: 'oesterreich', nameDE: 'Österreich Spezial', nameTR: 'Avusturya Özel', icon: '🇦🇹' },
    { id: 'tuerkei', nameDE: 'Türkei Spezial', nameTR: 'Türkiye Özel', icon: '🇹🇷' },
    { id: 'tech_gaming', nameDE: 'Tech & Gaming', nameTR: 'Teknoloji & Oyunlar', icon: '🎮' },
    { id: 'popkultur', nameDE: 'Popkultur & Memes', nameTR: 'Popüler Kültür & Memeler', icon: '📱' },
    { id: 'prominente', nameDE: 'Prominente & Stars', nameTR: 'Ünlüler & Yıldızlar', icon: '⭐' },
    { id: 'essen_trinken', nameDE: 'Essen & Trinken', nameTR: 'Yemek & İçecek', icon: '🍕' },
    { id: 'silvester', nameDE: 'Silvester & Traditionen', nameTR: 'Yılbaşı & Gelenekler', icon: '🎆' },
    { id: 'wissenschaft', nameDE: 'Wissenschaft 2025', nameTR: 'Bilim 2025', icon: '🔬' },
];

const ACTIVITY_TYPES = ['EXPLAIN', 'PANTOMIME', 'DRAW']; // No HUM

async function generateCardsForCategory(
    ai: GoogleGenAI,
    category: typeof CATEGORIES[0],
    language: 'de' | 'tr',
    count: number = 20
): Promise<{ term: string; type: string; forbiddenWords: string[]; difficulty: number; hint: string }[]> {
    const categoryName = language === 'de' ? category.nameDE : category.nameTR;

    const prompt = language === 'de'
        ? `Generiere ${count} Begriffe für ein Party-Spiel im Stil von "Tabu" oder "Activity".
       Kategorie: "${categoryName}"
       
       Für jeden Begriff:
       1. Ein lustiger, bekannter Begriff passend zur Kategorie (z.B. Filmtitel, Prominenter, Trend)
       2. 5 verbotene Wörter, die man beim Erklären NICHT benutzen darf
       3. Ein Schwierigkeitsgrad von 1-5 (1=sehr einfach, 5=sehr schwer)
       4. Ein Hinweis (kurzer Satz, der nach 60 Sekunden angezeigt wird, z.B. "Hat mit Musik zu tun")
       
       Mische die Schwierigkeiten gleichmäßig:
       - 1-2: Einfache, sehr bekannte Begriffe (z.B. "Pizza", "Fußball")
       - 3: Mittelschwer, die meisten kennen es (z.B. "Taylor Swift", "Netflix")
       - 4-5: Schwieriger, weniger bekannt oder abstrakt (z.B. "Kryptowährung", "Hyperloop")
       
       Mache die Begriffe aktuell (2024/2025) und lustig für eine Silvesterparty.`
        : `${count} adet parti oyunu için terim oluştur ("Tabu" veya "Activity" tarzında).
       Kategori: "${categoryName}"
       
       Her terim için:
       1. Kategoriye uygun eğlenceli, bilinen bir terim
       2. Açıklarken KULLANILMAMASI gereken 5 yasak kelime
       3. 1-5 arası zorluk derecesi (1=çok kolay, 5=çok zor)
       4. Bir ipucu (60 saniye sonra gösterilecek kısa cümle)
       
       Zorlukları eşit dağıt ve güncel (2024/2025) terimleri kullan.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            term: { type: Type.STRING },
                            forbiddenWords: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING }
                            },
                            difficulty: { type: Type.NUMBER },
                            hint: { type: Type.STRING }
                        },
                        required: ['term', 'forbiddenWords', 'difficulty', 'hint']
                    }
                }
            }
        });

        const cards = JSON.parse(response.text || '[]');

        // Assign random activity types
        return cards.map((card: { term: string; forbiddenWords: string[]; difficulty: number; hint: string }) => ({
            ...card,
            difficulty: Math.min(5, Math.max(1, Math.round(card.difficulty))), // Clamp to 1-5
            type: ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)]
        }));
    } catch (error) {
        console.error(`Error generating cards for ${categoryName}:`, error);
        return [];
    }
}

async function seedBingoCards() {
    console.log('🎲 Starting Bingo Card Seeding...\n');

    const apiKey = await getApiKey();
    if (!apiKey) {
        console.error('❌ API key not found in database or environment');
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });

    // Clear existing cards
    console.log('🧹 Clearing existing BingoCards...');
    await prisma.bingoCard.deleteMany();

    let totalCards = 0;
    const CARDS_PER_CATEGORY = 85; // 12 categories × 2 languages × 85 ≈ 2040 cards

    for (const category of CATEGORIES) {
        console.log(`\n📦 Processing: ${category.icon} ${category.nameDE}`);

        // Generate German cards
        console.log('  🇩🇪 Generating German cards...');
        const deCards = await generateCardsForCategory(ai, category, 'de', CARDS_PER_CATEGORY);

        for (const card of deCards) {
            await prisma.bingoCard.create({
                data: {
                    category: category.id,
                    term: card.term,
                    type: card.type,
                    forbiddenWords: JSON.stringify(card.forbiddenWords),
                    language: 'de',
                    difficulty: card.difficulty,
                    hint: card.hint
                }
            });
        }
        console.log(`     → ${deCards.length} German cards created`);
        totalCards += deCards.length;

        // Generate Turkish cards
        console.log('  🇹🇷 Generating Turkish cards...');
        const trCards = await generateCardsForCategory(ai, category, 'tr', CARDS_PER_CATEGORY);

        for (const card of trCards) {
            await prisma.bingoCard.create({
                data: {
                    category: category.id,
                    term: card.term,
                    type: card.type,
                    forbiddenWords: JSON.stringify(card.forbiddenWords),
                    language: 'tr',
                    difficulty: card.difficulty,
                    hint: card.hint
                }
            });
        }
        console.log(`     → ${trCards.length} Turkish cards created`);
        totalCards += trCards.length;

        // Rate limiting - wait between categories
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\n✅ Seeding complete! Total cards: ${totalCards}`);
}

seedBingoCards()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
