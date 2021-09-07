const Discord = require('discord.js');
const events = require('./events');
const eventList = require('../data/events.json')
const lib = require('../lib/extensions.js');

const MINUTE = 60000;

module.exports = {
    name: 'hostkey',
    description: 'The bot will DM you a list of possible keys you have. Follow the instructions to select which keys and how many to notify our staff that you\'re willing to pop.',
    alias: ['host', 'key', 'keys'],
    requiredArgs: 0,
    guildSpecific: true,
    getNotes(guildid, member) {
        return 'Maximum of 5 key types per notification. There is a 30 minute waiting period after a successful notification sent before another can be done.';
    },
    activePanels: [],
    oldSends: [],
    checkActive(id) {
        return this.activePanels.includes(id);
    },
    role: 'eventraider',
    async execute(message, args, bot) {
        const alerts = bot.settings[message.guild.id].channels.keyalerts;
        if (!alerts)
            return message.channel.send(`Command requires more server setup in order to run.`);
        const dm = await message.author.createDM();

        const old = this.oldSends.find(s => s.id == message.author.id);
        if (old && new Date() - old.date < bot.settings[message.guild.id].numerical.waitnewkeyalert * MINUTE)
            return message.channel.send(`You still need to wait before you can send more notifications.`);
        if (old)
            this.oldSends = this.oldSends.filter(s => s.id != message.author.id);

        const eventMsg = await events.send(dm);
        const eventsLink = eventMsg.url;

        this.activePanels.push(message.author.id);
        const panel_embed = new Discord.MessageEmbed()
            .setAuthor("Select keys to pop")
            .setColor("#3498db")
            .setDescription("Select up to 5 key types and how many of each to add. If you put the wrong amount, simply reselect the key type and use the new amount, or 0 to remove it.\n\nSelect from the following:\n🔑 - add a new type of key\n✅ - to send the notification\n❌ - to cancel.\n\nIf you submit, you will not be able to submit more for another 30 minutes.");

        const panel = await dm.send({ embeds: [panel_embed] });
        await panel.react('🔑');
        await panel.react('✅');
        await panel.react('❌');

        let keys = [];

        panel.collector = panel.createReactionCollector((r, u) => !u.bot, { idle: 2 * MINUTE });
        let request = null;
        panel.collector.on('end', reason => {
            if (reason != "Manual") {
                this.activePanels = this.activePanels.filter(id => id != message.author.id);
                panel_embed.setAuthor(`Panel Timed Out`)
                    .setDescription(`Panel has sat idle for too long. If no actions are performed within 2 minutes of the last, this panel times out. If you would like to start again, please use the \`${this.name}\` command in ${message.guild.name}.`)
                    .setTimestamp()
                    .setColor(`#ff0000`);
                panel_embed.fields = [];
                panel.edit({embeds: [panel_embed]});
            }
        })
        panel.collector.on('collect', async (reaction, user) => {
            if (request)
                return;
            switch (reaction.emoji.name) {
                case '❌':
                    panel.collector.stop("Manual");
                    this.activePanels = this.activePanels.filter(id => id != message.author.id);
                    panel_embed.setAuthor(`Cancelled Notifications`)
                        .setDescription(`Manually cancelled key host notification.`)
                        .setTimestamp()
                        .setColor(`#ff0000`);
                    panel_embed.fields = [];
                    panel.edit({embeds: [panel_embed]});
                    return;
                case '✅':
                    panel.collector.stop("Manual");
                    this.activePanels = this.activePanels.filter(id => id != message.author.id);
                    if (!keys.length)
                        return dm.send("You did not select any keys.");

                    for (const key of keys) {
                        bot.channels.cache.get(bot.settings[message.guild.id].channels.keyalerts)
                            .send({
                                embeds: [
                                    new Discord.MessageEmbed()
                                        .setAuthor(`${message.member.nickname || message.author.tag} has ${key.event.name} Keys`, message.author.displayAvatarURL())
                                        .setDescription(`<${key.event.keyEmote}> ${message.member} has \`${key.count}\` ${key.event.name} keys.`)
                                        .setTimestamp()
                                        .setThumbnail(bot.emojis.cache.get(key.event.portalEmojiId).url)
                                        .setColor(key.event.color)
                                ]
                            });
                    }
                    this.oldSends.push({ id: message.author.id, date: new Date() });
                    panel_embed.setAuthor(`Notification Sent`)
                        .setDescription(`${message.guild.name} events staff has been notified that you have the below keys to pop. If a leader wishes to host, they will contact you directly.`)
                        .setTimestamp()
                        .setColor("#00ff00");
                    return panel.edit({embeds: [panel_embed]});
                case '🔑':
                    const embed = new Discord.MessageEmbed()
                        .setAuthor("Select a Dungeon")
                        .setDescription(`Please select a dungeon by typing the name from the [list above](${eventsLink}). Type 'cancel' to cancel this key.`);

                    request = await dm.send({ embeds: [embed] });
                    request.collector = dm.createMessageCollector(m => !m.author.bot && (m.content.toLowerCase() == 'cancel' || !!events.find(m.content)));
                    const reply = await new Promise(async res => {
                        request.collector.on('collect', async message => {
                            const content = message.content.toLowerCase();
                            if (content == 'cancel') {
                                panel.collector.resetTimer();
                                request.collector.stop("Manual");
                                return res();
                            }
                            const { eventId, event } = events.find(content);

                            request.embeds[0].setDescription(`<${event.keyEmote}> You have selected \`${event.name}\`. Is this correct?`)
                                .setColor(event.color)
                                .setAuthor("Confirm Dungeon")
                                .setThumbnail(bot.emojis.cache.get(event.portalEmojiId).url);
                            request.edit({ embed: request.embeds[0] });
                            const confirm = await request.confirm();
                            panel.collector.resetTimer();
                            if (confirm) {
                                request.embeds[0].setAuthor("Select Key Count")
                                    .setDescription(`<${event.keyEmote}> How many \`${event.name}\` keys are you willing to pop? To remove a key, say 0.`);
                                request.edit({ embed: request.embeds[0] });
                                let count = -1;
                                while (count == -1) {
                                    try {
                                        count = await dm.nextInt(i => i >= 0, "Key amount must be 0 or higher.");
                                        panel.collector.resetTimer();
                                    } catch (e) {
                                        if (e == 'Manually cancelled.') {
                                            request.collector.stop("Manual");
                                            return res();
                                        } else {
                                            request.embeds[0].fields.push({
                                                'name': '❌ Error ❌',
                                                'value': `There was an error: \`\`\`${e}\`\`\` Please try again.`
                                            });
                                            request.edit({ embed: request.embeds[0] });
                                            request.embeds[0].fields = [];
                                        }
                                    }
                                }
                                request.collector.stop("Manual");
                                res({ name: eventId, event, count });
                            } else {
                                request.collector.stop("Manual");
                                res();
                            }
                        })
                    });
                    request.delete();
                    request = null;
                    panel.collector.resetTimer();

                    if (reply) {
                        if (reply.count > 0 && keys.length == 5)
                            return dm.send(`You already have 5 dungeons listed. Please remove some by setting key count for them to 0 before adding more.`);

                        const fields = [];
                        if (reply.count == 0)
                            keys = keys.filter(k => k.name != reply.name);
                        else if (keys.find(k => k.name == reply.name))
                            keys.find(k => k.name == reply.name).count = reply.count;
                        else
                            keys.push(reply);

                        for (const key of keys) {
                            fields.push({
                                name: `<${key.event.keyEmote}> ${key.event.name} <${key.event.keyEmote}>`,
                                value: `${key.count}`,
                                inline: true
                            });
                        }

                        panel_embed.fields = fields;
                        panel.edit({ embeds: [panel_embed] });
                    }
                    return;
            }
        })
    }
};