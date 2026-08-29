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

// Clean old commands and register fresh commands
async function syncSlashCommands(appId) {
    const targetClientId = clientId || appId;
    if (!targetClientId) return;

    const rest = new REST().setToken(token);
    try {
        console.log('[Commands] Cleaning old/outdated guild commands across all connected servers...');
        
        // 1. Wipe old guild-specific commands for every guild the bot is in
        const guilds = await client.guilds.fetch();
        for (const [id, guild] of guilds) {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(targetClientId, id),
                    { body: [] }
                );
            } catch (err) {
                console.warn(`[Commands] Could not clear guild commands for ${guild.name} (${id}): ${err.message}`);
            }
        }
        console.log(`[Commands] Successfully wiped leftover guild commands from ${guilds.size} servers.`);

        // 2. Overwrite global commands with the exact current Arc Raiders command set
        console.log(`[Commands] Deploying ${commands.length} fresh global commands (${commands.map(c => '/' + c.name).join(', ')})...`);
        const deployed = await rest.put(
            Routes.applicationCommands(targetClientId),
            { body: commands }
        );
        console.log(`[Commands] Successfully deployed ${deployed.length} fresh global commands.`);

        // If a specific GUILD_ID is specified for immediate testing, deploy there as well
        if (guildId && guildId.trim() !== '') {
            await rest.put(
                Routes.applicationGuildCommands(targetClientId, guildId.trim()),
                { body: commands }
            );
            console.log(`[Commands] Also registered instant commands to Guild ID ${guildId}.`);
        }
    } catch (error) {
        console.error('[Commands] Error syncing slash commands:', error.message);
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
    console.log(`Loaded ${client.commands.size} Arc Raiders commands.`);
    console.log(`Ready to serve ARC Raiders community.`);
    console.log(`-------------------------------------------------------`);
    console.log(`🔗 BOT INVITE URL:\n${inviteUrl}`);
    console.log(`=======================================================`);

    // Clean old commands and deploy fresh
    await syncSlashCommands(c.user.id);
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
    if (!command) {
        return interaction.reply({ content: '❌ This command is no longer available.', ephemeral: true });
    }

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
