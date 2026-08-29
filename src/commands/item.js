const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { searchItem, getAllItems } = require('../dataManager');

const RARITY_COLORS = {
    Common: '#9d9d9d',
    Uncommon: '#1eff00',
    Rare: '#0070dd',
    Epic: '#a335ee',
    Legendary: '#ff8000',
    Exotic: '#e6cc80'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('item')
        .setDescription('Search Arc Raiders item information, stats, and recipes')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name or keyword of the item')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const all = getAllItems();
        const filtered = all
            .filter(item => (item.name?.en || item.id).toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(item => ({
                name: (item.name?.en || item.id).substring(0, 100),
                value: item.id
            }))
        );
    },

    async execute(interaction) {
        const query = interaction.options.getString('name');
        const results = searchItem(query);

        if (!results.length) {
            return interaction.reply({ content: `❌ No item found matching \`${query}\`.`, ephemeral: true });
        }

        const item = results[0];
        const name = item.name?.en || item.id;
        const desc = item.description?.en || 'No description available.';
        const rarity = item.rarity || 'Common';
        const color = RARITY_COLORS[rarity] || '#5865F2';

        const embed = new EmbedBuilder()
            .setTitle(name)
            .setDescription(desc)
            .setColor(color)
            .addFields(
                { name: 'Rarity / Tier', value: `${rarity}`, inline: true },
                { name: 'Item Type', value: `${item.type || item.category || 'General'}`, inline: true },
                { name: 'Value', value: item.value ? `🪙 ${item.value}` : 'N/A', inline: true }
            );

        if (item.crafting?.recipe && item.crafting.recipe.length > 0) {
            const recipeList = item.crafting.recipe
                .map(r => `• **${r.item || r.id}**: x${r.amount || r.quantity || 1}`)
                .join('\n');
            embed.addFields({ name: '🛠️ Crafting Recipe', value: recipeList, inline: false });
        }

        if (item.recycle?.materials && item.recycle.materials.length > 0) {
            const recycleList = item.recycle.materials
                .map(r => `• **${r.item || r.id}**: x${r.amount || r.quantity || 1}`)
                .join('\n');
            embed.addFields({ name: '♻️ Recycle Yield', value: recycleList, inline: false });
        }

        embed.setFooter({ text: `Arc Raiders Bot • ID: ${item.id}` });

        return interaction.reply({ embeds: [embed] });
    }
};
