const Discord = require('discord.js')
const botSettings = require('../../settings.json')
const eventFile = require('../../data/events.json')
const ErrorLogger = require('../../lib/logError')
const Channels = require('../vibotChannels')

var bot
var activeRun = false;
var currentRun

module.exports = {
    name: 'oldeventafk',
    description: 'Starts a new style afk check for event dungeons',
    args: '<dungeon> [Location]',
    requiredArgs: 1,
    role: 'eventrl',
    alias: ['eafk'],
    async execute(message, args, bott) {
        let settings = bott.settings[message.guild.id]
        let isVet
        if (message.channel.id == settings.channels.eventcommands) isVet = false
        else if (message.channel.id == settings.channels.vetcommands) isVet = true
        else return;
        var eventType = args[0]
        if (!eventFile[eventType]) return message.channel.send("Event type unrecognized. Check ;events and try again")
        var event = eventFile[eventType]
        if (!event.enabled) return message.channel.send(`${event.name} is currently disabled.`);
        let location = "";
        for (i = 1; i < args.length; i++) location = location.concat(args[i]) + ' ';
        location = location.trim();
        if (location.length >= 1024) return message.channel.send('Location must be below 1024 characters, try again');
        if (location = '') location = 'None!'
        if (activeRun) return message.channel.send("There is already an active run");
        bot = bott
        let channel = await createChannel(message, bott, isVet).catch(er => { return message.channel.send(er) })
        message.channel.send('Channel Created Successfully. Beginning AFK check in 5 seconds.')
        currentRun = new afk(event, args[0], channel, location, message, settings, isVet)
        setTimeout(begin, 5000)
    },
    async changeLocation(location) {
        if (activeRun) {
            currentRun.changeLocation(location)
        } else {
            return;
        }
    },
    async allowRun() {
        activeRun = false
    }
}

async function begin() {
    currentRun.start();
}

class afk {
    constructor(event, channelNumber, channel, location, message, settings, isVet) {
        this.settings = settings
        this.event = event
        this.channelNumber = channelNumber
        this.channel = channel
        this.message = message
        this.location = location
        this.time = settings.numerical.eventafktime
        if (isVet) {
            this.raider = this.message.guild.roles.cache.get(settings.roles.vetraider)
            this.eventStatus = this.message.guild.channels.cache.get(this.settings.channels.vetstatus)
        } else {
            this.raider = this.message.guild.roles.cache.get(settings.roles.raider)
            this.eventBoi = this.message.guild.roles.cache.get(settings.roles.eventraider)
            this.eventStatus = this.message.guild.channels.cache.get(this.settings.channels.eventstatus)
        }
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        this.staffRole = this.message.guild.roles.cache.get(settings.roles.eventrl)
        activeRun = true;
        this.ping();
        this.keys = []
        this.earlyLocation = []
    }
    async ping() {
        this.pingMessage = await this.eventStatus.send(`@here A ${this.event.name} run will begin in 5 seconds in ${this.channel.name}. **Be prepared to join vc before it fills up**`)
    }
    async start() {
        //Start timer
        this.timer = await setInterval(() => { this.update() }, 5000)
        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);

