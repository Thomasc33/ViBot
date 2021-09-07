const Discord = require('discord.js')

module.exports = {
    name: 'removeeventboi',
    description: 'Gives user event boi role',
    args: '<id/mention> (proof)',
    requiredArgs: 1,
    alias: ['reb'],
    role: 'security',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        const suspendedRole = message.guild.roles.cache.get(settings.roles.permasuspended)
        const sbvRole = message.guild.roles.cache.get(settings.roles.tempsuspended)
        const eventRole = message.guild.roles.cache.get(settings.roles.eventraider)
        var member = message.mentions.members.first()
        if (member == null) member = message.guild.members.cache.get(args[0]);
        if (member == null) return message.channel.send("User not found")
        if (member.roles.cache.has(suspendedRole.id) || member.roles.cache.has(sbvRole.id)) return message.channel.send("User is suspended")
        if (!member.roles.cache.has(eventRole.id)) return message.channel.send('User does not have event boi')
        await member.roles.remove(eventRole.id)
        let image;
        if (message.attachments.first()) image = message.attachments.first().proxyURL
        if (image == null) image = args[1]
        let embed = new Discord.MessageEmbed()
            .setTitle('Event Boi Removed')
            .setDescription(member.toString())
            .addField('User', member.displayName, true)
            .addField('Removed By', `<@!${message.author.id}>`, true)
            .setTimestamp(Date.now());
        try {
            if (validURL(image)) embed.setImage(image)
            message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] });
            message.channel.send(`Event Boi has been removed from ${member}`)
        } catch (er) {
            message.channel.send('There was an issue attaching the image. However, Event Boi was still removed')
            message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] });
        }
        function validURL(str) {
            var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
                '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
                '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
                '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
                '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
                '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
            return !!pattern.test(str);
        }
    }
}