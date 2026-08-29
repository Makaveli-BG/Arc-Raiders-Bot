const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
    console.error('Error: DISCORD_TOKEN or CLIENT_ID is missing in environment variables.');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        let data;
        if (guildId && guildId.trim() !== '') {
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
            console.log(`Successfully reloaded ${data.length} application (/) commands for Guild ${guildId}.`);
        } else {
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
            console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
        }
    } catch (error) {
        console.error(error);
    }
})();
