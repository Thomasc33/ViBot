const ErrorLogger = require('../lib/logError')
const Discord = require('discord.js');

//add this to settings eventually:registered:
const reacts = require('../data/roleAssignment.json')

module.exports = {
    name: 'roleassignment',
    args: 'send/init',
    role: 'moderator',
    async execute(message, args, bot, db) {
        let settings = bot.settings[message.guild.id]
        if (!settings || !settings.backend.roleassignment) return;

        let guildReacts = reacts[message.guild.id]
        if (!guildReacts) return message.channel.send('Reactions not setup for this guild')

        //make embed
        let embed = getEmbed(guildReacts)

        //get channel
        let channel = message.guild.channels.cache.get(settings.channels.roleassignment)
        if (!channel) return message.channel.send('Could not find channel: ' + settings.channels.roleassignment)

        //get arg
        if (args.length == 0) return
        switch (args[0].toLowerCase()) {
            case 'send':
                //send to channel and add reacts
                let m = await channel.send(embed)
                for (let i of guildReacts) {
                    await m.react(i.react.replace(/[^0-9]/gi, ''))
                }
                return this.init(message.guild, bot)

            case 'edit':
                let mC = await channel.messages.fetch({ limit: 1 })
                let m = mC.first()
                if (m.author.id !== bot.user.id) return ErrorLogger.log(new Error('Role Assignment message author id is not bots id'), bot)
                m.edit(embed)
                for (let i of guildReacts) {
                    await m.react(i.react.replace(/[^0-9]/gi, ''))
                }
                return this.init(message.guild, bot)
                
            case 'init':
                return this.init(message.guild, bot)
        }
    },
    async init(guild, bot) {
        let settings = bot.settings[guild.id]
        if (!settings || !settings.backend.roleassignment) return

        let guildReacts = reacts[guild.id]
        if (!guildReacts) return

        //watch reacts with dispose option
        let channel = guild.channels.cache.get(settings.channels.roleassignment)
        if (!channel) return

        let mC = await channel.messages.fetch({ limit: 1 })
        let m = mC.first()
        if (m.author.id !== bot.user.id) return ErrorLogger.log(new Error('Role Assignment message author id is not bots id'), bot)
        let reactionCollector = new Discord.ReactionCollector(m, (r, u) => !u.bot, { dispose: true })
        reactionCollector.on('collect', (r, u) => { handleReact(r, u, false) })
        reactionCollector.on('remove', (r, u) => { handleReact(r, u, true) })
        async function handleReact(r, u, isRemove) {
            //get react type
            let roleID
            for (let i of guildReacts) {
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

function getEmbed(guildReacts) {
    let embed = new Discord.MessageEmbed()
        .setTitle(`Role Assignment`)
        .setDescription('React/Unreact with one of the following emojis to get pinged for specific runs')
    for (let i of guildReacts) {
        embed.addField(i.prettyName, i.react, true)
    }
    return guildReacts
}