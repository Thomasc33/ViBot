const Discord = require('discord.js')
const fs = require('fs')
const botSettings = require('../settings.json')
const ErrorLogger = require('../lib/logError')
const vibotChannel = require('./vibotChannels.js')
var watchedMessages = []
var watchedButtons = {}; //the keys for this are the id of a VC
                         //{VC_ID: {hndlr: ACTIVATE_CHANNEL_MESSAGE_HANDLER,
                        //          confirm_hndlrs: EPHMRL_CONFIRMATION_MESSAGE_HANDLERS}
                        //}
let afkCheckModule; //if a channel is closed while the afk check is active
                    //we need to abort the run
                    //since afkCheck.js requires this module already we have
                    //afkCheck.js register itself here the first time someone
                    //uses the afk command

module.exports = {
    name: 'vibotchannels',
    description: 'update',
    role: 'developer',
    async execute(message, args, bot, db) {
        if (args[0].toLowerCase() == 'update') this.update(message.guild, bot)
    },
    async update(guild, bot) {
        let settings = bot.settings[guild.id]
        await updateChannel(guild.channels.cache.get(settings.channels.raidingchannels))
        await updateChannel(guild.channels.cache.get(settings.channels.vetchannels))
        await updateChannel(guild.channels.cache.get(settings.channels.eventchannels))
        async function updateChannel(c) {
            if (!c) return;
            let messages = await c.messages.fetch()
            messages.each(async m => {
                if (m.author.id !== bot.user.id) return;
                if (m.embeds.length == 0) return;
                let embed = m.embeds[0]
                //we have a message, we have no channel -> delete message
                if(!guild.channels.cache.get(embed.footer.text)) {
                    m.delete();
                }
                //we have a message, we have a channel -> check if its watched already
                else if(watchedButtons[embed.footer.text] === undefined) {
                    //no? add a listener
                    module.exports.addCloseChannelButtons(bot, m);
                }
            })
        }
        for (let i in bot.afkChecks) {
            if (!guild.channels.cache.get(i)) delete bot.afkChecks[i]
        }
        fs.writeFile('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => {
            if (err) ErrorLogger.log(err, bot)
        })
    },
    async watchMessage(message, bot, settings) {
        let m = message
        let embed = m.embeds[0]
        if (watchedMessages.includes(embed.footer)) return
        watchedMessages.push(embed.footer)
        let channel = message.guild.channels.cache.get(embed.footer.text)
        if (!channel) return m.delete()
        let channelName = channel.name
        let reactionCollector = new Discord.ReactionCollector(m, { filter: xFilter })
        reactionCollector.on('collect', async (r, u) => {
            reactionCollector.stop()
            if (!m.mentions.members.first()) return remove()
            if (u.id == m.mentions.members.first().id) remove()
            else {
                await m.reactions.removeAll()
                await m.react('✅')
                await m.react('❌')
                embed.footer.text = `Openned By ${m.guild.members.cache.get(u.id).nickname||u.tag} • ${embed.footer.text}`;
                message =  m = await m.edit({ embeds: m.embeds })
                embed = message.embeds[0]
                let confirmReactionCollector = new Discord.ReactionCollector(m, { filter: (r, uu) => (r.emoji.name === '✅' || r.emoji.name === '❌') && u.id == uu.id })

                confirmReactionCollector.on('collect', async (r, u) => {
                    if (r.emoji.name == '❌') {
                        await m.reactions.removeAll()
                        confirmReactionCollector.stop()
                        await m.react('❌')
                        m.embeds[0].footer.text = embed.footer.text.split(' ').pop()
                        message = m = await m.edit({ embeds: m.embeds })
                        embed = message.embeds[0]
                        await this.update(m.guild, bot)
                    } else remove()
                })
            }
            async function remove() {
                for (let i in bot.afkChecks) {
                    const id = embed.footer.text.split(' ').pop()
                    if (i == id) {
                        let key = await message.guild.members.cache.get(bot.afkChecks[i].key)
                        if (key) {
                            let keyRole = await message.guild.roles.cache.get(settings.roles.tempkey)
                            await key.roles.remove(keyRole.id).catch(r => ErrorLogger.log(r, bot))
                        }
                        delete bot.afkChecks[i];
                        fs.writeFile('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => {
                            if (err) ErrorLogger.log(err, bot)
                        })
                    }
                }
                message.guild.channels.cache.get(settings.channels.history).send({
                    embeds: [
                        new Discord.MessageEmbed()
                            .setDescription(`${channelName} deleted by <@!${u.id}>`)
                    ]
                })
                if (!channel) return
                await channel.delete().catch(er => { })
                await m.delete()
            }
        })
    },

    async addCloseChannelButtons(bot, m) {
        let ar = new Discord.MessageActionRow({
            components: [{
                type: 'BUTTON',
                label: 'Delete Channel',
                style: 'DANGER',
                customId: 'delete'
            }]
        })
        m = await m.edit({components: [ar]});
        let hndlr = m.createMessageComponentCollector({componentType: 'BUTTON'});
        hndlr.on('collect', async (interaction) => closeChannelButtonsHandler(interaction, bot));
        let button_manager = {hndlr: hndlr, confirm_hndlrs: []};
        watchedButtons[m.embeds[0].footer.text] = button_manager;
    },

    async registerAFKCheck(afkCheckMod) {
        afkCheckModule = afkCheckMod;
    }
}

