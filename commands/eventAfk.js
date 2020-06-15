const Discord = require('discord.js')
const botSettings = require('../settings.json')
const eventFile = require('../events.json')
const ErrorLogger = require('../logError')
const Clean = require('./clean')
const Unlock = require('./unlock')
const Lock = require('./lock')
const Channels = require('./vibotChannels')

var bot
var activeRun = false;
var currentRun

module.exports = {
    name: 'eventafk',
    description: 'Starts a new style afk check for event dungeons',
    args: '<dungeon> [Location]',
    role: 'Event Organizer',
    alias: ['eafk'],
    async execute(message, args, bott) {
        if (message.channel.name !== 'eventbot-commands') return;
        var eventType = args[0]
        if (!eventFile[eventType]) return message.channel.send("Event type unrecognized. Check ;events and try again")
        var event = eventFile[eventType]
        if (!event.enabled) return message.channel.send(`${event.name} is currently disabled.`);
        let location = "";
        for (i = 1; i < args.length; i++) {
            location = location.concat(args[i]) + ' ';
        }
        location = location.trim();
        if (location.length >= 1024) return message.channel.send('Location must be below 1024 characters, try again');
        if (activeRun) return message.channel.send("There is already an active run");
        bot = bott
        let channel = await createChannel(message)
        message.channel.send('Channel Created Successfully. Beginning AFK check in 5 seconds.')
        currentRun = new afk(event, args[0], channel, location, message)
        setTimeout(begin, 10000)
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
    constructor(event, channelNumber, channel, location, message) {
        this.event = event
        this.channelNumber = channelNumber
        this.channel = channel
        this.message = message
        this.location = location
        this.time = botSettings.eventAfkTimeLimit
        this.raider = this.message.guild.roles.cache.find(r => r.name === 'Verified Raider')
        this.eventBoi = this.message.guild.roles.cache.find(r => r.name === 'Event boi')
        this.minutes = Math.floor(botSettings.eventAfkTimeLimit / 60);
        this.seconds = botSettings.eventAfkTimeLimit % 60;
        activeRun = true;
        this.ping();
        this.keys = []
        this.earlyLocation = []
    }
    async ping() {
        this.eventStatus = this.message.guild.channels.cache.find(c => c.name === 'event-status-announcements')
        this.pingMessage = await this.eventStatus.send(`@here A ${this.event.name} run will begin in 5 seconds in ${this.channel.name}. **Be prepared to join vc before it fills up**`)
    }
    async start() {
        //Start timer
        this.timer = await setInterval(() => { this.update() }, 5000)
        this.moveInTimer = await setInterval(() => { this.moveIn() }, 10000);

        //Main panel
        this.embed = new Discord.MessageEmbed()
            .setColor(this.event.color)
            .setAuthor(`${this.event.name} started by ${this.message.member.nickname} in ${this.channel.name}`, `${this.message.author.avatarURL()}`)
            .setDescription(`<${this.event.portalEmote}> Join \`${this.channel.name}\` before it fills up
            React with your gear/class choice as seen below`)
            .setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`)
            .setTimestamp()
            .addField('Key', `<${this.event.keyEmote}>`, true);
        if (this.event.rushers) this.embed.addField('Rushers', `<${botSettings.emote.Plane}>`, true)
        if (this.event.stun) this.embed.addField('Stun', `<${botSettings.emote.Collo}>`, true)
        if (this.event.ogmur) this.embed.addField('(P)ogmur', `<${botSettings.emote.Ogmur}>`, true)
        if (this.event.puri) this.embed.addField('Puri', `<${botSettings.emote.TomeofPurification}>`, true)
        if (this.event.mseal) this.embed.addField('Mseal', `<${botSettings.emote.MarbleSeal}>`, true)
        if (this.event.brain) this.embed.addField('Decoy', `<${botSettings.emote.Brain}>`, true)
        if (this.event.stasis) this.embed.addField('Mystic', `<${botSettings.emote.Mystic}>`, true)
        if (this.event.parylize) this.embed.addField('Paralyze', `<${botSettings.emote.Paralyze}>`, true)
        if (this.event.slow) this.embed.addField('Slow', `<${botSettings.emote.Slow}>`, true)
        if (this.event.daze) this.embed.addField('Daze', `<${botSettings.emote.Qot}>`, true)
        if (this.event.curse) this.embed.addField('Curse', `<${botSettings.emote.Curse}>`, true)
        if (this.event.expose) this.embed.addField('Expose', `<${botSettings.emote.Expose}>`, true)
        if (this.event.warrior) this.embed.addField('Warrior', `<${botSettings.emote.Warrior}>`, true)
        if (this.event.paladin) this.embed.addField('Paladin', `<${botSettings.emote.Paladin}>`, true)
        if (this.event.bard) this.embed.addField('Bard', `<${botSettings.emote.Bard}>`, true)
        if (this.event.priest) this.embed.addField('Priest', `<${botSettings.emote.Priest}>`, true)
        if (this.event.trickster) this.embed.addField('Trickster', `<${botSettings.emote.trickster}>`, true)
        if (this.event.knight) this.embed.addField('Knight', `<${botSettings.emote.Knight}>`, true)
        if (this.event.name == 'Shatters') {
            this.embed.addField('Switch 1', `<${botSettings.emote.switch1}>`, true)
            this.embed.addField('Switch 2', `<${botSettings.emote.switch2}>`, true)
            this.embed.addField('Switch S', `<${botSettings.emote.switchS}>`, true)
        }
        this.pingMessage.edit(this.embed)
        this.addReacts();

        //reaction collector
        let openFilter = (r, u) => (r.emoji.id === this.event.keyEmojiId || r.emoji.name === '❌') && !u.bot;
        this.reactionCollector = new Discord.ReactionCollector(this.pingMessage, openFilter);

        //Unlock channel
        await this.channel.updateOverwrite(this.raider.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
        await this.channel.updateOverwrite(this.eventBoi.id, { CONNECT: true, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))

        //Leader Panel
        this.leaderEmbed = new Discord.MessageEmbed()
            .setColor(this.event.color)
            .setTitle(`<${this.event.portalEmote}> AFK Check control panel for \`${this.channel.name}\` <${this.event.portalEmote}>`)
            .setFooter(`To abort the afk check, react with ❌ below.`)
            .addFields(
                { name: `Our current keys`, value: `None yet!` },
                { name: `Location of run`, value: `${this.location}` },
            )
        this.afkControlPanelInfo = await this.message.guild.channels.cache.find(c => c.name === 'dylanbot-info').send(this.leaderEmbed)
        this.afkControlPanelCommands = await this.message.guild.channels.cache.find(c => c.name === 'eventbot-commands').send(this.leaderEmbed)
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
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === "Event Organizer").position) return;
                this.endedBy = u
                this.endAFK();
            }
        })
        this.panelReactionCollector.on('collect', (r, u) => {
            let reactor = this.message.guild.members.cache.get(u.id)
            if (r.emoji.name == '❌') {
                if (reactor.roles.highest.position < this.message.guild.roles.cache.find(r => r.name === "Event Organizer").position) return;
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
                if (this.keys.length + 1 > 2 || this.keys.includes(u)) { dmReactionCollector.stop(); clearInterval(endAfter); return; }
                this.keys.push(u);
                dm.send(`The location for this run has been set to \`${this.location}\`, get there and confirm vial with ${this.message.member.nickname}`);
                if (this.leaderEmbed.fields[0].value == `None yet!`) {
                    this.leaderEmbed.fields[0].value = `<${this.event.keyEmote}>: <@!${u.id}>`;
                } else this.leaderEmbed.fields[0].value += `\n<${this.event.keyEmote}>: ${`<@!${u.id}>`}`
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
        this.embed.setFooter(`Time Remaining: ${this.minutes} minutes and ${this.seconds} seconds`);
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

        await this.channel.updateOverwrite(this.raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
        await this.channel.updateOverwrite(this.eventBoi.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
        await this.channel.setPosition(this.channel.parent.children.filter(c => c.type == 'voice').size - 1)

        this.embed.setDescription(`This afk check has ended`)
            .setFooter(`The afk check has been ended by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        this.embed.fields = []
        this.pingMessage.edit('', this.embed).catch(er => ErrorLogger.log(er, bot))

        activeRun = false
    }
    async abortAFK() {
        this.reactionCollector.stop();
        this.panelReactionCollector.stop();

        clearInterval(this.moveInTimer);
        clearInterval(this.timer);

        await this.channel.updateOverwrite(this.raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
        await this.channel.updateOverwrite(this.eventBoi.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
        await this.channel.setPosition(this.channel.parent.children.filter(c => c.type == 'voice').size - 1)

        this.embed.setDescription(`This afk check has been aborted`)
            .setFooter(`The afk check has been aborted by ${this.message.guild.members.cache.get(this.endedBy.id).nickname}`)
        this.embed.fields = []
        this.pingMessage.edit('', this.embedMessage).catch(er => ErrorLogger.log(er, bot))

        activeRun = false
    }
    async addReacts() {
        await this.pingMessage.react(this.event.keyEmojiId)
        if (this.event.rushers) await this.pingMessage.react(botSettings.emoteIDs.Plane)
        if (this.event.stun) await this.pingMessage.react(botSettings.emoteIDs.Collo)
        if (this.event.ogmur) await this.pingMessage.react(botSettings.emoteIDs.Ogmur)
        if (this.event.puri) await this.pingMessage.react(botSettings.emoteIDs.TomeofPurification)
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
        this.leaderEmbed.fields[1].value = location
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

async function createChannel(message) {
    //channel creation
    var template = message.guild.channels.cache.find(c => c.name === 'Raiding Template');
    var raider = message.guild.roles.cache.find(r => r.name === 'Verified Raider')
    var EventBoi = message.guild.roles.cache.find(r => r.name === 'Event boi')
    var vibotChannels = message.guild.channels.cache.find(c => c.name === botSettings.ActiveEventName)

    let channel = await template.clone()
    setTimeout(async function () {
        await channel.setParent(message.guild.channels.cache.filter(c => c.type == 'category').find(c => c.name.toLowerCase() === 'events'))
        channel.setPosition(0)
    }, 1000)
    await message.member.voice.setChannel(channel).catch(er => { })
    await channel.setName(`${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]}'s Run`)

    //allows raiders to view
    await channel.updateOverwrite(raider.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))
    await channel.updateOverwrite(EventBoi.id, { CONNECT: false, VIEW_CHANNEL: true }).catch(er => ErrorLogger.log(er, bot))

    //Embed to remove
    let embed = new Discord.MessageEmbed()
        .setTitle(`${message.member.nickname}'s Run`)
        .setDescription('Whenever the run is over. React with the ❌ to delete the channel. View the timestamp for more information')
        .setFooter(channel.id)
        .setTimestamp()
    let m = await vibotChannels.send(embed)
    m.react('❌')
    setTimeout(() => { Channels.update(message.guild, bot) }, 10000)
    return channel;
}

const xFilter = (r, u) => r.emoji.name === '❌' && !u.bot;
const dmReactionFilter = (r, u) => r.emoji.name === '✅' && !u.bot;