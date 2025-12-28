/**
 * Seed Bingo Cards for Chaos Bingo - IMPROVED VERSION
 * Generates Taboo-style content with PROPER difficulty levels
 * 
 * Usage: npx ts-node scripts/seed-bingo-v2.ts
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
        return decrypted;
    } catch (error) {
        console.error(`❌ Decryption failed:`, error);
        return text;
    }
}

async function getApiKey(): Promise<string | null> {
    const setting = await prisma.settings.findUnique({
        where: { key: 'gemini_api_key' }
    });
    if (setting?.value) {
        const isEncrypted = setting.value.includes(':');
        return isEncrypted ? decrypt(setting.value) : setting.value;
    }
    return process.env.GEMINI_API_KEY || process.env.API_KEY || null;
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

const ACTIVITY_TYPES = ['EXPLAIN', 'PANTOMIME', 'DRAW'];

// Difficulty level definitions with examples
const DIFFICULTY_DEFINITIONS = {
    de: {
        1: {
            name: 'SEHR LEICHT',
            description: 'Kinderleicht - ein 8-jähriges Kind kennt es sofort',
            examples: ['Pizza', 'Hund', 'Handy', 'Fußball', 'Weihnachten', 'Schlafen', 'Haus', 'Sonne'],
            rules: 'Alltägliche Objekte, 1-2 Silben, konkrete Begriffe, keine abstrakten Konzepte'
        },
        2: {
            name: 'LEICHT',
            description: 'Sehr bekannt - jeder Teenager kennt es sicher',
            examples: ['Supermarkt', 'Flugzeug', 'Geburtstag', 'Jogging', 'Fahrrad', 'Regenbogen'],
            rules: 'Bekannte Alltagsbegriffe, kann zusammengesetzt sein, kein Spezialwissen nötig'
        },
        3: {
            name: 'MITTEL',
            description: 'Bekannt - die meisten Erwachsenen kennen es',
            examples: ['Streaming-Dienst', 'Silvesterrakete', 'Yoga', 'Eiffelturm', 'Taylor Swift'],
            rules: 'Pop-Kultur, bekannte Trends, berühmte Persönlichkeiten, Mainstream-Themen'
        },
        4: {
            name: 'SCHWER',
            description: 'Spezifisch - braucht etwas Wissen oder Überlegung',
            examples: ['Inflation', 'Podcast', 'Fechten', 'Astronaut', 'Klimawandel'],
            rules: 'Abstraktere Konzepte, spezifische Aktivitäten, Nischen-Trends, Technologie-Begriffe'
        },
        5: {
            name: 'SEHR SCHWER',
            description: 'Anspruchsvoll - braucht Spezialwissen oder ist schwer darstellbar',
            examples: ['Kryptowährung', 'Metaverse', 'Dirigieren', 'DNA-Doppelhelix', 'Quantencomputer'],
            rules: 'Abstrakte Konzepte, Fachbegriffe, schwer darzustellende Aktionen, komplexe Zusammenhänge'
        }
    },
    tr: {
        1: {
            name: 'ÇOK KOLAY',
            description: '8 yaşında bir çocuk bile bilir',
            examples: ['Pizza', 'Köpek', 'Telefon', 'Futbol', 'Uyumak', 'Ev', 'Güneş'],
            rules: 'Günlük nesneler, 1-2 hece, somut kavramlar'
        },
        2: {
            name: 'KOLAY',
            description: 'Her genç bilir',
            examples: ['Market', 'Uçak', 'Doğum günü', 'Koşmak', 'Bisiklet'],
            rules: 'Bilinen günlük terimler, özel bilgi gerekmez'
        },
        3: {
            name: 'ORTA',
            description: 'Çoğu yetişkin bilir',
            examples: ['Streaming platformu', 'Yoga', 'Eyfel Kulesi', 'Taylor Swift'],
            rules: 'Pop kültür, bilinen trendler, ünlü kişiler'
        },
        4: {
            name: 'ZOR',
            description: 'Biraz bilgi veya düşünme gerektirir',
            examples: ['Enflasyon', 'Podcast', 'Eskrim', 'Astronot'],
            rules: 'Soyut kavramlar, spesifik aktiviteler, niş trendler'
        },
        5: {
            name: 'ÇOK ZOR',
            description: 'Uzmanlık bilgisi gerektirir veya göstermesi zor',
            examples: ['Kripto para', 'Metaverse', 'DNA çift sarmalı', 'Kuantum bilgisayar'],
            rules: 'Soyut kavramlar, teknik terimler, karmaşık konular'
        }
    }
};

function buildPromptForDifficulty(
    categoryName: string,
    language: 'de' | 'tr',
    difficulty: number,
    count: number
): string {
    const def = DIFFICULTY_DEFINITIONS[language][difficulty as keyof typeof DIFFICULTY_DEFINITIONS['de']];

    if (language === 'de') {
        return `Du generierst ${count} Begriffe für ein Partyspiel im Tabu/Activity-Stil.

KATEGORIE: "${categoryName}"
SCHWIERIGKEIT: Stufe ${difficulty} - ${def.name}

### WICHTIGE REGELN FÜR STUFE ${difficulty}:
- ${def.description}
- Beispiele passender Begriffe: ${def.examples.join(', ')}
- Regel: ${def.rules}

### AUSGABE-FORMAT (für JEDEN der ${count} Begriffe):
1. "term": Der Begriff (passend zur Stufe ${difficulty}!)
2. "forbiddenWords": GENAU 5 Wörter, die beim Erklären NICHT benutzt werden dürfen
   - Die verbotenen Wörter sollten die offensichtlichsten Beschreibungen sein
   - Sie machen das Erklären schwieriger
3. "hint": Ein hilfreicher Hinweis (1 kurzer Satz, wird nach 60 Sekunden angezeigt)
   - Der Hint soll helfen, ohne die Antwort zu verraten
   - Beispiel: "Hat mit Musik zu tun" oder "Ist ein Tier"

### QUALITÄTSKRITERIEN:
- Begriffe müssen zur Kategorie "${categoryName}" passen
- Begriffe müssen GENAU zur Schwierigkeit Stufe ${difficulty} passen (${def.name})
- Keine zu ähnlichen Begriffe
- Lustig und partygeeignet für Silvester 2024/2025
- Aktuelle Trends wenn passend

Generiere jetzt ${count} Begriffe als JSON Array:`;
    } else {
        return `${count} adet parti oyunu terimi oluştur (Tabu/Activity tarzında).

KATEGORİ: "${categoryName}"
ZORLUK: Seviye ${difficulty} - ${def.name}

### SEVİYE ${difficulty} İÇİN KURALLAR:
- ${def.description}
- Örnek terimler: ${def.examples.join(', ')}
- Kural: ${def.rules}

### ÇIKTI FORMATI (her terim için):
1. "term": Terim (seviye ${difficulty}'e uygun!)
2. "forbiddenWords": Açıklarken KULLANILMAMASI gereken TAM 5 kelime
3. "hint": Yardımcı ipucu (1 kısa cümle, 60 saniye sonra gösterilir)

${count} terim oluştur:`;
    }
}

async function generateCardsForDifficulty(
    ai: GoogleGenAI,
    categoryName: string,
    language: 'de' | 'tr',
    difficulty: number,
    count: number = 50
): Promise<{ term: string; forbiddenWords: string[]; difficulty: number; hint: string; type: string }[]> {

    const prompt = buildPromptForDifficulty(categoryName, language, difficulty, count);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Using latest Gemini 3.0 Flash
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
                            hint: { type: Type.STRING }
                        },
                        required: ['term', 'forbiddenWords', 'hint']
                    }
                }
            }
        });

        const cards = JSON.parse(response.text || '[]');

        // Add difficulty and random activity type
        return cards.map((card: { term: string; forbiddenWords: string[]; hint: string }) => ({
            ...card,
            difficulty,
            forbiddenWords: card.forbiddenWords.slice(0, 5), // Ensure max 5
            type: ACTIVITY_TYPES[Math.floor(Math.random() * ACTIVITY_TYPES.length)]
        }));
    } catch (error) {
        console.error(`Error generating cards (difficulty ${difficulty}):`, error);
        return [];
    }
}

async function seedBingoCards() {
    console.log('🎲 Starting Improved Bingo Card Seeding (v2)...\n');
    console.log('📊 Target: 50 terms × 5 difficulties × 12 categories × 2 languages = 6000 terms\n');

    const apiKey = await getApiKey();
    if (!apiKey) {
        console.error('❌ API key not found in database or environment');
        process.exit(1);
    }

    console.log(`🔑 API Key loaded successfully\n`);
    const ai = new GoogleGenAI({ apiKey });

    // Clear existing cards
    console.log('🧹 Clearing existing BingoCards...');
    await prisma.bingoCard.deleteMany();

    let totalCards = 0;
    const CARDS_PER_DIFFICULTY = 50;
    const DIFFICULTIES = [1, 2, 3, 4, 5];

    for (const category of CATEGORIES) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📦 ${category.icon} ${category.nameDE}`);
        console.log(`${'='.repeat(60)}`);

        for (const language of ['de', 'tr'] as const) {
            const langFlag = language === 'de' ? '🇩🇪' : '🇹🇷';
            const categoryName = language === 'de' ? category.nameDE : category.nameTR;
            console.log(`\n  ${langFlag} ${language.toUpperCase()} - ${categoryName}`);

            for (const difficulty of DIFFICULTIES) {
                const diffName = DIFFICULTY_DEFINITIONS[language][difficulty as keyof typeof DIFFICULTY_DEFINITIONS['de']].name;
                console.log(`    ⭐ Stufe ${difficulty} (${diffName})...`);

                const cards = await generateCardsForDifficulty(
                    ai,
                    categoryName,
                    language,
                    difficulty,
                    CARDS_PER_DIFFICULTY
                );

                for (const card of cards) {
                    await prisma.bingoCard.create({
                        data: {
                            category: category.id,
                            term: card.term,
                            type: card.type,
                            forbiddenWords: JSON.stringify(card.forbiddenWords),
                            language,
                            difficulty: card.difficulty,
                            hint: card.hint
                        }
                    });
                }

                console.log(`       → ${cards.length} Begriffe erstellt`);
                totalCards += cards.length;

                // Rate limiting between difficulty levels
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        // Longer pause between categories
        console.log(`\n  ⏳ Pause vor nächster Kategorie...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ FERTIG! Gesamt: ${totalCards} Begriffe erstellt`);
    console.log(`${'='.repeat(60)}`);
}

seedBingoCards()
    .catch((e) => {
        console.error('❌ Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
