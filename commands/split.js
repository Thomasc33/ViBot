const Discord = require('discord.js')
const Channels = require('./vibotChannels')
module.exports = {
    name: 'split',
    description: 'Splits the group in a split type run',
    role: 'vetrl',
    async execute(message, args, bot, db) {
        if (!message.member.voice.channel) return message.channel.send('Please join a VC')
        if (!bot.afkChecks[message.member.voice.channel.id] || !bot.afkChecks[message.member.voice.channel.id].split) return message.channel.send('Unable to split your channel')
        const mainGroup = bot.afkChecks[message.member.voice.channel.id].mainGroup
        const splitGroup = bot.afkChecks[message.member.voice.channel.id].splitGroup
        let splitChannel = await createChannel(bot.afkChecks[message.member.voice.channel.id].isVet, message, bot)
        bot.afkChecks[message.member.voice.channel.id].splitChannel = splitChannel.id
        await message.member.voice.setChannel(splitChannel.id)
        for (let i in splitGroup) {
            let member = message.guild.members.cache.get(splitGroup[i])
            if (!member || !member.voice.channel) continue
            await member.voice.setChannel(splitChannel.id).catch(er => {})
        }
    }
}

async function createChannel(isVet, message, bot) {
    let settings = bot.settings[message.guild.id]
    return new Promise(async (res, rej) => {
        //channel creation
        if (isVet) {
            var parent = 'veteran raiding';
            var template = message.guild.channels.cache.get(settings.voice.vettemplate)
            var raider = message.guild.roles.cache.get(settings.roles.vetraider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.vetchannels)
        }
        else {
            var parent = 'raiding';
            var template = message.guild.channels.cache.get(settings.voice.raidingtemplate)
            var raider = message.guild.roles.cache.get(settings.roles.raider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.raidingchannels)
        }
        if (!template) return rej(`Template channel not found`)
        let channel = await template.clone()
        setTimeout(() => channel.setParent(message.guild.channels.cache.filter(c => c.type == 'category').find(c => c.name.toLowerCase() === parent)), 1000)
        await channel.setName(`Split Channel`)

        //allows raiders to view
        await channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))

        //Embed to remove
        let embed = new Discord.MessageEmbed()
            .setDescription('Whenever the run is over. React with the ❌ to delete the channel. View the timestamp for more information')
            .setFooter(channel.id)
            .setTimestamp()
            .setTitle(`Split Channel`)
            .setColor('#ff0000')
        let m = await vibotChannels.send(`${message.member}`, embed)
        await m.react('❌')
        setTimeout(() => { Channels.watchMessage(m, bot, settings) }, 5000)
        if (!channel) rej('No channel was made')
        res(channel);
    })

}