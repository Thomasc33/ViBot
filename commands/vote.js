module.exports = {
    name: 'vote',
    role: 'Head Raid Leader',
    args: '<ign>',
    description: 'Puts up a vote for promotions based on users current role.',
    notes: 'Puts the message in leader-chat/veteran-rl-chat based on vote',
    async execute(message, args, bot) {
        if (args.length == 0) return;
        for (let i in args) {
            let member = message.guild.members.cache.get(args[0])
            if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(args[i].toLowerCase()));
            if (!member) return message.channel.send(`Issue finding ${args[i]}. Try again`);
            postVote(message, member, bot)
        }
        message.delete()
    }
}

async function postVote(message, member, bot) {
    let settings = bot.settings[message.guild.id]
    let trl = message.guild.roles.cache.get(settings.roles.trialrl)
    let arl = message.guild.roles.cache.get(settings.roles.almostrl)
    let rl = message.guild.roles.cache.get(settings.roles.rl)
    let fs = message.guild.roles.cache.get(settings.roles.fullskip)
    if (member.roles.cache.has(fs.id)) {
        voteType = 'Veteran Raid Leader'
        var channel = message.guild.channels.cache.get(settings.channels.vetleaderchat)
    } else if (member.roles.cache.has(rl.id)) {
        voteType = 'Fullskip'
        var channel = message.guild.channels.cache.get(settings.channels.vetleaderchat)
    } else if (member.roles.cache.has(arl.id)) {
        voteType = 'Raid Leader'
        var channel = message.guild.channels.cache.get(settings.channels.leaderchat)
    } else if (member.roles.cache.has(trl.id)) {
        voteType = 'Almost Raid Leader'
        var channel = message.guild.channels.cache.get(settings.channels.leaderchat)
    } else {
        message.channel.send(`${member} doesn't have a role eligible for promotion`)
        return;
    }
    let m = await channel.send(`${member} to ${voteType}`)
    await m.react('✅')
    await m.react('😐')
    await m.react('❌')
    if (voteType == 'Raid Leader' || voteType == 'Almost Raid Leader') {
        m.react('👀')
    }
}