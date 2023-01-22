const Events = require('../data/events.json')
const Discord = require('discord.js')

module.exports = {
    name: 'events',
    description: 'Shows all current enabled event run types',
    role: 'eventrl',
    args: '[exalts]',
    execute(message, args, bot) {
        this.send(message.channel, bot, args.length && args[0].toLowerCase() == 'exalts');
    },
    send(channel, bot, onlyExalts) {
        let embed = new Discord.EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Current event run types')
        for (let x in Events) if (Events[x].enabled) {
            if (Events[x].isAdvanced && !bot.settings[channel.guild.id].backend.allowAdvancedRuns) continue
            if (onlyExalts && !Events[x].isExalt) continue;
            fitStringIntoEmbed(embed, `${bot.storedEmojis[Events[x].keyEmote].text}${bot.storedEmojis[Events[x].headcountEmote].text} **${x}**${Events[x].aliases.length > 0 ? `\n*Aliases:${Events[x].aliases.map(a => `${` ${a}`}`)}*` : ''}`)
        }
        return channel.send({ embeds: [embed] })
    },
    find(name) {
        name = name.toLowerCase();
        for (const e in Events) {
            if (!Events[e].enabled)
                continue;
            if (e == name || (Events[e].aliases && Events[e].aliases.includes(name)))
                return { eventId: e, event: Events[e] };
        }
        return { eventId: null, event: null }
    }
}

function fitStringIntoEmbed(embed, string) {
    if (!embed.data.fields) embed.addFields({ name: '** **', value: string, inline: true })
    else if (embed.data.fields[embed.data.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
        if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {
            embeds.push(new Discord.EmbedBuilder(embed.data))
            embed.setDescription('None!')
            embed.data.fields = []
        } else embed.addFields({ name: '** **', value: string, inline: true })
    } else {
        if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {
            embeds.push(new Discord.EmbedBuilder(embed.data))
            embed.setDescription('None!')
            embed.data.fields = []
        } else embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`\n${string}`)
    }
}