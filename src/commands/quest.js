const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { searchQuest, getAllQuests } = require('../dataManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quest')
        .setDescription('Lookup Arc Raiders quests, requirements, and rewards')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Name or keyword of the quest')
                .setRequired(true)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const all = getAllQuests();
        const filtered = all
            .filter(q => (q.name?.en || q.id).toLowerCase().includes(focusedValue))
            .slice(0, 25);

        await interaction.respond(
            filtered.map(q => ({
                name: (q.name?.en || q.id).substring(0, 100),
                value: q.id
            }))
        );
    },

    async execute(interaction) {
        const query = interaction.options.getString('name');
        const results = searchQuest(query);

        if (!results.length) {
            return interaction.reply({ content: `❌ No quest found matching \`${query}\`.`, ephemeral: true });
        }

        const quest = results[0];
        const name = quest.name?.en || quest.id;
        const desc = quest.description?.en || 'No description provided.';
        const trader = quest.trader || 'Unknown Trader';

        const embed = new EmbedBuilder()
            .setTitle(`📜 Quest: ${name}`)
            .setDescription(desc)
            .setColor('#E67E22')
            .addFields(
                { name: 'Trader / Giver', value: trader, inline: true },
                { name: 'Map Location', value: quest.map || 'Any / Speranza', inline: true }
            );

        if (quest.objectives && quest.objectives.length > 0) {
            const objList = quest.objectives.map((obj, i) => `${i + 1}. ${obj.text?.en || obj.description || obj.id}`).join('\n');
            embed.addFields({ name: '🎯 Objectives', value: objList, inline: false });
        }

        if (quest.requiredItems && quest.requiredItems.length > 0) {
            const reqList = quest.requiredItems.map(r => `• **${r.item || r.id}**: x${r.amount || 1}`).join('\n');
            embed.addFields({ name: '📦 Required Items', value: reqList, inline: false });
        }

        if (quest.rewards) {
            let rewardText = '';
            if (quest.rewards.xp) rewardText += `• **XP**: ${quest.rewards.xp}\n`;
            if (quest.rewards.currency) rewardText += `• **Currency**: 🪙 ${quest.rewards.currency}\n`;
            if (quest.rewards.items && quest.rewards.items.length > 0) {
                rewardText += quest.rewards.items.map(r => `• **${r.item || r.id}**: x${r.amount || 1}`).join('\n');
            }
            if (rewardText) {
                embed.addFields({ name: '🎁 Rewards', value: rewardText, inline: false });
            }
        }

        embed.setFooter({ text: `Arc Raiders Bot • Quest ID: ${quest.id}` });

        return interaction.reply({ embeds: [embed] });
    }
};