async function closeChannelButtonsHandler(interaction, bot) {
    if(!interaction.isButton()) return;
    if(interaction.customId === 'delete') {
        let confirm_buttons = new Discord.MessageActionRow({
            components: [{
                type: 'BUTTON',
                label: 'Delete Channel',
                style: 'DANGER',
                customId: 'delete_confirmed'
            }, {
                type: 'BUTTON',
                label: 'Cancel',
                style: 'SECONDARY',
                customId: 'delete_cancel'
            }]
        })
        await interaction.reply({
            content: `Are you sure you want to delete <#${interaction.message.embeds[0].footer.text}>? Only do this if the run is over.`,
            components: [confirm_buttons],
            ephemeral: true
        });
        let confirm_m = await interaction.fetchReply();
        let confirm_hndlr = confirm_m.createMessageComponentCollector({componentType: 'BUTTON', time: 30000});
        confirm_hndlr.on('collect', async (new_interaction) => watchConfirmButtonsHandler(new_interaction, interaction, bot, confirm_hndlr))
        watchedButtons[interaction.message.embeds[0].footer.text].confirm_hndlrs.push(confirm_hndlr);
    }
}

async function watchConfirmButtonsHandler(interaction, prev_interaction, bot, this_hndlr) {
    if(!interaction.isButton()) return;
    let debug = 1;
    if(interaction.customId === 'delete_confirmed') {
        watchedButtons[prev_interaction.message.embeds[0].footer.text].hndlr.stop();
        for (let i of watchedButtons[prev_interaction.message.embeds[0].footer.text].confirm_hndlrs) {
            i.stop();
        }
        await prev_interaction.message.delete().then().catch(console.error);
        await interaction.update({content: `${prev_interaction.message.embeds[0].title} has been deleted. Have a nice day!`, components: []});
        if(afkCheckModule) {
            let active_run = await afkCheckModule.returnRunByID(prev_interaction.message.embeds[0].footer.text);
            if(active_run) {
                await active_run.abortAfk(interaction.member);
            }
        }
        delete(bot.afkChecks[prev_interaction.message.embeds[0].footer.text]);
        fs.writeFile('./afkChecks.json', JSON.stringify(bot.afkChecks, null, 4), err => {
            if (err) ErrorLogger.log(err, bot)
        });
        let channel = prev_interaction.guild.channels.cache.get(prev_interaction.message.embeds[0].footer.text);
        if (!channel) return
        await channel.delete().catch(er => { })
        if(bot.settings[interaction.guild.id].channels.history) {
            interaction.guild.channels.cache.get(bot.settings[interaction.guild.id].channels.history).send({
                embeds: [
                    new Discord.MessageEmbed()
                        .setDescription(`${channel.name} deleted by ${interaction.member}`)
                ]
            });
        }
        delete(watchedButtons[prev_interaction.message.embeds[0].footer.text]);
    } else if(interaction.customId === 'delete_cancel') {
        await interaction.update({content: `ඞ`, components: []});
        for (let i = 0; i < watchedButtons[prev_interaction.message.embeds[0].footer.text].confirm_hndlrs.length; i++) {
            if(watchedButtons[prev_interaction.message.embeds[0].footer.text].confirm_hndlrs[i] === this_hndlr) {
                this_hndlr.stop();
                watchedButtons[prev_interaction.message.embeds[0].footer.text].confirm_hndlrs.splice(i, 1);
                return;
            }
        }
    }
}

const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot
