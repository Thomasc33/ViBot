const Discord = require('discord.js')

module.exports = {
    name: 'russianroulette',
    alias: ['rr'],
    role: 'security',
    description: 'Begins russian roulette',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        let embed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle('Russian Roulette')
            .setDescription(`Started by ${message.member}
            React with 🔫 to join`)
            .setFooter('Time remaining 30 seconds')
        let embedMessage = await message.channel.send(embed)
        embedMessage.react('🔫')
        let reactors = []
        let reactionCollector = new Discord.ReactionCollector(embedMessage, gunFilter)
        reactionCollector.on('collect', (r, u) => {
            if (!reactors.includes(u)) reactors.push(u)
        })
        let time = 30
        let timer = setInterval(update, 5000);
        message.delete()
        async function update() {
            time = time - 5;
            if (time == 0) {
                shoot()
                return;
            }
            embed.setFooter(`Time remaining ${time} seconds`)
            embedMessage.edit(embed)
        }
        async function shoot() {
            clearInterval(timer)
            reactionCollector.stop()
            if (reactors.length == 0) { return; }
            let loser = getLoser(0)
            function getLoser(rolls) {
                if (rolls >= 10) return null
                let i = Math.floor(Math.random() * reactors.length)
                let loser = message.guild.members.cache.get(reactors[i].id)
                if (loser == null) return;
                if (loser.roles.cache.has(settings.roles.muted)) return getLoser(rolls + 1)
                else return loser
            }
            if (loser == null) return console.log(`rolled too many times`);
            embed.setDescription(`${embed.description}\nWinner: <@!${loser.id}> was shot to death!
            They have been muted for 1 minute`)
            embed.setFooter('Game Over')
            embedMessage.edit(embed)

            let member = message.guild.members.cache.get(loser.id)

            member.roles.add(settings.roles.muted)

            setTimeout(() => { member.roles.remove(settings.roles.muted) }, 60000)

        }
    }
}

const gunFilter = (r, u) => r.emoji.name == '🔫' && !u.bot