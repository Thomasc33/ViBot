module.exports = {
    name: 'bruh',
    description: 'Join your vc and say "bruh"',
    cooldown: 10,
    role: 'developer',
    async execute(message, args, bot, db) {
        let channel = message.guild.channels.cache.get(args[0]) || message.member.voice.channel
        if (!channel) return message.channel.send('Join a VC')
        let connection = await channel.join()
        connection.play('./data/bruh.mp3')
        await sleep(1500)
        connection.disconnect()
        message.delete()
    }
}

async function sleep(ms) {
    return new Promise(res => setTimeout(() => res(), ms))
}