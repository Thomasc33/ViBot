const Discord = require('discord.js')
const ErrorLogger = require('../logError')
const fs = require('fs')

module.exports = {
    name: 'unmute',
    description: 'Removes muted role from user',
    args: '<ign/mention/id>',
    role: 'Security',
    async execute(message, args, bot) {
        var member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0]);
        if (member == null) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (member == null) { message.channel.send('User not found. Please try again'); return; }
        if (member.roles.highest.position >= message.member.roles.highest.position) {
            message.channel.send(`${member} has a role greater than or equal to you and cannot be unmuted by you`);
            return;
        }
        let muted = message.guild.roles.cache.find(r => r.name === 'Muted')
        if (!member.roles.cache.has(muted.id)) {
            message.channel.send(`${member} is not muted`)
            return;
        }
        let found = false;
        for (let i in bot.mutes) {
            if (i == member.id && bot.mutes[i].guild == message.guild.id) {
                found = true;
                const reason = bot.mutes[i].reason
                const by = message.guild.members.cache.get(bot.mutes[i].modid)
                const unmuteDate = new Date(bot.mutes[i].time)
                let embed = new Discord.MessageEmbed()
                    .setTitle('Confirm Action')
                    .setColor('#ff0000')
                    .setDescription(`Are you sure you want to unmute ${member}\nReason: ${reason}\nMuted by ${by}\nMuted until: ${unmuteDate.toDateString()}`)
                let confirmMessage = await message.channel.send(embed)
                let reactionCollector = new Discord.ReactionCollector(confirmMessage, (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌'))
                await confirmMessage.react('✅')
                await confirmMessage.react('❌')
                reactionCollector.on('collect', async (r, u) => {
                    confirmMessage.delete()
                    if (r.emoji.name !== '✅') return;
                    await member.roles.remove(muted.id).catch(er => ErrorLogger.log(er, bot))
                    await message.channel.send(`${member} has been unmuted`)
                    delete bot.mutes[i];
                    fs.writeFileSync('./mutes.json', JSON.stringify(bot.mutes, null, 4), async err => {
                        if (err) ErrorLogger.log(err, bot)
                    })
                })
            }
        }
        if (!found) {
            let embed = new Discord.MessageEmbed()
                .setTitle('Confirm Action')
                .setColor('#ff0000')
                .setDescription(`I don't have any log of ${member} being muted. Are you sure you want to unmute them?`)
            let confirmMessage = await message.channel.send(embed)
            let reactionCollector = new Discord.ReactionCollector(confirmMessage, (r, u) => !u.bot && u.id == message.author.id && (r.emoji.name === '✅' || r.emoji.name === '❌'))
            await confirmMessage.react('✅')
            await confirmMessage.react('❌')
            reactionCollector.on('collect', async (r, u) => {
                confirmMessage.delete()
                if (r.emoji.name !== '✅') return;
                member.roles.remove(muted.id).catch(er => ErrorLogger.log(er, bot))
                message.channel.send(`${member} has been unmuted`)
            })
        }
    }
}