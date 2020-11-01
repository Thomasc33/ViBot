const botSettings = require('../settings.json')

module.exports = {
    name: 'test',
    description: 'Holds testing code',
    role: 'developer',
    async execute(message, args, bot, db) {
        message.guild.channels.cache.get('701483951687991337').messages.fetch()
            .then(mc => mc.first())
            .then(m => {
                let embed = m.embeds[0];
                embed.fields[1].value = '-2 8/8 Characters\n-1 8/8 Melee Character\n-100 Completed Voids';
                m.edit(embed);
            })
    }
}
