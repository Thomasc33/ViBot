const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { rateLimitLogger } = require('./lib/rateLimitLogger');

const bot = new Client({
    intents: [ // Discord moment
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildBans,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildWebhooks,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.User,
        Partials.Channel,
        Partials.GuildMember,
        Partials.Message,
        Partials.Reaction
    ]
});

rateLimitLogger(bot);

bot.afkChecks = {};
bot.afkModules = {};
bot.settings = moduleIsAvailable('./guildSettings.json') ? require('./guildSettings.json') : {};
bot.settingsTimestamp = {};
bot.partneredServers = moduleIsAvailable('./data/partneredServers.json') ? require('./data/partneredServers.json') : [];
bot.fetchPartneredServer = function (guildId) {
    for (const server of bot.partneredServers) {
        if (server.guildId == guildId) return server;
    }
    return null;
};
bot.adminUsers = ['277636691227836419', '258286481167220738', '190572077219184650', '120540036855889921', '658783569191370802', '130850662522159104'];
bot.partneredServers = moduleIsAvailable('./data/partneredServers.json') ? require('./data/partneredServers.json') : {};
bot.emojiServers = moduleIsAvailable('./data/emojiServers.json') ? require('./data/emojiServers.json') : {};
bot.devServers = ['739623118833713214'];
bot.storedEmojis = moduleIsAvailable('./data/emojis.json') ? require('./data/emojis.json') : {};

function moduleIsAvailable(path) {
    try {
        require.resolve(path);
        require(path);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = { bot };
