const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

let items = [];
let quests = [];
let bots = [];
let trades = [];
let itemsFuse = null;
let questsFuse = null;

function loadData() {
    const itemsDir = path.join(__dirname, 'data', 'items');
    const questsDir = path.join(__dirname, 'data', 'quests');

    items = [];
    if (fs.existsSync(itemsDir)) {
        const itemFiles = fs.readdirSync(itemsDir).filter(f => f.endsWith('.json'));
        for (const file of itemFiles) {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(itemsDir, file), 'utf8'));
                items.push(content);
            } catch (err) {
                console.error(`Failed to parse item file ${file}:`, err.message);
            }
        }
    }

    quests = [];
    if (fs.existsSync(questsDir)) {
        const questFiles = fs.readdirSync(questsDir).filter(f => f.endsWith('.json'));
        for (const file of questFiles) {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(questsDir, file), 'utf8'));
                quests.push(content);
            } catch (err) {
                console.error(`Failed to parse quest file ${file}:`, err.message);
            }
        }
    }

    try {
        const botsPath = path.join(__dirname, 'data', 'bots.json');
        if (fs.existsSync(botsPath)) {
            bots = JSON.parse(fs.readFileSync(botsPath, 'utf8'));
        }
    } catch (e) {}

    try {
        const tradesPath = path.join(__dirname, 'data', 'trades.json');
        if (fs.existsSync(tradesPath)) {
            trades = JSON.parse(fs.readFileSync(tradesPath, 'utf8'));
        }
    } catch (e) {}

    // Fuse instances for quick fuzzy searches
    itemsFuse = new Fuse(items, {
        keys: ['id', 'name.en', 'type', 'rarity'],
        threshold: 0.35,
        ignoreLocation: true
    });

    questsFuse = new Fuse(quests, {
        keys: ['id', 'name.en', 'trader'],
        threshold: 0.35,
        ignoreLocation: true
    });

    console.log(`[DataManager] Loaded ${items.length} items and ${quests.length} quests.`);
}

function searchItem(query) {
    if (!itemsFuse) loadData();
    const results = itemsFuse.search(query);
    return results.length > 0 ? results.map(r => r.item) : [];
}

function searchQuest(query) {
    if (!questsFuse) loadData();
    const results = questsFuse.search(query);
    return results.length > 0 ? results.map(r => r.item) : [];
}

function getAllItems() {
    if (!items.length) loadData();
    return items;
}

function getAllQuests() {
    if (!quests.length) loadData();
    return quests;
}

module.exports = {
    loadData,
    searchItem,
    searchQuest,
    getAllItems,
    getAllQuests
};
