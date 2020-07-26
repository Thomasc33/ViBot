const Discord = require('discord.js')

module.exports = {
    name: 'removealt',
    description: 'Removes an alt from a user',
    args: '<user> (reason)',
    role: 'Security',
    alias: ['ra'],
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        let member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args[0])
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (!member) return message.channel.send(`\`${args[0]}\` not found`)

        let names = member.nickname.replace(/[^a-z|]/gi, '').split('|')

        if (names.length <= 1) return message.channel.send(`${member} does not have any alts`)

        let embed = new Discord.MessageEmbed()
            .setTitle('Select an alt to remove')
            .setColor('#ff0000')
            .setDescription('None!')
        for (let i = 1; i < names.length; i++) {
            if (embed.description == 'None!') embed.description = `**${i}:** ${names[i]}`
            else embed.description += `\n**${i}:** ${names[i]}`
        }
        let mes = await message.channel.send(embed)
        let reactionCollector = new Discord.ReactionCollector(mes, (r, u) => !u.bot)
        let choice
        reactionCollector.on('collect', async (r, u) => {
            switch (r.emoji.name) {
                case '1️⃣': choice = 1; await mes.delete(); reactionCollector.stop(); break;
                case '2️⃣': choice = 2; await mes.delete(); reactionCollector.stop(); break;
                case '3️⃣': choice = 3; await mes.delete(); reactionCollector.stop(); break;
                case '4️⃣': choice = 4; await mes.delete(); reactionCollector.stop(); break;
                case '5️⃣': choice = 5; await mes.delete(); reactionCollector.stop(); break;
                case '6️⃣': choice = 6; await mes.delete(); reactionCollector.stop(); break;
                case '7️⃣': choice = 7; await mes.delete(); reactionCollector.stop(); break;
                case '8️⃣': choice = 8; await mes.delete(); reactionCollector.stop(); break;
                case '9️⃣': choice = 9; await mes.delete(); reactionCollector.stop(); break;
                case '🔟': choice = 10; await mes.delete(); reactionCollector.stop(); break;
                case '❌': await message.react('✅'); await mes.delete(); reactionCollector.stop(); break;
                default:
                    let retryMessage = await message.channel.send('There was an issue with the reaction. Please try again');
                    setTimeout(() => { retryMessage.delete() }, 5000)
                    break;
            }
            if (choice) {
                await message.react('✅')
                let newname = ''
                let prefix = member.nickname.charAt(0)
                if (prefix.replace(/[a-z0-9]/gi, '') != '') newname = prefix
                for (let i in names) {
                    if (choice != i)
                        if (i == 0) newname += names[i]
                        else newname += ` | ${names[i]}`
                }
                await member.setNickname(newname)
                let embed = new Discord.MessageEmbed()
                    .setTitle('Alt Removed')
                    .setColor('#fefefe')
                    .setDescription(member)
                    .addField('Main', member.nickname, true)
                    .addField('Alt Removed', names[choice], true)
                    .addField('Removed By', `<@!${message.author.id}>`)
                    .setTimestamp(Date.now());
                let reason = ''
                for (let i = 1; i < args.length; i++) reason += args[i]
                if (reason != '')
                    if (reason.length > 1024) {
                        embed.addField('Reason 1', reason.substring(0, 1024))
                        embed.addField('Reason Cont', reason.substring(1024, reason.length))
                    } else embed.addField('Reason', reason)
                await message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
            }
        })
        for (let i = 1; i < names.length; i++) {
            switch (i) {
                case 1: await mes.react('1️⃣'); break;
                case 2: await mes.react('2️⃣'); break;
                case 3: await mes.react('3️⃣'); break;
                case 4: await mes.react('4️⃣'); break;
                case 5: await mes.react('5️⃣'); break;
                case 6: await mes.react('6️⃣'); break;
                case 7: await mes.react('7️⃣'); break;
                case 8: await mes.react('8️⃣'); break;
                case 9: await mes.react('9️⃣'); break;
                case 10: await mes.react('🔟'); break;
            }
        }
        await mes.react('❌')
    }
}