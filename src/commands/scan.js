const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const Tesseract = require('tesseract.js');
const { searchItem, getAllItems, getAllQuests } = require('../dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scan')
        .setDescription('Scan an Arc Raiders stash/inventory screenshot using AI Vision to identify all items')
        .addAttachmentOption(option =>
            option.setName('screenshot')
                .setDescription('Upload an in-game inventory, stash, or loot screenshot')
                .setRequired(true)
        ),

    async execute(interaction) {
        const attachment = interaction.options.getAttachment('screenshot');

        if (!attachment.contentType?.startsWith('image/')) {
            return interaction.reply({ content: '❌ Please upload a valid image file (PNG, JPG, WebP).', ephemeral: true });
        }

        await interaction.deferReply();

        const geminiApiKey = process.env.GEMINI_API_KEY;

        try {
            // Fetch image buffer
            const response = await axios.get(attachment.url, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(response.data);
            const base64Image = imageBuffer.toString('base64');
            const mimeType = attachment.contentType || 'image/png';

            let detectedItems = [];

            if (geminiApiKey && geminiApiKey.trim() !== '') {
                // High-precision Gemini Vision Scan
                const ai = new GoogleGenAI({ apiKey: geminiApiKey.trim() });
                
                const allItemNames = getAllItems().map(i => i.name?.en || i.id).filter(Boolean);
                const sampleList = allItemNames.slice(0, 150).join(', ');

                const prompt = `You are an expert game inventory analyzer for the extraction shooter ARC Raiders.
Analyze this in-game screenshot (which may be a stash grid, backpack inventory, or loot screen).
Carefully identify each item/weapon/material/blueprint visible in the slots or grid.

Return ONLY a valid JSON array of objects with the exact detected item names and quantities. Do NOT include markdown code fences or backticks if possible, just valid JSON.
Example output format:
[
  {"name": "Wolfpack", "quantity": 1},
  {"name": "Heavy Ammo", "quantity": 120},
  {"name": "ARC Circuitry", "quantity": 3}
]

Reference game item names include: ${sampleList}, and other known ARC Raiders weapons, mods, shields, resources, blueprints, gadgets, and loot.
If no recognizable game items are visible, return an empty array [].`;

                const aiResponse = await ai.models.generateContent({
                    model: 'gemini-2.0-flash',
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: prompt },
                                {
                                    inlineData: {
                                        mimeType: mimeType,
                                        data: base64Image
                                    }
                                }
                            ]
                        }
                    ]
                });

                let textOutput = aiResponse.text || '';
                // Clean markdown code blocks if returned
                textOutput = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();

                try {
                    const parsed = JSON.parse(textOutput);
                    if (Array.isArray(parsed)) {
                        for (const entry of parsed) {
                            const matched = searchItem(entry.name, true);
                            if (matched.length > 0) {
                                detectedItems.push({
                                    item: matched[0],
                                    name: matched[0].name?.en || matched[0].id,
                                    quantity: entry.quantity || 1
                                });
                            } else {
                                detectedItems.push({
                                    item: { rarity: 'Unknown', value: 0 },
                                    name: entry.name,
                                    quantity: entry.quantity || 1
                                });
                            }
                        }
                    }
                } catch (parseErr) {
                    console.error('Failed to parse AI Vision JSON output:', textOutput);
                }
            } else {
                // Fallback to Tesseract OCR if GEMINI_API_KEY is not set
                const { data: { lines: ocrLines, text } } = await Tesseract.recognize(
                    imageBuffer,
                    'eng',
                    { logger: () => {} }
                );

                const rawLines = (ocrLines && ocrLines.length > 0)
                    ? ocrLines.map(l => l.text.trim())
                    : text.split('\n').map(l => l.trim());

                const seen = new Map();
                for (const line of rawLines) {
                    const cleanLine = line.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
                    if (cleanLine.length < 4 || /^\d+$/.test(cleanLine)) continue;

                    const matched = searchItem(cleanLine, true);
                    if (matched.length > 0) {
                        const topMatch = matched[0];
                        const itemName = topMatch.name?.en || topMatch.id;
                        if (!seen.has(topMatch.id)) {
                            seen.set(topMatch.id, true);
                            detectedItems.push({
                                item: topMatch,
                                name: itemName,
                                quantity: 1
                            });
                        }
                    }
                }
            }

            if (detectedItems.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🔍 Scan Results')
                    .setDescription('No known Arc Raiders items could be identified from this screenshot.\n\n*Make sure your GEMINI_API_KEY is configured in Pterodactyl Startup, or upload a clearer screenshot.*')
                    .setColor('#E74C3C')
                    .setThumbnail(attachment.url);

                return interaction.editReply({ embeds: [embed] });
            }

            let totalValue = 0;
            let itemListText = '';

            for (const r of detectedItems.slice(0, 25)) {
                const itemVal = (r.item.value || 0) * (r.quantity || 1);
                totalValue += itemVal;
                const rarity = r.item.rarity || 'Common';
                const qtyText = r.quantity > 1 ? ` **(x${r.quantity})**` : '';
                itemListText += `• **${r.name}**${qtyText} [${rarity}]${itemVal > 0 ? ` - 🪙 ${itemVal.toLocaleString()}` : ''}\n`;
            }

            const isAiPowered = !!(geminiApiKey && geminiApiKey.trim() !== '');

            const embed = new EmbedBuilder()
                .setTitle(`🔍 ${isAiPowered ? 'AI Vision' : 'OCR'} Stash Scan Results`)
                .setDescription(`Identified **${detectedItems.length}** item slot(s):\n\n${itemListText}`)
                .setColor('#2ECC71')
                .setThumbnail(attachment.url)
                .addFields(
                    { name: 'Estimated Stash Value', value: totalValue > 0 ? `🪙 ${totalValue.toLocaleString()}` : 'Variable / N/A', inline: true },
                    { name: 'Total Slots Detected', value: `${detectedItems.length}`, inline: true }
                )
                .setFooter({ text: isAiPowered ? 'ARC Raiders Bot • Powered by Gemini Vision AI' : 'ARC Raiders Bot • Local OCR' });

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Scan Error:', error);
            return interaction.editReply({ content: `❌ Error scanning screenshot: ${error.message}` });
        }
    }
};
