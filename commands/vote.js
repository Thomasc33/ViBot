module.exports = {
    name: 'vote',
    role: 'Head Raid Leader',
    args: '<ign>',
    description: 'Puts up a vote for promotions based on users current role.',
    notes: 'Puts the message in leader-chat/veteran-rl-chat based on vote',
    async execute(message, args, bot) {
        let settings = bot.settings[message.guild.id]
        if (args.length == 0) return;
        let member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[0].toLowerCase()));
        if (member == null) { message.channel.send('Issue finding user. Try again'); return; }
        let trl = message.guild.roles.cache.find(r => r.name === settings.trl)
        let arl = message.guild.roles.cache.find(r => r.name === settings.arl)
        let rl = message.guild.roles.cache.find(r => r.name === settings.rl)
        let fs = message.guild.roles.cache.find(r => r.name === settings.fs)
        if (member.roles.cache.has(fs.id)) {
            voteType = 'Veteran Raid Leader'
            var channel = message.guild.channels.cache.find(c => c.name === settings.vetleaderchat)
        } else if (member.roles.cache.has(rl.id)) {
            voteType = 'Fullskip'
            var channel = message.guild.channels.cache.find(c => c.name === settings.vetleaderchat)
        } else if (member.roles.cache.has(arl.id)) {
            voteType = 'Raid Leader'
            var channel = message.guild.channels.cache.find(c => c.name === settings.leaderchat)
        } else if (member.roles.cache.has(trl.id)) {
            voteType = 'Almost Raid Leader'
            var channel = message.guild.channels.cache.find(c => c.name === settings.leaderchat)
        } else {
            message.channel.send(`${member} doesn't have a role eligible for promotion`)
            return;
        }
        message.delete()
        let m = await channel.send(`${member} to ${voteType}`)
        await m.react('✅')
        await m.react('😐')
        await m.react('❌')
        if (voteType == 'Raid Leader' || voteType == 'Almost Raid Leader') {
            m.react('👀')
        }
    }
}