        //Main panel
        this.embed = new Discord.EmbedBuilder()
            .setColor(this.event.color)
            .setAuthor({ name: `${this.event.name} started by ${this.message.member.nickname} in ${this.channel.name}`, iconURL: `${this.message.author.avatarURL()}` })
            .setDescription(`<${this.event.portalEmote}> Join \`${this.channel.name}\` before it fills up
            React with your gear/class choice as seen below`)
            .setFooter({ text: `Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds` })
            .setTimestamp()
            .addFields([{name: 'Key', value: `<${this.event.keyEmote}>`, inline: true}]);
        if (this.event.rushers) this.embed.addFields([{name: 'Rushers', value: `<${botSettings.emote.Plane}>`, inline: true}])
        if (this.event.stun) this.embed.addFields([{name: 'Stun', value: `<${botSettings.emote.Collo}>`, inline: true}])
        if (this.event.ogmur) this.embed.addFields([{name: '(P)ogmur', value: `<${botSettings.emote.Ogmur}>`, inline: true}])
        if (this.event.fungal) this.embed.addFields([{name: 'Fungal Tome', value: `<${botSettings.emote.UTTomeoftheMushroomTribes}>`, inline: true}])
        if (this.event.mseal) this.embed.addFields([{name: 'Mseal', value: `<${botSettings.emote.MarbleSeal}>`, inline: true}])
        if (this.event.brain) this.embed.addFields([{name: 'Decoy', value: `<${botSettings.emote.Brain}>`, inline: true}])
        if (this.event.stasis) this.embed.addFields([{name: 'Mystic', value: `<${botSettings.emote.Mystic}>`, inline: true}])
        if (this.event.parylize) this.embed.addFields([{name: 'Paralyze', value: `<${botSettings.emote.Paralyze}>`, inline: true}])
        if (this.event.slow) this.embed.addFields([{name: 'Slow', value: `<${botSettings.emote.Slow}>`, inline: true}])
        if (this.event.daze) this.embed.addFields([{name: 'Daze', value: `<${botSettings.emote.Qot}>`, inline: true}])
        if (this.event.curse) this.embed.addFields([{name: 'Curse', value: `<${botSettings.emote.Curse}>`, inline: true}])
        if (this.event.expose) this.embed.addFields([{name: 'Expose', value: `<${botSettings.emote.Expose}>`, inline: true}])
        if (this.event.warrior) this.embed.addFields([{name: 'Warrior', value: `<${botSettings.emote.Warrior}>`, inline: true}])
        if (this.event.paladin) this.embed.addFields([{name: 'Paladin', value: `<${botSettings.emote.Paladin}>`, inline: true}])
        if (this.event.bard) this.embed.addFields([{name: 'Bard', value: `<${botSettings.emote.Bard}>`, inline: true}])
        if (this.event.priest) this.embed.addFields([{name: 'Priest', value: `<${botSettings.emote.Priest}>`, inline: true}])
        if (this.event.trickster) this.embed.addFields([{name: 'Trickster', value: `<${botSettings.emote.trickster}>`, inline: true}])
        if (this.event.knight) this.embed.addFields([{name: 'Knight', value: `<${botSettings.emote.Knight}>`, inline: true}])
        if (this.event.name == 'Shatters') {
            this.embed.addFields([{name: 'Switch 1', value: `<${botSettings.emote.switch1}>`, inline: true}])
            this.embed.addFields([{name: 'Switch 2', value: `<${botSettings.emote.switch2}>`, inline: true}])
            this.embed.addFields([{name: 'Switch S', value: `<${botSettings.emote.switchS}>`, inline: true}])
        }
        this.pingMessage.edit(this.embed)
        this.addReacts();

        //reaction collector
        let openFilter = (r, u) => (r.emoji.id === this.event.keyEmojiId || r.emoji.name === '❌') && !u.bot;
        this.reactionCollector = new Discord.ReactionCollector(this.pingMessage, openFilter);

        //Unlock channel
        await this.channel.permissionOverwrites.edit(this.raider.id, { Connect: true, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot))
        if (this.eventBoi) await this.channel.permissionOverwrites.edit(this.eventBoi.id, { Connect: true, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot))

        //Leader Panel
        this.leaderEmbed = new Discord.EmbedBuilder()
            .setColor(this.event.color)
            .setTitle(`<${this.event.portalEmote}> AFK Check control panel for \`${this.channel.name}\` <${this.event.portalEmote}>`)
            .setFooter({ text: `To abort the afk check, react with ❌ below.` })
            .addFields({ name: `Our current keys`, value: `None yet!` }, { name: `Location of run`, value: `${this.location}` },)
        this.afkControlPanelInfo = await this.message.guild.channels.cache.get(this.settings.channels.runlogs).send(this.leaderEmbed)
        this.afkControlPanelCommands = await this.message.guild.channels.cache.get(this.settings.channels.eventcommands).send(this.leaderEmbed)
        this.afkControlPanelCommands.react('❌')
        this.panelReactionCollector = new Discord.ReactionCollector(this.afkControlPanelCommands, xFilter);

