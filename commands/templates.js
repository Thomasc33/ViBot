const Discord = require('discord.js')
const templates = require('../data/afkTemplates.json')
const { createEmbed } = require('../lib/extensions.js')

module.exports = {
    name: 'templates',
    description: 'Shows all current enabled afk run templates',
    role: 'eventrl',
    args: '[exalts]',
    execute(message, args, bot) {
        const botSettings = bot.settings[message.guild.id]
        const templateEmbed = createEmbed(message, `The dungeons displayed are specific to this channel, ${message.channel} and your highest staff role, ${message.member.roles.highest}.`, null)
        templateEmbed.setColor('#ff0000')
        templateEmbed.setTitle('Available Templates')
        const parentTemplates = Object.keys(templates[message.guild.id].parents).filter(template => message.channel.id == templates[message.guild.id].parents[template].commandsChannel)
        const parentTemplateValue = {}
        for (let template of templates[message.guild.id].children) {
            if (!template.enabled) continue
            for (let inherit of template.inherits) {
                if (!parentTemplates.includes(inherit)) continue
                if (!parentTemplateValue[inherit]) parentTemplateValue[inherit] = {field: 0, value: ['']}
                const parentTemplate = templates[message.guild.id].parents[inherit]
                let minStaffRole = template.minStaffRole ? message.guild.roles.cache.get(botSettings.roles[template.minStaffRole]) : null
                minStaffRole = !minStaffRole && parentTemplate.minStaffRole ? message.guild.roles.cache.get(botSettings.roles[parentTemplate.minStaffRole]) : minStaffRole
                if (!minStaffRole) continue
                if (minStaffRole.position > message.member.roles.highest.position) continue
                const reacts = template.reacts ? Object.keys(template.reacts).filter(react => template.reacts[react].onHeadcount) : []
                let newTemplate = `\n${reacts[0] ? `${bot.storedEmojis[template.reacts[reacts[0]].emote].text}| ` : ``}\`${template.aliases.reduce((a, b) => a.length <= b.length ? a : b).padStart(3)}\` | **${template.name}**`
                if (parentTemplateValue[inherit].value[parentTemplateValue[inherit].field].length + newTemplate.length > 1024) {
                    parentTemplateValue[inherit].field++
                    parentTemplateValue[inherit].value.push('')
                }
                parentTemplateValue[inherit].value[parentTemplateValue[inherit].field] += newTemplate
            }
        }
        for (let template of parentTemplates) {
            if (!parentTemplateValue[template]) continue
            parentTemplateValue[template].value.forEach((value, index) => templateEmbed.addFields({ name: `**${template.charAt(0).toUpperCase() + template.slice(1)}${index ? ` Cont.` : ``}**`, value: value, inline: true }))
        }
        message.channel.send({ embeds: [templateEmbed] })
        message.react('✅')
    }
}
