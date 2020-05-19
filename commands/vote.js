module.exports = {
    name: 'vote',
    role: 'Head Raid Leader',
    args: '<ign>',
    description: 'Puts up a vote for promotions based on users current role.',
    notes: 'Puts the message in leader-chat/veteran-rl-chat based on vote',
    execute(message, args, bot) {
        console.log(args.length)
        if(args.length == 0) return;
        let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        let trl = message.guild.roles.cache.find(r => r.name === 'Trial Raid Leader')
        let arl = message.guild.roles.cache.find(r => r.name === 'Almost Raid Leader')
        let rl = message.guild.roles.cache.find(r => r.name === 'Raid Leader')
        let fs = message.guild.roles.cache.find(r => r.name === 'Fullskip')
        if (member.roles.cache.has(fs.id)) {
            voteType = 'Veteran Raid Leader'
            var channel = message.guild.channels.cache.find(c => c.name === 'veteran-rl-chat')
        } else if (member.roles.cache.has(rl.id)) {
            voteType = 'Full Skip'
            var channel = message.guild.chanels.cache.find(c => c.name === 'veteran-rl-chat')
        } else if (member.roles.cache.has(arl.id)) {
            voteType = 'Raid Leader'
            var channel = message.guild.channels.cache.find(c => c.name === 'leader-chat')
        } else if (member.roles.cache.has(trl.id)) {
            voteType = 'Almost Raid Leader'
            var channel = message.guild.channels.cache.find(c => c.name === 'leader-chat')
        } else {
            message.channel.send(`${member} doesn't have a role eligible for promotion`)
            return;
        }
        message.delete()
        channel.send(`${member} to ${voteType}`)
            .then(m => {
                m.react('✅')
                    .then(m.react('😐'))
                    .then(m.react('❌'))
                    .then(m.react('👀'))
            })
    }
}