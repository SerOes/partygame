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

const prisma = new PrismaClient();

// Category prompts for funny Nano Banana style images
const CATEGORY_PROMPTS = [
    {
        id: 'filme_serien',
        prompt: 'A cute cartoon banana character dressed as a movie director with a clapboard and film reel, Hollywood style, fun party game icon, vibrant colors, simple background'
    },
    {
        id: 'musik_hits',
        prompt: 'A cute cartoon banana character wearing headphones and playing electric guitar, rock star pose, music notes floating, fun party game icon, vibrant colors'
    },
    {
        id: 'sport',
        prompt: 'A cute cartoon banana character as an athlete holding a soccer ball and wearing a gold medal, sports theme, fun party game icon, vibrant colors'
    },
    {
        id: 'weltgeschehen',
        prompt: 'A cute cartoon banana character as a news reporter holding a microphone with a globe in background, world news theme, fun party game icon, vibrant colors'
    },
    {
        id: 'oesterreich',
        prompt: 'A cute cartoon banana character wearing traditional Austrian dirndl/lederhosen, with Alps in background, Austrian flag colors, fun party game icon'
    },
    {
        id: 'tuerkei',
        prompt: 'A cute cartoon banana character wearing a fez hat and holding Turkish tea, with mosque silhouette in background, Turkish flag colors, fun party game icon'
    },
    {
        id: 'tech_gaming',
        prompt: 'A cute cartoon banana character as a gamer with VR headset and gaming controller, neon cyberpunk colors, fun party game icon, tech vibes'
    },
    {
        id: 'popkultur',
        prompt: 'A cute cartoon banana character taking a selfie with smartphone, social media icons floating, influencer style, fun party game icon, trendy'
    },
    {
        id: 'prominente',
        prompt: 'A cute cartoon banana character walking on red carpet with sunglasses and paparazzi cameras flashing, celebrity star style, fun party game icon'
    },
    {
        id: 'essen_trinken',
        prompt: 'A cute cartoon banana character as a chef with chef hat, holding a pizza and wine glass, food theme, fun party game icon, delicious colors'
    },
    {
        id: 'silvester',
        prompt: 'A cute cartoon banana character celebrating New Year with champagne, fireworks in background, party hat and confetti, fun party game icon'
    },
    {
        id: 'wissenschaft',
        prompt: 'A cute cartoon banana character as a scientist with lab coat, holding a beaker with bubbling liquid, DNA helix in background, fun party game icon'
    },
];

async function getApiKey(): Promise<string | null> {
    const setting = await prisma.settings.findUnique({
        where: { key: 'gemini_api_key' }
    });
    return setting?.value || process.env.GEMINI_API_KEY || null;
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
