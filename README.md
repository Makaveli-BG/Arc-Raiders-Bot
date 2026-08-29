# Arc Raiders Discord Bot

A Discord Bot for ARC Raiders featuring in-depth item stats, crafting recipes, recycling yields, quest tracking, and OCR screenshot stash scanning.

## 🚀 Features
- **/item `<name>`**: Search items, weapons, blueprints, and materials with real-time autocompletion, crafting costs, and recycle outputs.
- **/quest `<name>`**: Search game missions/quests, objectives, required turn-in materials, and rewards.
- **/scan `<screenshot>`**: Upload an in-game screenshot of your inventory, stash, or loot crate. The bot performs Optical Character Recognition (OCR) to detect items and calculate their total value.

## 📦 Pterodactyl Setup & Egg Import
1. Go to your **Pterodactyl Admin Panel** -> **Nests** -> **Import Egg**.
2. Upload the provided [egg-arc-raiders-bot.json](file:///var/lib/pterodactyl/volumes/b1a8ebfd-20cb-4c08-ae50-b5f5babc7dc2/egg-arc-raiders-bot.json).
3. Set the Egg Docker image to `node:22-bullseye-slim` or your custom image built with [Dockerfile](file:///var/lib/pterodactyl/volumes/b1a8ebfd-20cb-4c08-ae50-b5f5babc7dc2/Dockerfile).
4. Fill in the **Startup Variables**:
   - `DISCORD_TOKEN`: Your Discord Bot Token
   - `CLIENT_ID`: Your Discord Bot Application ID
   - `GUILD_ID`: (Optional) Your server ID for instant command registration

## 🛠️ Slash Commands Deployment
Before starting the bot for the first time, deploy slash commands:
```bash
npm run deploy-commands
```
