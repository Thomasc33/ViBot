const Discord = require('discord.js');
const fs = require('fs');
const ErrorLogger = require('../lib/logError');

module.exports = {
    name: 'emoji',
    description: 'Lets you view or update all of the emojis on ViBots Database',
    alias: ['emojis'],
    args: '(list/update)',
    requiredArgs: 0,
    role: 'developer',
    async execute(message, args, bot, db) {
        var choice = undefined
        if (args.length == 0) { choice = 'update' }
        else choice = args[0].toLowerCase()
        switch (choice.toLowerCase()) {
            case 'update':
                try {
                    this.update(message, bot)
                    await message.channel.send('Updated ViBots emoji database successfully')
                } catch (error) {
                    ErrorLogger.log(error, bot, message.guild)
                    await message.channel.send('Something failed. Failed to update')
                }
                break;
            case 'list':
                await message.channel.send('Currently not setup. Please be patient as we set this up')
                break;
        }
    },
    async update(bot) {
        var data = {}
        var duplicates = {}
        bot.emojiServers.forEach(id => {
            let guild = bot.guilds.cache.get(id)
            guild.emojis.cache.forEach(emoji => {
                let dataTransfer = {
                    tag: `:${emoji.name}:${emoji.id}`,
                    name: emoji.name,
                    id: emoji.id,
                    text: `<:${emoji.name}:${emoji.id}>`,
                    guildid: guild.id,
                    guildname: guild.name,
                    animated: emoji.animated
                }
                if (data.hasOwnProperty(emoji.name)) {
                    duplicates[data[emoji.name].id] = data[emoji.name]
                    duplicates[emoji.id] = dataTransfer
                }
                data[emoji.name] = dataTransfer
            })
        })
        fs.writeFileSync('./data/emojis.json', JSON.stringify(data, null, 4))
    }
}