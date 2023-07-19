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
        let embeds = []
        for (let x in Events) if (Events[x].enabled) {
            if (Events[x].isExalted && !bot.settings[channel.guild.id].backend.allowExaltedRuns) continue
            if (onlyExalts && !Events[x].isExalt) continue;
            fitStringIntoEmbed(embeds, embed, `${Events[x].keyEmote ? bot.storedEmojis[Events[x].keyEmote].text : ""}${Events[x].headcountEmote ? bot.storedEmojis[Events[x].headcountEmote].text : ""} **${x}**${Events[x].aliases.length > 0 ? `\n*Aliases:${Events[x].aliases.map(a => `${` ${a}`}`)}*` : ''}`)
        }
        embeds.push(new Discord.EmbedBuilder(embed.data))
        return channel.send({ embeds: embeds })
        
        
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

function fitStringIntoEmbed(embeds, embed, string) {
    if (!embed.data.fields) embed.addFields({ name: '** **', value: string, inline: true })
    else if (embed.data.fields[embed.data.fields.length - 1].value.length + `\n${string}`.length >= 1024) {
        if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {
            embeds.push(new Discord.EmbedBuilder(embed.data))
            embed.setDescription(null)
            embed.data.fields = null
        } else embed.addFields({ name: '** **', value: string, inline: true })
    } else {
        if (JSON.stringify(embed.toJSON()).length + `\n${string}`.length >= 6000) {
            embeds.push(new Discord.EmbedBuilder(embed.data))
            embed.setDescription(null)
            embed.data.fields = null
        } else embed.data.fields[embed.data.fields.length - 1].value = embed.data.fields[embed.data.fields.length - 1].value.concat(`\n${string}`)
    }
}