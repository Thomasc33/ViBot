const Discord = require('discord.js');
const AfkTemplate = require('./afkTemplate.js');
const afkCheck = require('./afkCheck');
const { createEmbed } = require('../lib/extensions.js');

module.exports = {
    name: 'headcount',
    description: 'Puts a headcount in a raid status channel',
    alias: ['hc'],
    requiredArgs: 1,
    args: '<run type> (time) (time type s/m)',
    role: 'eventrl',
    async execute(message, args, bot) {
        //settings
        const botSettings = bot.settings[message.guild.id]
        let alias = args.shift().toLowerCase()
        let time = 0
        if (args.length >= 2) {
            time = parseInt(args.shift())
            switch (args.shift().toLowerCase()) {
                case 's': 
                    break
                case 'm': 
                    time *= 60
                    break
                default: 
                    return message.channel.send("Please enter a valid time type __**s**__econd, __**m**__inute)")
            }
        }
        const afkTemplate = new AfkTemplate.AfkTemplate(bot, botSettings, message, alias)
        await afkTemplate.init()
        const currentStatus = afkTemplate.getStatus()
        if (currentStatus.state != AfkTemplate.TemplateState.SUCCESS) return await message.channel.send(currentStatus.message)
        if (!afkTemplate.minimumStaffRoles.some(roles => roles.every(role => message.member.roles.cache.has(role.id)))) return await message.channel.send({ embeds: [createEmbed(message, `You do not have a suitable set of roles out of ${afkTemplate.minimumStaffRoles.reduce((a, b) => `${a}, ${b.join(' + ')}`)} to run ${afkTemplate.name}.`, null)] })
        afkTemplate.processReacts()
        afkTemplate.processButtons(null)
        const raidStatusEmbed = createEmbed(message, afkTemplate.processBodyDescriptionHeadcount(), botSettings.strings[afkTemplate.body[1].embed.image] ? botSettings.strings[afkTemplate.body[1].embed.image] : afkTemplate.body[1].embed.image)
        raidStatusEmbed.setColor(afkTemplate.body[1].embed.color ? afkTemplate.body[1].embed.color : '#ffffff')
        raidStatusEmbed.setAuthor({ name: `Headcount for ${afkTemplate.name} by ${message.member.nickname}`, iconURL: message.member.user.avatarURL() })
        if (time != 0) {
            raidStatusEmbed.setFooter({ text: `${message.guild.name} • ${Math.floor(time / 60)} Minutes and ${time % 60} Seconds Remaining`, iconURL: message.guild.iconURL() })
            raidStatusEmbed.setDescription(`**Abort <t:${Math.floor(Date.now()/1000)+time}:R>**\n${raidStatusEmbed.data.description}`)
        }
        if (afkTemplate.body[1].embed.thumbnail) raidStatusEmbed.setThumbnail(afkTemplate.body[1].embed.thumbnail[Math.floor(Math.random()*afkTemplate.body[1].embed.thumbnail.length)])
        const raidStatusMessage = await afkTemplate.raidStatusChannel.send({ content: `${afkTemplate.pingRoles ? afkTemplate.pingRoles.join(' ') : ''}`, embeds: [raidStatusEmbed] })
        for (let i in afkTemplate.reacts) {
            if (afkTemplate.reacts[i].onHeadcount && afkTemplate.reacts[i].emote) await raidStatusMessage.react(afkTemplate.reacts[i].emote.id)
        }
        for (let i in afkTemplate.buttons) {
            if ((afkTemplate.buttons[i].type == AfkTemplate.TemplateButtonType.NORMAL || afkTemplate.buttons[i].type == AfkTemplate.TemplateButtonType.LOG || afkTemplate.buttons[i].type == AfkTemplate.TemplateButtonType.LOG_SINGLE) && afkTemplate.buttons[i].emote) await raidStatusMessage.react(afkTemplate.buttons[i].emote.id)
        }

        function updateHeadcount() {
            time -= 5
            if (time <= 0) {
                clearInterval(this)
                raidStatusEmbed.setImage(null)
                raidStatusEmbed.setDescription(`This headcount has been aborted`)
                raidStatusEmbed.setFooter({ text: `${message.guild.name} • Aborted`, iconURL: message.guild.iconURL() })
                raidStatusMessage.edit({ embeds: [raidStatusEmbed] })
                return
            }
            raidStatusEmbed.setFooter({ text: `${message.guild.name} • ${Math.floor(time / 60)} Minutes and ${time % 60} Seconds Remaining`, iconURL: message.guild.iconURL() })
            raidStatusMessage.edit({ embeds: [raidStatusEmbed] })
        }
        if (time != 0) setInterval(() => updateHeadcount(), 5000)
        message.react('✅')
    }
}