const Discord = require('discord.js')

module.exports = {
    name: 'manualeventboi',
    description: 'Gives user event boi role',
    args: '<id/mention> <ign> (proof)',
    requiredArgs: 2,
    alias: ['meb'],
    role: 'security',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        const suspendedRole = message.guild.roles.cache.get(settings.roles.permasuspended)
        const sbvRole = message.guild.roles.cache.get(settings.roles.tempsuspended)
        const eventRole = message.guild.roles.cache.get(settings.roles.eventraider)
        var member = message.mentions.members.first()
        if (member == null) {
            member = message.guild.members.cache.get(args[0]);
        }
        if (member == null) {
            message.channel.send("User not found")
            return;
        }
        if (member.roles.cache.has(suspendedRole.id) || member.roles.cache.has(sbvRole.id)) {
            message.channel.send("User is suspended")
            return;
        }
        await member.roles.add(eventRole)
        let tag = member.user.tag.substring(0, member.user.tag.length - 5)
        let nick = ''
        if (tag == args[1]) {
            nick = args[1].toLowerCase()
            if (tag == nick) {
                nick = nick.charAt(0).toUpperCase() + nick.substring(1, nick.length)
            }
        } else nick = args[1]
        await member.setNickname(nick)
        let image;
        if (message.attachments.first() != null) image = message.attachments.first().proxyURL
        if (image == null) image = args[2]
        let embed = new Discord.MessageEmbed()
            .setTitle('Manual Event Boi Verify')
            .setDescription(member)
            .addField('User', member.displayName, true)
            .addField('Verified By', `<@!${message.author.id}>`, true)
            .setTimestamp(Date.now());
        try {
            if (validURL(image)) embed.setImage(image)
            message.guild.channels.cache.get(settings.channels.modlogs).send({ embeds: [embed] });
            message.channel.send(`${member} has been given ${eventRole}`)
        } catch (er) {
            message.channel.send('There was an issue attaching the image. However they have still been verified as event boi')
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