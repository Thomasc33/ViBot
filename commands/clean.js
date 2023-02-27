const Discord = require('discord.js');

module.exports = {
    name: 'clean',
    description: 'Cleans the voice channel you are in',
    args: '(channelId)',
    requiredArgs: 0,
    role: 'eventrl',
    async execute(message, args, bot) {
        if (!message.member.voice) { return message.channel.send('You are not in any voice channel') }
        let channel = message.channel
        let settings = bot.settings[message.guild.id]
        let lounge = null;
        if (channel.parent.name.toLowerCase() === settings.categories.raiding) lounge = message.guild.channels.cache.get(settings.voice.lounge)
        else if (channel.parent.name.toLowerCase() === settings.categories.veteran) lounge = message.guild.channels.cache.get(settings.voice.vetlounge)
        else lounge = message.guild.channels.cache.get(settings.voice.eventlounge)
        if (channel.id === settings.channels.accursedcommands) lounge = message.guild.channels.cache.get(settings.voice.vetlounge)
        if (!lounge) lounge = message.guild.channels.cache.get(settings.voice.lounge)
        if (!lounge) lounge = message.guild.channels.cache.get(settings.voice.afk)
        if (!lounge) await message.channel.send('I could not find any lounge to move all of the raiders to')
        let vc = null;
        if (args.length > 0) vc = await message.guild.channels.cache.get(args[0]) 
        if (!vc) vc = await message.guild.channels.cache.get(message.member.voice.channelId)
        if (!vc) return message.channel.send('Something went wrong trying to fetch the channel you are in')
        await this.clean(vc, lounge, message.guild, settings);
        await message.channel.send("Channel successfully cleaned");
    },
    async clean(voiceChannel, lounge, guild, settings) {
        voiceChannel.members.each(async member => {
            if (member.roles.highest.position >= guild.roles.cache.get(settings.roles.eventrl).position) { return }
            await member.voice.setChannel(lounge, 'cleaning').catch(er => { })
        })
    }
}