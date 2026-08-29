const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

let items = [];
let quests = [];
let bots = [];
let trades = [];
let itemsFuseStrict = null;
let itemsFuseFuzzy = null;
let questsFuse = null;

// UI & Common noise words in screenshots to ignore
const UI_STOPWORDS = new Set([
    'inventory', 'stash', 'backpack', 'weight', 'value', 'price', 'quantity', 'select', 'drop',
    'split', 'equip', 'unequip', 'back', 'close', 'press', 'interact', 'hold', 'level', 'lvl',
    'common', 'uncommon', 'rare', 'epic', 'legendary', 'exotic', 'ammo', 'slot', 'slots',
    'arc', 'raiders', 'health', 'shield', 'armor', 'capacity', 'sell', 'buy', 'trade', 'craft',
    'recycle', 'upgrade', 'details', 'stats', 'durability', 'condition', 'storage', 'loadout'
]);

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

    // Strict Fuse for OCR scanning - only matches exact/close Item Name & ID
    itemsFuseStrict = new Fuse(items, {
        keys: [
            { name: 'name.en', weight: 2.0 },
            { name: 'id', weight: 1.0 }
        ],
        threshold: 0.22, // Strict threshold prevents false positives
        minMatchCharLength: 4,
        ignoreLocation: true,
        includeScore: true
    });

    // Flexible Fuse for user search commands (/item)
    itemsFuseFuzzy = new Fuse(items, {
        keys: [
            { name: 'name.en', weight: 2.0 },
            { name: 'id', weight: 1.5 },
            { name: 'type', weight: 0.5 }
        ],
        threshold: 0.35,
        minMatchCharLength: 2,
        ignoreLocation: true
    });

    questsFuse = new Fuse(quests, {
        keys: ['id', 'name.en', 'trader'],
        threshold: 0.35,
        ignoreLocation: true
    });

    console.log(`[DataManager] Loaded ${items.length} items and ${quests.length} quests.`);
}

function searchItem(query, strict = false) {
    if (!itemsFuseStrict) loadData();

    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery || cleanQuery.length < 3) return [];

    if (strict) {
        if (UI_STOPWORDS.has(cleanQuery)) return [];
        const results = itemsFuseStrict.search(query);
        // Only return if confidence score is high (lower is better in Fuse)
        return results.filter(r => r.score <= 0.22).map(r => r.item);
    }

    const results = itemsFuseFuzzy.search(query);
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
    getAllQuests,
    UI_STOPWORDS
};
