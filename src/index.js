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

// Clean old commands and register exclusively as Global commands (prevents duplicates)
async function syncSlashCommands(appId) {
    const targetClientId = clientId || appId;
    if (!targetClientId) return;

    const rest = new REST().setToken(token);
    try {
        console.log('[Commands] Cleaning all guild-specific slash commands to prevent duplication...');
        
        // 1. Wipe guild-level commands for all connected guilds (Guild commands override/duplicate global ones in Discord UI)
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

        // If a specific GUILD_ID was provided in environment variables, ensure it is also wiped
        if (guildId && guildId.trim() !== '') {
            try {
                await rest.put(
                    Routes.applicationGuildCommands(targetClientId, guildId.trim()),
                    { body: [] }
                );
            } catch (err) {}
        }
        console.log(`[Commands] Cleaned guild-level duplicate commands.`);

        // 2. Set pure Global commands
        console.log(`[Commands] Deploying ${commands.length} fresh global commands (${commands.map(c => '/' + c.name).join(', ')})...`);
        const deployed = await rest.put(
            Routes.applicationCommands(targetClientId),
            { body: commands }
        );
        console.log(`[Commands] Successfully deployed ${deployed.length} clean global commands.`);
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

    // Clean old commands and deploy pure global set
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
