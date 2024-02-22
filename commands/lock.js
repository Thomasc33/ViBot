const { PermissionsBitField } = require('discord.js');
const { settings } = require('../lib/settings');

module.exports = {
    name: 'lock',
    description: 'Locks voice channel',
    alias: ['rc', 'resetchannel'],
    role: 'eventrl',
    async execute(message, args, bot) {
        const { roles: { raider, vetraider } } = settings[message.guild.id];

        // Get Channel
        let channel = message.member.voice.channel;
        if (!channel) return message.channel.send('You must be in a voice channel to use this command.');

        const raiderRole = channel.parent.name.toLowerCase().includes('veteran') ? vetraider : raider;
        if (!channel.permissionOverwrites.cache.get(raiderRole).allow.has(PermissionsBitField.Flags.ViewChannel)) return message.channel.send('Cannot lock this channel.');
        await channel.permissionOverwrites.edit(raiderRole, { ViewChannel: true, Connect: false }, 'Channel locked by ' + message.author.tag);

        // React to message
        await message.react('🔒');
    }
}