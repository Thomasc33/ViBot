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

        const afkTemplateNames = await AfkTemplate.resolveTemplateAlias(botSettings, message.member, message.guild.id, message.channel.id, alias)
        if (afkTemplateNames.length == 0) return await message.channel.send('This afk template does not exist.')
        const afkTemplateName = afkTemplateNames.length == 1 ? afkTemplateNames[0] : await AfkTemplate.templateNamePrompt(message, afkTemplateNames)

        const afkTemplate = await AfkTemplate.AfkTemplate.tryCreate(bot, bot.settings[message.guild.id], message, afkTemplateName)
        if (afkTemplate instanceof AfkTemplate.AfkTemplateValidationError) {
            await message.channel.send(afkTemplate.message())
            return
        }

        if (!afkTemplate.minimumStaffRoles.some(roles => roles.every(role => message.member.roles.cache.has(role.id)))) return await message.channel.send({ embeds: [createEmbed(message, `You do not have a suitable set of roles out of ${afkTemplate.minimumStaffRoles.reduce((a, b) => `${a}, ${b.join(' + ')}`)} to run ${afkTemplate.name}.`, null)] })
        const body = afkTemplate.processBody()
        const raidStatusEmbed = createEmbed(message, afkTemplate.processBodyHeadcount(null), botSettings.strings[body[1].embed.image] ? botSettings.strings[body[1].embed.image] : body[1].embed.image)
        raidStatusEmbed.setColor(body[1].embed.color ? body[1].embed.color : '#ffffff')
        raidStatusEmbed.setAuthor({ name: `Headcount for ${afkTemplate.name} by ${message.member.nickname}`, iconURL: message.member.user.avatarURL() })
        if (time != 0) {
            raidStatusEmbed.setFooter({ text: `${message.guild.name} • ${Math.floor(time / 60)} Minutes and ${time % 60} Seconds Remaining`, iconURL: message.guild.iconURL() })
            raidStatusEmbed.setDescription(`**Abort <t:${Math.floor(Date.now()/1000)+time}:R>**\n${raidStatusEmbed.data.description}`)
        }
        if (body[1].embed.thumbnail) raidStatusEmbed.setThumbnail(body[1].embed.thumbnail[Math.floor(Math.random()*body[1].embed.thumbnail.length)])
        const raidStatusMessage = await afkTemplate.raidStatusChannel.send({ content: `${afkTemplate.pingRoles ? afkTemplate.pingRoles.join(' ') : ''}`, embeds: [raidStatusEmbed] })
        for (let i in afkTemplate.reacts) {
            if (afkTemplate.reacts[i].onHeadcount && afkTemplate.reacts[i].emote) await raidStatusMessage.react(afkTemplate.reacts[i].emote.id)
        }
        const buttons = afkTemplate.processButtons()
        for (let i in buttons) {
            if ((buttons[i].type == AfkTemplate.TemplateButtonType.NORMAL || buttons[i].type == AfkTemplate.TemplateButtonType.LOG || buttons[i].type == AfkTemplate.TemplateButtonType.LOG_SINGLE) && buttons[i].emote) await raidStatusMessage.react(buttons[i].emote.id)
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
