/**
 * Generate Category Images for Chaos Bingo
 * Uses Gemini 2.5 Flash Image (Nano Banana) to create funny category icons
 * 
 * Usage: npx ts-node scripts/generate-category-images.ts
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Same encryption key as server
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'silvester-party-app-secret-key-32';

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

// Category prompts for funny cartoon people with German labels
const CATEGORY_PROMPTS = [
    {
        id: 'filme_serien',
        prompt: 'Lustiger Cartoon-Charakter als Regisseur mit Filmklappe und Popcorn, Hollywood-Stil, "FILME" Text, bunter Party-Spielkarten-Stil, fröhliche Farben'
    },
    {
        id: 'musik_hits',
        prompt: 'Lustiger Cartoon-Charakter als Rockstar mit E-Gitarre und Kopfhörern, Musiknoten fliegend, "MUSIK" Text, bunter Party-Spielkarten-Stil'
    },
    {
        id: 'sport',
        prompt: 'Lustiger Cartoon-Charakter als Sportler mit Fußball und Goldmedaille, Sportler-Outfit, "SPORT" Text, bunter Party-Spielkarten-Stil'
    },
    {
        id: 'weltgeschehen',
        prompt: 'Lustiger Cartoon-Charakter als Nachrichtenreporter mit Mikrofon und Weltkugel, "WELT" Text, bunter Party-Spielkarten-Stil'
    },
    {
        id: 'oesterreich',
        prompt: 'Lustiger Cartoon-Charakter in Tracht (Dirndl/Lederhosen) vor Alpenpanorama, österreichische Flagge, "ÖSTERREICH" Text, bunter Party-Spielkarten-Stil'
    },
    {
        id: 'tuerkei',
        prompt: 'Lustiger Cartoon-Charakter mit Fez-Hut und türkischem Tee, Moschee im Hintergrund, türkische Flagge, "TÜRKEI" Text, bunter Party-Spielkarten-Stil'
    },
    {
        id: 'tech_gaming',
        prompt: 'Lustiger Cartoon-Charakter als Gamer mit VR-Brille und Controller, Neon-Farben, "GAMING" Text, bunter Party-Spielkarten-Stil'
    },
    {
        id: 'popkultur',
        prompt: 'Lustiger Cartoon-Charakter als Influencer mit Smartphone und Selfie-Pose, Social-Media-Icons, "POP" Text, bunter Party-Spielkarten-Stil'
    },
    {
        id: 'prominente',
        prompt: 'Lustiger Cartoon-Charakter als Star auf rotem Teppich mit Sonnenbrille, Blitzlichter, "STARS" Text, bunter Party-Spielkarten-Stil'
    },
    {
        id: 'essen_trinken',
        prompt: 'Lustiger Cartoon-Charakter als Koch mit Kochmütze, Pizza und Weinglas, "ESSEN" Text, bunter Party-Spielkarten-Stil'
    },
    {
        id: 'silvester',
        prompt: 'Lustiger Cartoon-Charakter mit Sektglas und Partyhut, Feuerwerk im Hintergrund, Konfetti, "SILVESTER" Text, bunter Party-Spielkarten-Stil'
    },
    {
        id: 'wissenschaft',
        prompt: 'Lustiger Cartoon-Charakter als Wissenschaftler mit Laborkittel und Reagenzglas, DNA-Helix, "WISSEN" Text, bunter Party-Spielkarten-Stil'
    },
];

async function getApiKey(): Promise<string | null> {
    const setting = await prisma.settings.findUnique({
        where: { key: 'gemini_api_key' }
    });
    if (setting?.value) {
        return decrypt(setting.value);
    }
    return process.env.GEMINI_API_KEY || null;
}

async function generateCategoryImages() {
    console.log('🎨 Starting Category Image Generation...\n');

    const apiKey = await getApiKey();
    if (!apiKey) {
        console.error('❌ API key not found');
        process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });

    // Create output directory
    const outputDir = path.join(__dirname, '../public/images/categories');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    for (const category of CATEGORY_PROMPTS) {
        console.log(`🖼️ Generating image for: ${category.id}`);

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: category.prompt
            });

            // Extract image from response
            for (const part of response.candidates?.[0]?.content?.parts || []) {
                if ((part as any).inlineData) {
                    const imageData = (part as any).inlineData.data;
                    const buffer = Buffer.from(imageData, 'base64');
                    const imagePath = path.join(outputDir, `${category.id}.png`);
                    fs.writeFileSync(imagePath, buffer);
                    console.log(`   ✅ Saved: ${imagePath}`);

                    // Save path to database (you could store in a CategoryImage table)
                    break;
                }
            }
        } catch (error: any) {
            console.error(`   ❌ Error for ${category.id}:`, error.message);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n🎉 Category image generation complete!');
}

generateCategoryImages()
    .catch((e) => {
        console.error('❌ Generation failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
