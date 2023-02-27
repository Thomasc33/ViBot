const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'lock',
    description: 'Locks voice channel',
    alias: ['rc', 'resetchannel'],
    role: 'eventrl',
    async execute(message, args, bot) {
        // Get Settings
        const settings = bot.settings[message.guild.id];

        // Get Channel
        let channel = message.member.voice.channel;
        if (!channel) return message.channel.send('You must be in a voice channel to use this command.');

        // Get appropriate raider role
        let raiderRole = settings.roles.raider
        if (channel.parent.name.toLowerCase().includes('veteran')) raiderRole = settings.roles.vetraider

        // Check to see if raider can view channel
        if (!channel.permissionOverwrites.cache.get(raiderRole).allow.has(PermissionsBitField.Flags.ViewChannel)) return message.channel.send('Cannot lock this channel.');

        // Allow raiders to connect
        await channel.permissionOverwrites.edit(raiderRole, { ViewChannel: true, Connect: false }, 'Channel locked by ' + message.author.tag);

        // React to message
        await message.react('🔒');
    }
}