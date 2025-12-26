/**
 * Seed Bingo Cards for Chaos Bingo
 * Generates Taboo-style content for 12 categories in DE and TR
 * 
 * Usage: npx ts-node scripts/seed-bingo.ts
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';

const prisma = new PrismaClient();

async function getApiKey(): Promise<string | null> {
    const setting = await prisma.settings.findUnique({
        where: { key: 'gemini_api_key' }
    });
    return setting?.value || process.env.GEMINI_API_KEY || process.env.API_KEY || null;
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

const ACTIVITY_TYPES = ['EXPLAIN', 'PANTOMIME', 'DRAW', 'HUM'];

async function generateCardsForCategory(
    ai: GoogleGenAI,
    category: typeof CATEGORIES[0],
    language: 'de' | 'tr',
    count: number = 20
): Promise<{ term: string; type: string; forbiddenWords: string[] }[]> {
    const categoryName = language === 'de' ? category.nameDE : category.nameTR;

    const prompt = language === 'de'
        ? `Generiere ${count} Begriffe für ein Party-Spiel im Stil von "Tabu" oder "Activity".
       Kategorie: "${categoryName}"
       
       Für jeden Begriff:
       1. Ein lustiger, bekannter Begriff passend zur Kategorie (z.B. Filmtitel, Prominenter, Trend)
       2. 5 verbotene Wörter, die man beim Erklären NICHT benutzen darf
       
       Mache die Begriffe aktuell (2024/2025) und lustig für eine Silvesterparty.
       Falls Kategorie "Türkei Spezial": Füge türkische Popstars, Essen, Traditionen hinzu.
       Falls Kategorie "Österreich Spezial": Füge österreichische Dialektwörter, Promis, Traditionen hinzu.`
        : `${count} adet parti oyunu için terim oluştur ("Tabu" veya "Activity" tarzında).
       Kategori: "${categoryName}"
       
       Her terim için:
       1. Kategoriye uygun eğlenceli, bilinen bir terim (film adı, ünlü, trend vb.)
       2. Açıklarken KULLANILMAMASI gereken 5 yasak kelime
       
       Terimleri güncel (2024/2025) ve yılbaşı partisi için eğlenceli yap.
       "Türkiye Özel" kategorisi ise: Türk pop yıldızları, yemekler, gelenekler ekle.`;

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
                            }
                        },
                        required: ['term', 'forbiddenWords']
                    }
                }
            }
        });

        const cards = JSON.parse(response.text || '[]');

        // Assign random activity types
        return cards.map((card: { term: string; forbiddenWords: string[] }) => ({
            ...card,
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
                    language: 'de'
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
                    language: 'tr'
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
