const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Tesseract = require('tesseract.js');
const { searchItem, UI_STOPWORDS } = require('../dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('scan')
        .setDescription('Scan an Arc Raiders stash/inventory screenshot using OCR to identify items')
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

        try {
            // Run OCR with Tesseract
            const { data: { text, blocks, lines: ocrLines } } = await Tesseract.recognize(
                attachment.url,
                'eng',
                {
                    logger: () => {}
                }
            );

            // Filter out junk text, single short tokens, and UI noise
            const rawLines = (ocrLines && ocrLines.length > 0)
                ? ocrLines.map(l => l.text.trim())
                : text.split('\n').map(l => l.trim());

            const detectedItems = new Map();

            for (const line of rawLines) {
                // Strip punctuation and special OCR artifacts
                const cleanLine = line.replace(/[^a-zA-Z0-9\s-]/g, '').trim();

                // Skip lines that are too short or numeric
                if (cleanLine.length < 4 || /^\d+$/.test(cleanLine)) continue;

                // Check strict search against item database
                const matched = searchItem(cleanLine, true);
                if (matched.length > 0) {
                    const topMatch = matched[0];
                    const itemName = topMatch.name?.en || topMatch.id;

                    if (!detectedItems.has(topMatch.id)) {
                        detectedItems.set(topMatch.id, {
                            item: topMatch,
                            name: itemName,
                            detectedText: cleanLine
                        });
                    }
                }
            }

            const results = Array.from(detectedItems.values());

            if (results.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🔍 Scan Results')
                    .setDescription('No specific Arc Raiders items could be identified with high confidence.\n\n**Tips for better results:**\n• Ensure the screenshot is not blurry.\n• Crop closer to the item slots/stash grid.\n• Ensure in-game text/names are clearly visible.')
                    .setColor('#E74C3C')
                    .setThumbnail(attachment.url);

                return interaction.editReply({ embeds: [embed] });
            }

            let totalValue = 0;
            let itemListText = '';

            for (const r of results.slice(0, 25)) {
                const val = r.item.value || 0;
                totalValue += val;
                const rarity = r.item.rarity || 'Common';
                const type = r.item.type || r.item.category || '';
                itemListText += `• **${r.name}** [${rarity}] ${type ? `*(${type})*` : ''}${val ? ` - 🪙 ${val}` : ''}\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🔍 Inventory / Stash Scan Verified')
                .setDescription(`Detected **${results.length}** distinct item(s):\n\n${itemListText}`)
                .setColor('#2ECC71')
                .setThumbnail(attachment.url)
                .addFields(
                    { name: 'Estimated Total Value', value: totalValue > 0 ? `🪙 ${totalValue.toLocaleString()}` : 'N/A', inline: true },
                    { name: 'Total Items Detected', value: `${results.length}`, inline: true }
                )
                .setFooter({ text: 'Arc Raiders OCR Scanner • Strict Name Matching' });

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('OCR Error:', error);
            return interaction.editReply({ content: `❌ Error scanning screenshot: ${error.message}` });
        }
    }
};
