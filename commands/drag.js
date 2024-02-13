const Discord = require('discord.js');
const ErrorLogger = require('../lib/logError');

class DragHandler {
    /** @type {{ [channel_id: string]: DragHandler }} */
    static handlers = {};

    /** @type {string[]} */
    #unmoved = [];
    /** @type {string[]} */
    #moved = [];

    /** @type {NodeJS.Timeout} */
    #updateTimeout;

    /** @type {NodeJS.Timeout} */
    #autoCancelTimeout;

    /** @type {Discord.Message} */
    #message;

    /** @type {Discord.VoiceChannel} */
    #voice;

    /** @type {Discord.Client} */
    #bot;

    #lastUpdateTime = Date.now() + 600_000;
    /**
     * @param {Discord.Client} bot
     * @param {Discord.VoiceChannel} voice
     * @param {Discord.GuildMember[]} members
     */
    constructor(bot, voice, members) {
        this.#bot = bot;
        this.#voice = voice;
        this.#unmoved = members.map(m => m.id);
    }

    /**
     * @param {Discord.GuildChannel} channel
     */
    async init(channel) {
        this.#autoCancelTimeout = setTimeout(() => this.end(), 600_000);
        this.#autoCancelTimeout.unref();

        this.#message = await channel.send(this.content);

        this.#message.collector = new Discord.InteractionCollector(this.#bot, {
            message: this.#message,
            interactionType: Discord.InteractionType.MessageComponent,
            componentType: Discord.ComponentType.Button
        });

        this.#message.collector.on('collect', async interaction => {
            if (!interaction.isButton()) { return; }
            if (interaction.customId === 'stop') {
                this.end();
                await interaction.deferUpdate();
            }
        });

        this.#bot.on('channelDelete', channel => {
            if (channel.id === this.#voice.id) this.end();
        });

        this.#updateTimeout = setTimeout(() => this.update(), 1000);
        this.#updateTimeout.unref();
    }

    /**
     * @param {Discord.GuildMember[]} members
     */
    async addUsers(...members) {
        for (const member of members) {
            if (this.#unmoved.includes(member.id)) continue;
            if (this.#moved.includes(member.id)) this.#moved.splice(this.#moved.indexOf(member.id), 1);
            this.#unmoved.push(member.id);
        }
        this.#autoCancelTimeout.refresh();
        this.#lastUpdateTime = Date.now() + 600_000;

        await this.#message.edit(this.content);
        this.#updateTimeout?.refresh();
    }

    get content() {
        const embed = new Discord.EmbedBuilder()
            .setTitle(`Drag for ${this.#voice.name}`)
            .setColor('#00D166')
            .setDescription(`<#${this.#voice.id}>`)
            .addFields(
                { name: 'Move Pending', value: this.#unmoved.length ? this.#unmoved.map(id => {
                    const member = this.#voice.guild.members.cache.get(id);
                    const q = member.voice?.channel?.guildId == this.#voice.guildId ? '' : '?';
                    return `<@${id}>${q}`;
                }).join(', ') : 'None!' },
                { name: 'Have Moved', value: this.#moved.length ? this.#moved.map(id => `<@${id}>`).join(', ') : 'None!' }
            )
            .setFooter({ text: '? = Not in a VC • Automatically Ends at' })
            .setTimestamp(this.#lastUpdateTime);

        const data = { embeds: [embed], components: [] };

        if (DragHandler.handlers[this.#voice.id]) {
            const component = new Discord.ActionRowBuilder().addComponents([
                new Discord.ButtonBuilder()
                    .setLabel('Stop')
                    .setStyle(Discord.ButtonStyle.Danger)
                    .setCustomId('stop')
            ]);
            data.components = [component];
        } else {
            embed.setDescription('This drag handler has been stopped.')
                .setFooter({ text: 'Ended at' })
                .setTimestamp();
        }
        return data;
    }

    async update() {
        if (this.#unmoved.length) {
            const previous = [...this.#unmoved];

            for (const id of this.#unmoved) {
                const member = this.#voice.guild.members.cache.get(id);
                if (!member) { // if they left the server, just in case
                    this.#unmoved.splice(this.#unmoved.indexOf(id), 1);
                    continue;
                }
                if (member.voice?.channel?.guildId == this.#voice.guildId) {
                    // eslint-disable-next-line no-await-in-loop
                    await member.voice.setChannel(this.#voice).then(() => {
                        this.#unmoved.splice(this.#unmoved.indexOf(id), 1);
                        this.#moved.push(member.id);
                    }).catch(e => ErrorLogger.log(e, this.#bot, this.#voice.guild));
                }
            }

            if (previous.length != this.#unmoved.length) await this.#message.edit(this.content);

            this.#updateTimeout.refresh();
        }
    }

    async end() {
        clearTimeout(this.#updateTimeout);
        clearTimeout(this.#autoCancelTimeout);

        this.#message.collector.stop();
        delete DragHandler.handlers[this.#voice.id];

        await this.#message.edit(this.content);
    }

    get message() { return this.#message; }
}

module.exports = {
    name: 'drag',
    description: 'Starts a process where it will drag all of the users mentioned to your current voice channel',
    role: 'eventrl',
    requiredArgs: 1,
    args: '[users/ids/mentions]',
    /**
     * @param {Discord.Message} message
     * @param {string[]} args
     * @param {Discord.Client} bot
     * @param {*} db
     */
    async execute(message, args, bot) {
        if (!message.member.voice?.channel) return message.channel.send('You are not in any voice channel');

        const voice = message.member.voice.channel;

        const members = [];
        const unfound = [];
        const invc = [];

        for (const search of args) {
            const member = message.guild.findMember(search);
            if (!member) unfound.push(search);
            else if (member.voice?.channel?.id == voice.id) invc.push(member);
            else members.push(member);
        }

        const embed = new Discord.EmbedBuilder()
            .setTitle(`Drag for ${voice.name}`)
            .setColor('Blurple')
            .setDescription(`Dragging ${members.length} members.`);
        if (DragHandler.handlers[voice.id]) {
            await DragHandler.handlers[voice.id].addUsers(...members);
            embed.setDescription(`${embed.data.description} See [this embed](${DragHandler.handlers[voice.id].message.url}) for details`);
        } else {
            DragHandler.handlers[voice.id] = new DragHandler(bot, voice, members);
            await DragHandler.handlers[voice.id].init(message.channel);
        }

        if (unfound.length) embed.addFields({ name: 'Not Found', value: unfound.map(search => `\`${search}\``).join(', ') });
        if (invc.length) embed.addFields({ name: 'Already in VC', value: invc.map(m => `${m}`).join(', ') });

        message.channel.send({ embeds: [embed] });
    }
};