        this.reactionCollector.on("collect", (r, u) => {
            let reactor = this.message.guild.members.cache.get(u.id)
            //key
            if (r.emoji.id == this.event.keyEmojiId) {
                if (this.keys.length > 2 || this.keys.includes(u)) return;
                this.confirmKey(r, u);
            }
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u
                this.endAFK();
            }
        })
        this.panelReactionCollector.on('collect', (r, u) => {
            let reactor = this.message.guild.members.cache.get(u.id)
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.staffRole.position) return;
                this.endedBy = u
                this.abortAFK();
            }
        })
    }
    async confirmKey(r, u) {
        let endAfter = setInterval(function () {
            try {
                dmReactionCollector.stop();
                dm.send('Reaction took too long to receive, or another key already confirmed. Re-react to try again');
                clearInterval(endAfter);
                return;
            } catch (er) {
                clearInterval(endAfter);
                return;
            }
        }, 60000)
        try {
            let dm = await u.createDM().catch();
            let DirectMessage = await dm.send(`You reacted as <${this.event.keyEmote}>. Press :white_check_mark: to confirm. Ignore this message otherwise`).catch();

            let dmReactionCollector = new Discord.ReactionCollector(DirectMessage, dmReactionFilter);

            await DirectMessage.react("✅");
            await dmReactionCollector.on("collect", (r, u) => {
                if (this.keys.length + 1 > 2 || this.keys.includes(u)) {
                    dmReactionCollector.stop();
                    clearInterval(endAfter);
                    return;
                }
                this.keys.push(u);
                dm.send(`The location for this run has been set to \`${this.location}\`, get there and confirm vial with ${this.message.member.nickname}`);
                if (this.leaderEmbed.data.fields[0].value == `None yet!`) {
                    this.leaderEmbed.data.fields[0].value = `<${this.event.keyEmote}>: <@!${u.id}>`;
                } else this.leaderEmbed.data.fields[0].value += `\n<${this.event.keyEmote}>: ${`<@!${u.id}>`}`
                this.afkControlPanelInfo.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.afkControlPanelCommands.edit(this.leaderEmbed).catch(er => ErrorLogger.log(er, bot));
                this.earlyLocation.push(u);
                clearInterval(endAfter);
                dmReactionCollector.stop();
            });
        } catch (er) { console.log(er) }
    }
    async update() {
        this.time = this.time - 5;
        if (this.time == 0) {
            this.endedBy = bot.user;
            this.endAFK();
            return;
        }
        this.minutes = Math.floor(this.time / 60);
        this.seconds = this.time % 60;
        if (this.embed == null || this.pingMessage == null) return;
        this.embed.setFooter({ text: `Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds` });
        this.pingMessage.edit(this.embed).catch(er => ErrorLogger.log(er, bot));

    }
    async moveIn() {
        for (let i in this.earlyLocation) {
            let u = this.earlyLocation[i];
            let member = this.message.guild.members.cache.get(u.id);
            if (member.voice.connection !== null) {
                if (member.voice.channel.name.toLowerCase().contains('lounge') || member.voice.channel.name.toLowerCase().contains('drag')) {
                    member.edit({ channel: this.voiceChannel }).catch(er => { });
                }
            }
        }
    }
    async endAFK() {
        this.reactionCollector.stop();
        this.panelReactionCollector.stop();

        clearInterval(this.moveInTimer);
        clearInterval(this.timer);

        await this.channel.permissionOverwrites.edit(this.raider.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot))
        if (this.eventBoi) await this.channel.permissionOverwrites.edit(this.eventBoi.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot))
        await this.channel.setPosition(this.channel.parent.children.filter(c => c.type == Discord.ChannelType.GuildVoice).size - 1)

        this.embed.setDescription(`This afk check has ended`)
            .setFooter({ text: `The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}` })
        this.embed.data.fields = []
        this.pingMessage.edit('', this.embed).catch(er => ErrorLogger.log(er, bot))

        this.afkControlPanelCommands.reactions.removeAll()

        activeRun = false
    }
    async abortAFK() {
        this.reactionCollector.stop();
        this.panelReactionCollector.stop();

        clearInterval(this.moveInTimer);
        clearInterval(this.timer);

        await this.channel.permissionOverwrites.edit(this.raider.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot))
        if (this.eventBoi) await this.channel.permissionOverwrites.edit(this.eventBoi.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot))
        await this.channel.setPosition(this.channel.parent.children.filter(c => c.type == Discord.ChannelType.GuildVoice).size - 1)

        this.embed.setDescription(`This afk check has been aborted`)
            .setFooter({ text: `The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}` })
        this.embed.data.fields = []
        this.pingMessage.edit('', this.embedMessage).catch(er => ErrorLogger.log(er, bot))

        this.afkControlPanelCommands.reactions.removeAll()

        activeRun = false
    }
    async addReacts() {
        await this.pingMessage.react(this.event.keyEmojiId)
        if (this.event.rushers) await this.pingMessage.react(botSettings.emoteIDs.Plane)
        if (this.event.stun) await this.pingMessage.react(botSettings.emoteIDs.Collo)
        if (this.event.ogmur) await this.pingMessage.react(botSettings.emoteIDs.Ogmur)
        if (this.event.fungal) await this.pingMessage.react(botSettings.emoteIDs.UTTomeoftheMushroomTribes)
        if (this.event.mseal) await this.pingMessage.react(botSettings.emoteIDs.MarbleSeal)
        if (this.event.brain) await this.pingMessage.react(botSettings.emoteIDs.brain)
        if (this.event.stasis) await this.pingMessage.react(botSettings.emoteIDs.mystic)
        if (this.event.parylize) await this.pingMessage.react(botSettings.emoteIDs.Paralyze)
        if (this.event.slow) await this.pingMessage.react(botSettings.emoteIDs.Slow)
        if (this.event.daze) await this.pingMessage.react(botSettings.emoteIDs.Qot)
        if (this.event.curse) await this.pingMessage.react(botSettings.emoteIDs.Curse)
        if (this.event.expose) await this.pingMessage.react(botSettings.emoteIDs.Expose)
        if (this.event.warrior) await this.pingMessage.react(botSettings.emoteIDs.Warrior)
        if (this.event.paladin) await this.pingMessage.react(botSettings.emoteIDs.Paladin)
        if (this.event.bard) await this.pingMessage.react(botSettings.emoteIDs.Bard)
        if (this.event.priest) await this.pingMessage.react(botSettings.emoteIDs.Priest)
        if (this.event.trickster) await this.pingMessage.react(botSettings.emoteIDs.trickster)
        if (this.event.knight) await this.pingMessage.react(botSettings.emoteIDs.Knight)
        if (this.event.name == 'Shatters') {
            await this.pingMessage.react(botSettings.emoteIDs.switch1)
            await this.pingMessage.react(botSettings.emoteIDs.switch2)
            await this.pingMessage.react(botSettings.emoteIDs.switchS)
        }
        await this.pingMessage.react('❌')
    }
    async changeLocation(location) {
        this.location = location
        this.leaderEmbed.data.fields[1].value = location
        this.afkControlPanelCommands.edit(this.leaderEmbed)
        this.afkControlPanelInfo.edit(this.leaderEmbed)
        try {
            for (i = 0; i < this.earlyLocation.length; i++) {
                let u = this.earlyLocation[i];
                let dm = await u.createDM();
                await dm.send(`The location has been changed to \`${this.location}\`. Get there ASAP`);
            }
        } catch (er) {
            console.log(er)
            return;
        }
    }
}

