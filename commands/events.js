const Events = require('../data/events.json')
const Discord = require('discord.js')

module.exports = {
    name: 'events',
    description: 'Shows all current enabled event run types',
    role: 'eventrl',
    execute(message, args, bot) {
        this.send(message.channel);
    },
    send(channel) {
        let embed = new Discord.MessageEmbed()
            .setColor('#ff0000')
            .setTitle('Current event run types')
        for (let x in Events) if (Events[x].enabled) {
            fitStringIntoEmbed(embed, `<${Events[x].keyEmote}><${Events[x].portalEmote}> **${x}**${Events[x].aliases.length > 0 ? `\n*Aliases:${Events[x].aliases.map(a => `${` ${a}`}`)}*` : ''}`)
        }
        return channel.send(embed)
    },
    find(name) {
        name = name.toLowerCase();
        for (const e in Events)
        {
            if (!Events[e].enabled)
                continue;
            if (e == name || (Events[e].aliases && Events[e].aliases.includes(name)))
                return { eventId: e, event: Events[e] };
        }
    }
}

function fitStringIntoEmbed(embed, string) {
    if (embed.fields.length == 0) embed.addField('** **', string, true)
    else if (embed.fields[embed.fields.length - 1].value.length + `\n${string}`.length >= 1024) { //change to 1024
        if (embed.length + `\n${string}`.length >= 6000) {//change back to 6k
            embeds.push(new Discord.MessageEmbed(embed))
            embed.setDescription('None!')
            embed.fields = []
        } else embed.addField('** **', string, true)
    } else {
        if (embed.length + `\n${string}`.length >= 6000) { //change back to 6k
            embeds.push(new Discord.MessageEmbed(embed))
            embed.setDescription('None!')
            embed.fields = []
        } else embed.fields[embed.fields.length - 1].value = embed.fields[embed.fields.length - 1].value.concat(`\n${string}`)
    }
}