module.exports = {
    name: 'bruh',
    description: 'Join your vc and say "bruh"',
    cooldown: 10,
    role: 'developer',
    patreonRole: '799192196842258482',
    async execute(message, args, bot, db) {
        let channel = message.guild.channels.cache.get(args[0]) || message.member.voice.channel
        if (!channel) return message.channel.send('Join a VC')
        
        // connect to the channel and play bruh.mp3
        let connection = await channel.join()
        let dispatcher = connection.play('./bruh.mp3')

        // wait 5 seconds and disconnect
        await sleep(5000)
        dispatcher.destroy()
        connection.disconnect()
    }
}

async function sleep(ms) {
    return new Promise(res => setTimeout(() => res(), ms))
}