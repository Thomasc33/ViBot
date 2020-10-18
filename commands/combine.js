const split = require("./split")

module.exports = {
    name: 'combine',
    role: 'fullskip',
    description: 'Combines the channels after a split',
    async execute(message, args, bot){
        let channel = message.member.voice.channel
        if(!channel) return message.channel.send('Please join a VC')
        let found = false
        let mainChannel, splitChannelID
        for(let i in bot.afkChecks){
            if(i == channel.id) {
                found = true
                mainChannel = i;
                splitChannelID = bot.afkChecks[i].splitChannel
            }
            if(bot.afkChecks[i].splitChannel == channel.id){
                found = true
                mainChannel = i;
                splitChannelID = channel.id
            }
        }
        if(!found || !mainChannel || !splitChannelID) return message.channel.send(`Could not combine this channel`)
        let splitChannel = message.guild.channels.cache.get(splitChannelID)
        if(!splitChannel) return message.channel.send(`Could not find split channel`)
        let splitMembers =splitChannel.members.array()
        for(let i in splitMembers){
            let m = splitMembers[i]
            await m.voice.setChannel(mainChannel).catch(er => {})
        }
    }
}