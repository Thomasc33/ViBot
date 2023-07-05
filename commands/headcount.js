const Discord = require('discord.js');
const AfkTemplate = require('./afkTemplate.js');
const afkCheck = require('./afkCheck');
const { createEmbed } = require('../lib/extensions.js');

module.exports = {
    name: 'headcount',
    description: 'Puts a headcount in a raid status channel',
    alias: ['hc'],
    requiredArgs: 1,
    args: '<run type>',
    role: 'eventrl',
    getNotes(guildid, member) {
        return `**Run Types:**\n*Regular Afk Checks:*\n${afkCheck.getNotes(guildid, member)}\n*Events:*\nSee \`;events\``
    },
    async execute(message, args, bot) {
        //settings
        const botSettings = bot.settings[message.guild.id]
        let alias = args.shift().toLowerCase()
        const afkTemplate = new AfkTemplate.AfkTemplate(bot, botSettings, message, alias)
        await afkTemplate.init()
        const currentStatus = afkTemplate.getStatus()
        if (currentStatus.state != AfkTemplate.TemplateState.SUCCESS) return await message.channel.send(currentStatus.message)
        afkTemplate.processReacts()
        afkTemplate.processButtons(null)

        const raidStatusEmbed = createEmbed(message, afkTemplate.processBodyDescriptionHeadcount(), afkTemplate.body[1].embed.image)
        raidStatusEmbed.setColor(afkTemplate.body[1].embed.color ? afkTemplate.body[1].embed.color : '#ffffff')
        raidStatusEmbed.setAuthor({ name: `Headcount for ${afkTemplate.name} by ${message.member.nickname}`, iconURL: message.member.user.avatarURL() })
        if (afkTemplate.body[1].embed.thumbnail) raidStatusEmbed.setThumbnail(afkTemplate.body[1].embed.thumbnail[Math.floor(Math.random()*afkTemplate.body[1].embed.thumbnail.length)])
        const raidStatusMessage = await afkTemplate.raidStatusChannel.send({ content: `${afkTemplate.pingRoles ? afkTemplate.pingRoles.join(' ') : ''}`, embeds: [raidStatusEmbed] })
        for (let i in afkTemplate.reacts) {
            if (afkTemplate.reacts[i].onHeadcount && afkTemplate.reacts[i].emote) await raidStatusMessage.react(afkTemplate.reacts[i].emote.id)
        }
        for (let i in afkTemplate.buttons) {
            if (afkTemplate.buttons[i].type == AfkTemplate.TemplateButtonType.NORMAL || afkTemplate.buttons[i].type == AfkTemplate.TemplateButtonType.LOG && afkTemplate.buttons[i].emote) await raidStatusMessage.react(afkTemplate.buttons[i].emote.id)
        }
        message.react('✅')
    }
}