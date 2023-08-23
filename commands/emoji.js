const Discord = require('discord.js');
const fs = require('fs');
const ErrorLogger = require('../lib/logError');

module.exports = {
    name: 'emoji',
    description: 'Lets you view or update all of the emojis on ViBots Database',
    alias: ['emojis'],
    args: '(list/update/find) [emojis]',
    requiredArgs: 0,
    role: 'developer',
    async execute(message, args, bot, db) {
        var choice = undefined
        if (args.length == 0) { choice = 'update' }
        else choice = args[0].toLowerCase()
        args.shift();
        switch (choice.toLowerCase()) {
            case 'update':
                try {
                    this.update(bot)
                    await message.channel.send('Updated ViBots emoji database successfully')
                } catch (error) {
                    ErrorLogger.log(error, bot, message.guild)
                    await message.channel.send('Something failed. Failed to update')
                }
                break;
            case 'list':
                await message.channel.send('Currently not setup. Please be patient as we set this up')
                break;
            case 'find':
                let emojisNotFound = [];
                args.map(
                    async emoji => {
                        if (bot.storedEmojis.hasOwnProperty(emoji)) {
                            let storedEmoji = bot.storedEmojis[emoji]
                            emoji = await bot.emojis.cache.get(bot.storedEmojis[emoji].id)
                            let embed = new Discord.EmbedBuilder()  
                                .setTitle(emoji.name)
                                .setDescription(Object.keys(storedEmoji).map(
                                    property => `${property}: ${storedEmoji[property]}`
                                ).join('\n'))
                                // .setAuthor({ iconURL: })
                                .setColor('#FF0000')
                            await message.channel.send({ embeds: [embed] })
                        } else {
                            emojisNotFound.push(emoji)
                        }
                    }
                );
                if (emojisNotFound.length >= 1) {
                    let notFoundEmbed = new Discord.EmbedBuilder()
                        .setTitle('Emojis Not Found')
                        .setDescription('*Keep in mind that searching the Emoji database requires it to be case sensitive*\n' + emojisNotFound.join(', '))
                        .setColor('#FFFF00')
                    await message.channel.send({ embeds: [notFoundEmbed] })
                }
                break;
        }
    },
    async update(bot) {
        try {
            var data = {}
            var duplicates = {}
            bot.emojiServers.forEach(id => {
                let guild = bot.guilds.cache.get(id)
                guild.emojis.cache.forEach(emoji => {
                    let dataTransfer = {
                        tag: `:${emoji.name}:${emoji.id}`,
                        name: emoji.name,
                        id: emoji.id,
                        text: emoji.animated ? `<a:${emoji.name}:${emoji.id}>` : `<:${emoji.name}:${emoji.id}>`,
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
            console.log('Emoji file updated')
        } catch (error) {
            await ErrorLogger.log(error, bot)
            console.log('Emoji file failed to update')
        }
    }
}
