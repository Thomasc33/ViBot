const Discord = require('discord.js')

module.exports = {
    name: 'manualeventboi',
    description: 'Gives user event boi role',
    args: '<id/mention> <ign> (proof)',
    role: 'Security',
    async execute(message, args, bot) {
        const suspendedRole = message.guild.roles.cache.find(r => r.name === 'Suspended');
        const sbvRole = message.guild.roles.cache.find(r => r.name === 'Suspended but Verified');
        const eventRole = message.guild.roles.cache.find(r => r.name === 'Event boi');
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
        await member.setNickname(args[1])
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
            message.guild.channels.cache.find(c => c.name === 'mod-logs').send(embed);
            message.channel.send(`${member} has been given ${eventRole}`)
        } catch (er) {
            message.channel.send('There was an issue attaching the image. However they have still been verified as event boi')
            message.guild.channels.cache.find(c => c.name === 'mod-logs').send(embed);
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