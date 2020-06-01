const Discord = require('discord.js')

module.exports = {
    name: 'russianroulette',
    alias: 'rr',
    role: 'Security',
    description: 'Begins russian roulette',
    async execute(message, args, bot) {
        let embed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle('Russian Roulette')
            .setDescription(`Started by ${message.member}
            React with 🔫 to join`)
            .setFooter('Time remaining 1 minute')
        let embedMessage = await message.channel.send(embed)
        embedMessage.react('🔫')
        let reactors = []
        let reactionCollector = new Discord.ReactionCollector(embedMessage, gunFilter)
        reactionCollector.on('collect', (r, u) => {
            if (!reactors.includes(u)) reactors.push(u)
        })
        let time = 60
        let timer = setInterval(update, 5000);
        async function update() {
            time = time - 5;
            if (time == 0) {
                shoot()
            }
            embed.setFooter(`Time remaining ${time} seconds`)
            embedMessage.edit(embed)
        }
        async function shoot() {
            clearInterval(timer)
            reactionCollector.stop()
            if (reactors.length == 0) { return; }
            let loser = reactors[Math.floor(Math.random() * reactors.length)]
            if (loser == null) return;

            embed.setDescription(`${embed.description}\nWinner: <@!${loser.id}> was shot to death!
            They have been muted for 1 minute`)
            embed.setFooter('Game Over')
            embedMessage.edit(embed)

            let member = message.guild.members.cache.get(loser.id)

            member.roles.add(message.guild.roles.cache.find(r => r.name === 'Muted'))

            setTimeout(() => { member.roles.remove(message.guild.roles.cache.find(r => r.name === 'Muted')) }, 60000)

        }
    }
}

const gunFilter = (r, u) => r.emoji.name == '🔫' && !u.bot