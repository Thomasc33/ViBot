const reqs = require('../data/reqsImages.json')

module.exports = {
    name: 'requirements',
    alias: ['reqs'],
    description: 'Send requirement image in current channel',
    role: 'eventrl',
    async execute(message, args, bot) {
        let im = reqs[message.guild.id]
        if (!im) return message.channel.send('No reqs image for this guild')
        await message.channel.send({ files: [im] })
        message.delete()
    }
}