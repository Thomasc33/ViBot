module.exports = {
    name: 'bruh',
    description: 'Join your vc and say "bruh"',
    role: 'developer',
    async execute(message, args, bot, db) {
        let channel = message.member.voice.channel
        if (!channel) return message.channel.send('Join a VC')
        let connection = await channel.join()
        connection.play('./bruh.mp3')
        await sleep(1500)
        connection.disconnect()
    }
}

async function sleep(ms) {
    return new Promise(res => setTimeout(() => res(), ms))
}