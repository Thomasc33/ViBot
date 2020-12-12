const ErrorLogger = require('../lib/logError')
const Discord = require('discord.js');

//add this to settings eventually:registered:
const reacts = [{
    reactName: 'cultping',
    prettyName: 'Cults',
    react: '<:malus:701491230332157972>' //<:malus:727619718592200745>
}, {
    reactName: 'voidping',
    prettyName: 'Voids',
    react: '<:void:701491230210523247>'//'<:void_entity:727621690112344216>'
}]

module.exports = {
    name: 'roleassignment',
    args: 'send/init',
    role: 'moderator',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (!settings) return;

        //get arg
        if (args.length == 0) return
        switch (args[0].toLowerCase()) {
            case 'send':
                //make embed
                const embed = new Discord.MessageEmbed()
                    .setTitle(`Role Assignment`)
                    .setDescription('React/Unreact with one of the following emojis to get pinged for specific runs')
                for (let i of reacts) {
                    embed.addField(i.prettyName, i.react, true)
                }
                console.log(embed)

                //get channel
                let channel = message.guild.channels.cache.get(settings.channels.roleassignment)
                if (!channel) return message.channel.send('Could not find channel: ' + settings.channels.roleassignment)

                //send to channel and add reacts
                let m = await channel.send(embed)
                for (let i of reacts) {
                    await m.react(i.react.replace(/[^0-9]/gi, ''))
                }
                return this.init(message.guild, bot)
            case 'init':
                return this.init(message.guild, bot)
        }
    },
    async init(guild, bot) {
        let settings = bot.settings[guild.id]
        if (!settings) return

        //watch reacts with dispose option
        let channel = guild.channels.cache.get(settings.channels.roleassignment)

        let mC = await channel.messages.fetch({ limit: 1 })
        let m = mC.first()
        if (m.author.id !== bot.user.id) return ErrorLogger.log(new Error('Role Assignment message author id is not bots id'), bot)
        let reactionCollector = new Discord.ReactionCollector(m, (r, u) => !u.bot, { dispose: true })
        reactionCollector.on('collect', (r, u) => { handleReact(r, u, false) })
        reactionCollector.on('remove', (r, u) => { handleReact(r, u, true) })
        async function handleReact(r, u, isRemove) {
            //get react type
            let roleID
            for (let i of reacts) {
                if (i.react.replace(/[^0-9]/gi, '') == r.emoji.id) roleID = settings.roles[i.reactName]
            }
            if (!roleID) return
            let member = guild.members.cache.get(u.id)
            if (!member) return
            if (isRemove) member.roles.remove(roleID)
            else member.roles.add(roleID)
        }
    }
}