function createChannel(message, bot, isVet) {
    let settings = bot.settings[message.guild.id]
    //channel creation
    return new Promise(async (resolve, reject) => {
        if (isVet) {
            var template = message.guild.channels.cache.get(settings.voice.veteventtemplate)
            var raider = message.guild.roles.cache.get(settings.roles.vetraider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.vetchannels)
            var category = message.guild.channels.cache.filter(c => c.type == Discord.ChannelType.GuildCategory).find(c => c.name.toLowerCase() === 'veteran raiding')
        } else {
            var template = message.guild.channels.cache.get(settings.voice.eventtemplate)
            var raider = message.guild.roles.cache.get(settings.roles.raider)
            var EventBoi = message.guild.roles.cache.get(settings.roles.eventraider)
            var vibotChannels = message.guild.channels.cache.get(settings.channels.eventchannels)
            var category = message.guild.channels.cache.filter(c => c.type == Discord.ChannelType.GuildCategory).find(c => c.name.toLowerCase() === 'events')
        }

        let channel = await template.clone()
        setTimeout(async function () {
            await channel.setParent(category).catch(er => reject('Failed to move channel to event section'))
            await channel.setPosition(0).catch(er => reject('Failed to move to position 0'))
        }, 1000)
        await message.member.voice.setChannel(channel).catch(er => { })
        await channel.setName(`${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s Run`).catch(er => reject('Failed to set name'))

        //allows raiders to view
        await channel.permissionOverwrites.edit(raider.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot)).catch(er => reject('Failed to give perms to raider'))
        if (EventBoi) await channel.permissionOverwrites.edit(EventBoi.id, { Connect: false, ViewChannel: true }).catch(er => ErrorLogger.log(er, bot)).catch(er => reject('Failed to give Event Boi Perms'))

        //Embed to remove
        let embed = new Discord.EmbedBuilder()
            .setTitle(`${message.member.nickname}'s Run`)
            .setDescription('Whenever the run is over. React with the ❌ to delete the channel. View the timestamp for more information')
            .setFooter({ text: channel.id })
            .setTimestamp()
        let m = await vibotChannels.send(`${message.member}`, embed).catch(er => ErrorLogger.log(er))
        m.react('❌').catch(er => { })
        setTimeout(() => { Channels.update(message.guild, bot) }, 10000)
        resolve(channel)
    })

}

const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot;
const dmReactionFilter = (r, u) => r.emoji.name === '✅' && !u.bot;