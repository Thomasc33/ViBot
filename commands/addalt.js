const Discord = require('discord.js')
const ErrorLogger = require('../logError')

module.exports = {
    name: 'addalt',
    description: 'Adds the username of an alt to a user and logs it',
    alias: ['aa'],
    args: '<id/mention> <alt name> <image>',
    requiredArgs: 2,
    role: 'security',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        var member = message.mentions.members.first()
        if (!member) member = message.guild.members.cache.get(args.shift());
        else { args.shift() }
        const altName = args.shift();
        let dupeName = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(altName.toLowerCase()));
        if (dupeName) return message.channel.send(`${dupeName} already has the name ${altName}`)
        let image = message.attachments.first().proxyURL
        if (!image) image = args[2]
        if (!image) return message.channel.send(`Please provide an image`)
        if (!validURL(image)) return message.channel.send(`Error attaching the image. Please try again`)
        let confirmMessage = await message.channel.send(`Are you sure you want to add the alt ${altName} to ${member}? Y/N`);
        let collector = new Discord.MessageCollector(message.channel, m => m.author.id === message.author.id, { time: 10000 });
        collector.on('collect', async m => {
            try {
                if (m.content.toLowerCase().charAt(0) == 'y') {
                    member.setNickname(`${member.nickname} | ${altName}`);
                    let embed = new Discord.MessageEmbed()
                        .setTitle('Alt Added')
                        .setDescription(member)
                        .addField('Main', member.nickname, true)
                        .addField('New Alt', altName, true)
                        .addField('Added By', `<@!${message.author.id}>`)
                        .setTimestamp(Date.now())
                        .setImage(image)
                    await message.guild.channels.cache.get(settings.channels.modlogs).send(embed);
                    collector.stop();
                    message.react('✅')
                    confirmMessage.delete()
                    db.query(`DELETE FROM veriblacklist WHERE id = '${altName}'`)
                } else {
                    message.channel.send('Response not recognized. Please try suspending again');
                    collector.stop();
                }
            } catch (er) {
                message.channel.send('Error adding alt. `;addalt <id> <alt name> <proof>')
                ErrorLogger.log(er, bot)
            }
        })

    }
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