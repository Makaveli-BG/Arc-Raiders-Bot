const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Events, OAuth2Scopes, PermissionFlagsBits, REST, Routes } = require('discord.js');
const { loadData } = require('./dataManager');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
    console.error('CRITICAL: DISCORD_TOKEN is missing in environment variables. Please set it in your Pterodactyl Startup configuration or .env file.');
    process.exit(1);
}

// Preload Arc Raiders database
loadData();

// Initialize Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    }
}

// Auto-register slash commands on startup
async function registerSlashCommands(appId) {
    const targetClientId = clientId || appId;
    if (!targetClientId) return;

    const rest = new REST().setToken(token);
    try {
        console.log(`[Commands] Syncing ${commands.length} application (/) commands...`);
        if (guildId && guildId.trim() !== '') {
            await rest.put(
                Routes.applicationGuildCommands(targetClientId, guildId),
                { body: commands }
            );
            console.log(`[Commands] Successfully registered ${commands.length} commands to Guild ${guildId}.`);
        } else {
            await rest.put(
                Routes.applicationCommands(targetClientId),
                { body: commands }
            );
            console.log(`[Commands] Successfully registered ${commands.length} commands globally.`);
        }
    } catch (error) {
        console.error('[Commands] Failed to register slash commands:', error.message);
    }
}

client.once(Events.ClientReady, async c => {
    // Generate Bot Invite URL
    const inviteUrl = c.generateInvite({
        scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
        permissions: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ViewChannel
        ]
    });

    console.log(`=======================================================`);
    console.log(`[Arc Raiders Bot] Logged in as ${c.user.tag}`);
    console.log(`Loaded ${client.commands.size} commands.`);
    console.log(`Ready to serve ARC Raiders community.`);
    console.log(`-------------------------------------------------------`);
    console.log(`🔗 BOT INVITE URL:\n${inviteUrl}`);
    console.log(`=======================================================`);

    // Auto sync commands with Discord API
    await registerSlashCommands(c.user.id);
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error('Autocomplete Error:', error);
        }
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

client.login(token);
