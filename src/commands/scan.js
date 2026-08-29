const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Tesseract = require('tesseract.js');
const { searchItem, getAllItems } = require('../dataManager');

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
            const { data: { text } } = await Tesseract.recognize(
                attachment.url,
                'eng',
                {
                    logger: () => {}
                }
            );

            // Clean lines and search items
            const lines = text.split('\n')
                .map(l => l.trim())
                .filter(l => l.length >= 3);

            const detectedItems = new Map();
            const allItems = getAllItems();

            for (const line of lines) {
                // Check direct matching or fuzzy matches
                const matched = searchItem(line);
                if (matched.length > 0) {
                    const topMatch = matched[0];
                    const itemName = topMatch.name?.en || topMatch.id;
                    if (!detectedItems.has(topMatch.id)) {
                        detectedItems.set(topMatch.id, {
                            item: topMatch,
                            name: itemName,
                            count: 1
                        });
                    }
                }
            }

            const results = Array.from(detectedItems.values());

            if (results.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('🔍 Scan Results')
                    .setDescription('Could not clearly identify known items from the screenshot.\n\n*Tip: Try taking a closer crop of the item names or stash grid for higher accuracy.*')
                    .setColor('#E74C3C')
                    .setThumbnail(attachment.url);

                return interaction.editReply({ embeds: [embed] });
            }

            let totalValue = 0;
            let itemListText = '';

            for (const r of results.slice(0, 20)) {
                const val = r.item.value || 0;
                totalValue += val;
                itemListText += `• **${r.name}** (${r.item.rarity || 'Common'})${val ? ` - 🪙 ${val}` : ''}\n`;
            }

            const embed = new EmbedBuilder()
                .setTitle('🔍 Inventory / Stash Scan Completed')
                .setDescription(`Identified **${results.length}** item(s) from your screenshot:\n\n${itemListText}`)
                .setColor('#2ECC71')
                .setThumbnail(attachment.url)
                .addFields(
                    { name: 'Estimated Total Value', value: totalValue > 0 ? `🪙 ${totalValue.toLocaleString()}` : 'Variable / N/A', inline: true },
                    { name: 'Items Found', value: `${results.length}`, inline: true }
                )
                .setFooter({ text: 'Arc Raiders OCR Scanner • Uses Tesseract OCR' });

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('OCR Error:', error);
            return interaction.editReply({ content: `❌ Error scanning screenshot: ${error.message}` });
        }
    }
};
