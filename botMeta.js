const Discord = require('discord.js')
const fs = require('fs')

const bot = new Discord.Client({
    intents: [ // Discord moment
        Discord.GatewayIntentBits.Guilds,
        Discord.GatewayIntentBits.GuildMembers,
        Discord.GatewayIntentBits.GuildBans,
        Discord.GatewayIntentBits.GuildEmojisAndStickers,
        Discord.GatewayIntentBits.GuildIntegrations,
        Discord.GatewayIntentBits.GuildWebhooks,
        Discord.GatewayIntentBits.GuildInvites,
        Discord.GatewayIntentBits.GuildVoiceStates,
        Discord.GatewayIntentBits.GuildPresences,
        Discord.GatewayIntentBits.GuildMessages,
        Discord.GatewayIntentBits.GuildMessageReactions,
        Discord.GatewayIntentBits.GuildMessageTyping,
        Discord.GatewayIntentBits.DirectMessages,
        Discord.GatewayIntentBits.DirectMessageReactions,
        Discord.GatewayIntentBits.DirectMessageTyping,
        Discord.GatewayIntentBits.MessageContent,
    ],
    partials: [
        Discord.Partials.User,
        Discord.Partials.Channel,
        Discord.Partials.GuildMember,
        Discord.Partials.Message,
        Discord.Partials.Reaction
    ]
})
bot.commands = new Discord.Collection()
bot.dbs = {}
bot.crasherList = moduleIsAvailable('./data/crasherList.json') ? require('./data/crasherList.json') : {}
bot.afkChecks = moduleIsAvailable('./afkChecks.json') ? require('./afkChecks.json') : {}
bot.settings = moduleIsAvailable('./guildSettings.json') ? require('./guildSettings.json') : {}
bot.serverWhiteList = moduleIsAvailable('./data/serverWhiteList.json') ? require('./data/serverWhiteList.json') : {}
bot.partneredServers = moduleIsAvailable('./data/partneredServers.json') ? require('./data/partneredServers.json') : []
bot.fetchPartneredServer = function (guildId) {
    for (let i in bot.partneredServers) {
        server = bot.partneredServers[i]
        if (server.guildId == guildId) return server
    }
    return null
}
bot.adminUsers = ['277636691227836419', '258286481167220738', '190572077219184650']
bot.partneredServers = moduleIsAvailable('./data/partneredServers.json') ? require('./data/partneredServers.json') : {}
bot.emojiServers = moduleIsAvailable('./data/emojiServers.json') ? require('./data/emojiServers.json') : {}
bot.devServers = ["739623118833713214"]
bot.storedEmojis = moduleIsAvailable('./data/emojis.json') ? require('./data/emojis.json') : {}

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    bot.commands.set(command.name, command);
}

function moduleIsAvailable(path) {
    try {
        require.resolve(path);
        require(path)
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = { bot }