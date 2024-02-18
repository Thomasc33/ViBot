/* eslint-disable no-await-in-loop */
const { EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, InteractionCollector, ComponentType } = require('discord.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');

/** @typedef {{ id: string }} HasID */
/**
 * @typedef WarnRow
 * @property {string} id
 * @property {int} warn_id
 * @property {string} modid
 * @property {string} reason
 * @property {string?} time
 * @property {string?} guildid
 * @property {boolean} silent
 */
/**
 * @typedef SuspensionRow
 * @property {string} id
 * @property {string} guildid
 * @property {boolean} suspended
 * @property {string} reason
 * @property {string} modid
 * @property {string} logmessage
 * @property {string?} uTime
 * @property {boolean?} perma
 * @property {string?} ignOnLeave
 * @property {string} botid
 * @property {string?} unixTimestamp
 * @property {string?} length
 * @property {string} roles
 */
/**
 * @typedef MuteRow
 * @property {string} id
 * @property {string} guildid
 * @property {boolean} muted
 * @property {string} reason
 * @property {string} modid
 * @property {string} uTime
 * @property {boolean} perma
 */
/**
 * @param {WarnRow[]} rows
 * @returns {{ [id: string]: HasID[] }}
 */
function flattenOnId(rows) {
    return rows.reduce((obj, row) => {
        if (!obj[row.id]) obj[row.id] = [];
        obj[row.id].push(row);
        return obj;
    }, {});
}

/**
 * @param {boolean} permanent
 * @param {number} ending unix time
 * @param {number?} ended unix time
 * @returns {string}
 */
function timeString(permanent, ending, ended) {
    if (!ended && permanent) return 'Permanently';
    return `<t:${ended || ending}:R> at <t:${ended || ending}:f>`;
}

class PunishmentsUI {
    /** @type {string[]} */
    #members = [];

    /** @type {number} */
    #index = 0;

    /** @type {'Warns' | 'Suspensions' | 'Mutes'} */
    #page = 'Warns';

    /** @type {{ [id: string]: WarnRow[] }} */
    #warns = {};

    /** @type {{ [id: string]: SuspensionRow[] }} */
    #suspensions = {};

    /** @type {{ [id: string]: MuteRow[] }} */
    #mutes = {};

    /** @type {import('discord.js').CommandInteraction | import('discord.js').Message} */
    #interaction;

    /** @type {import('discord.js').Message} */
    #message;

    /** @type {import('discord.js').Guild} */
    #guild;

    /** @type {import('../data/guildSettings.701483950559985705.cache.json')} */
    #settings;

    /** @type {import('discord.js').GuildMember} */
    #moderator;

    /** @type {import('discord.js').Client} */
    #bot;

    /** @type {NodeJS.Timeout} */
    #timer;

    /** @type {InteractionCollector} */
    #collector;

    /**
     * @param {import('discord.js').CommandInteraction | import('discord.js').Message} interaction
     * @param {import('discord.js').Guild} guild
     * @param {import('../data/guildSettings.701483950559985705.cache.json')} settings
     * @param {string[]} memberIds
     */
    constructor(interaction, guild, settings, memberIds) {
        this.#guild = guild;
        this.#moderator = interaction.member;
        this.#settings = settings;
        this.#members = memberIds;
        this.#interaction = interaction;
        this.#bot = guild.client;
    }

    /**
     * @param {import('mysql2').Pool} db
     * @param {boolean} full
     */
    async initialize(db, full) {
        const { punishmentsMutes, punishmentsSuspensions, punishmentsWarnings } = this.#settings.backend;
        const { roles, rolePermissions } = this.#settings;
        const { position } = this.#moderator.roles.highest;
        const { cache } = this.#guild.roles;
        const ids = this.#members;

        if (position >= cache.get(roles[rolePermissions.punishmentsWarnings]).position && punishmentsWarnings) {
            const [warns] = await db.promise().query('SELECT * FROM warns WHERE id in (?) AND guildid = ? ORDER BY time DESC', [ids, this.#guild.id]);
            this.#warns = flattenOnId(warns);
        }
        if (position >= cache.get(roles[rolePermissions.punishmentsSuspensions]).position && punishmentsSuspensions) {
            const [suspensions] = await db.promise().query('SELECT * FROM suspensions WHERE id in (?) AND guildid = ? ORDER BY suspended DESC, perma DESC, uTime DESC', [ids, this.#guild.id]);
            this.#suspensions = flattenOnId(suspensions);
        }
        if (position >= cache.get(roles[rolePermissions.punishmentsMutes]).position && punishmentsMutes) {
            const [mutes] = await db.promise().query('SELECT *  FROM mutes WHERE id in (?) AND guildid = ?', [ids, this.#guild.id]);
            this.#mutes = flattenOnId(mutes);
        }

        if (this.#members.length == 1 && (this.#warns[this.#memberId()]?.length || 0) + (this.#suspensions[this.#memberId()]?.length || 0) + (this.#mutes[this.#memberId()]?.length || 0) <= 8) {
            return await this.#sendAllEmbeds(0);
        }

        if (full) {
            for (let i = 0; i < this.#members.length; i++) await this.#sendAllEmbeds(i);
            return;
        }

        this.#page = this.#availablePages()[0];
        this.#message = await this.#interaction.reply({ ...this.#content(), fetchReply: true });
        this.#timer = setTimeout(() => this.#stop(), 300_000);
        this.#timer.unref();
        this.#collector = new InteractionCollector(this.#bot, {
            message: this.#message,
            filter: i => i.member.id == this.#moderator.id && (i.componentType == ComponentType.Button || i.componentType == ComponentType.StringSelect)
        });
        this.#collector.on('collect', interaction => this.#process(interaction));
    }

    /**
     * @param {number} idx index of member id in this.#members
     */
    async #sendAllEmbeds(idx) {
        this.#index = idx;
        const embeds = [];
        for (const pageName of this.#availablePages()) {
            switch (pageName) {
                case 'Warns': embeds.push(this.#warnsPage()); break;
                case 'Suspensions': embeds.push(this.#suspensionsPage()); break;
                case 'Mutes': embeds.push(this.#mutesPage()); break;
                default:
            }
        }
        if (embeds.length == 0) embeds.push(this.#noPunishmentsPage());
        if (embeds.reduce((a, b) => a + b.length, 0) < 5900) {
            if (this.#interaction.replied) await this.#interaction.followUp({ embeds, allowedMentions: { repliedUser: false } });
            else await this.#interaction.reply({ embeds, allowedMentions: { repliedUser: false } });
        } else {
            for (const embed of embeds) {
                if (this.#interaction.replied) await this.#interaction.followUp({ embeds: [embed], allowedMentions: { repliedUser: false } });
                else await this.#interaction.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
            }
        }
    }

    /**
    * @param {ButtonInteraction | StringSelectMenuInteraction} interaction
    */
    async #process(interaction) {
        this.#timer.refresh();
        switch (interaction.customId) {
            case 'Warns':
            case 'Suspensions':
            case 'Mutes':
                this.#page = interaction.customId;
                break;
            case 'member-select':
                this.#index = interaction.values[0];
                this.#page = this.#availablePages()[0];
                break;
            default:
        }
        await interaction.update(this.#content());
    }

    async #stop() {
        await this.#message.edit({ embeds: [this.#embed()], components: [] });
        this.#collector.stop();
    }

    /**
     * @returns {string} current member id
     */
    #memberId() { return this.#members[this.#index]; }

    /**
     * Retrieves the current member being looked at
     */
    #member() { return this.#guild.members.cache.get(this.#memberId()); }

    /**
     * @returns {StringSelectMenuBuilder}
     */
    #memberSelect() {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('member-select')
            .setMaxValues(1)
            .setMinValues(1)
            .setPlaceholder('Select a member...');

        let index = 0;
        for (const id of this.#members) {
            const member = this.#guild.members.cache.get(id);
            const option = new StringSelectMenuOptionBuilder()
                .setValue(`${index++}`)
                .setLabel(member.displayName);

            if (id == this.#memberId()) option.setDefault(true);
            menu.addOptions(option);
        }
        return menu;
    }

    /**
     * @returns {ActionRowBuilder[]}
     */
    #components() {
        const components = [];
        if (this.#members.length > 1) components.push(new ActionRowBuilder().addComponents(this.#memberSelect()));

        const buttons = this.#availablePages().map(page => {
            const button = new ButtonBuilder()
                .setCustomId(page)
                .setLabel(page)
                .setStyle(ButtonStyle.Primary);
            if (this.#page == page) button.setDisabled(true);
            return button;
        });

        if (buttons.length) components.push(new ActionRowBuilder().addComponents(...buttons));
        return components;
    }

    /**
     * @returns {('Warns' | 'Suspensions' | 'Mutes')[]}
     */
    #availablePages() {
        return [
            this.#warns[this.#memberId()] && 'Warns',
            this.#suspensions[this.#memberId()] && 'Suspensions',
            this.#mutes[this.#memberId()] && 'Mutes'
        ].filter(page => page);
    }

    /**
     * @returns {EmbedBuilder}
     */
    #noPunishmentsPage() {
        const member = this.#member();
        return new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('No Punishments')
            .setDescription(`${member} has no punishments in ${this.#guild.name}.`);
    }

    /**
     * @returns {EmbedBuilder}
     */
    #warnsPage() {
        const member = this.#member();
        const embed = new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setTitle('Warns')
            .setDescription(`Warns for ${member}`);
        const rows = this.#warns[this.#memberId()];
        const fields = [''];
        let i = 1;
        for (; i <= rows.length; i++) {
            const row = rows[i - 1];
            const time = timeString(false, (row.time / 1000).toFixed(0));
            const text = `\`${(i).toString().padStart(3, ' ')}\`${row.silent ? ' *Silently*' : ''} By <@!${row.modid}> ${time}\`\`\`${row.reason}\`\`\`\n`;
            if (embed.length + fields.map(f => f.length).reduce((a, c) => a + c, 0) + text.length >= 5600) break;
            if (fields[fields.length - 1].length + text.length >= 800) fields.push('');
            fields[fields.length - 1] += text;
        }
        embed.addFields(fields.slice(0, 24).map((text) => ({ name: '\u000B', value: text, inline: true })));
        if (i - 1 != rows.length) embed.addFields({ name: 'Too Many Warns', value: `${member} has ${rows.length} warns but only ${embed.data.fields.length} could fit in the UI.` });
        return embed;
    }

    /**
     * @returns {EmbedBuilder}
     */
    #suspensionsPage() {
        const member = this.#member();
        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Suspensions')
            .setDescription(`Suspensions for ${member}`);

        const rows = this.#suspensions[this.#memberId()];
        const fields = [''];
        let i = 1;
        for (; i <= rows.length; i++) {
            const row = rows[i - 1];
            const time = timeString(row.perma, (parseInt(row.uTime) / 1000).toFixed(0));
            const text = `\`${(i).toString().padStart(3, ' ')}\`${row.suspended ? ' **Active**' : ''} By <@!${row.modid}> ${time}\`\`\`${row.reason}\`\`\`\n`;
            if (embed.length + fields.map(f => f.length).reduce((a, c) => a + c, 0) + text.length >= 5600) break;
            if (fields[fields.length - 1].length + text.length >= 800) fields.push('');
            fields[fields.length - 1] += text;
        }
        embed.addFields(fields.slice(0, 24).map((text) => ({ name: '\u000B', value: text, inline: true })));
        if (i - 1 != rows.length) embed.addFields({ name: 'Too Many Suspensions', value: `${member} has ${rows.length} suspensions but only ${embed.data.fields.length} could fit in the UI.` });
        return embed;
    }

    /**
     * @returns {EmbedBuilder}
     */
    #mutesPage() {
        const member = this.#member();
        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Mutes')
            .setDescription(`Mutes for ${member}`);

        const rows = this.#mutes[this.#memberId()];
        const fields = [''];
        let i = 1;
        for (; i <= rows.length; i++) {
            const row = rows[i - 1];
            const time = timeString(row.perma, (row.uTime / 1000).toFixed(0));
            const text = `\`${(i).toString().padStart(3, ' ')}\`${row.muted ? ' **Active**' : ''} By <@!${row.modid}> ${time}\`\`\`${row.reason}\`\`\`\n`;
            if (embed.length + fields.map(f => f.length).reduce((a, c) => a + c, 0) + text.length >= 5600) break;
            if (fields[fields.length - 1].length + text.length >= 800) fields.push('');
            fields[fields.length - 1] += text;
        }
        embed.addFields(fields.slice(0, 24).map((text) => ({ name: '\u000B', value: text, inline: true })));
        if (i - 1 != rows.length) embed.addFields({ name: 'Too Many Mutes', value: `${member} has ${rows.length} mutes but only ${embed.data.fields.length} could fit in the UI.` });
        return embed;
    }

    /**
     * @returns {EmbedBuilder}
     */
    #embed() {
        const member = this.#member();
        const pages = this.#availablePages();
        let page = this.#noPunishmentsPage();
        if (pages.includes('Warns') && this.#page == 'Warns') page = this.#warnsPage();
        else if (pages.includes('Suspensions') && this.#page == 'Suspensions') page = this.#suspensionsPage();
        else if (pages.includes('Mutes') && this.#page == 'Mutes') page = this.#mutesPage();
        page.setAuthor({ name: member.displayName, value: member.displayAvatarURL() })
            .setFooter({ text: `Search by ${this.#moderator.displayName}`, iconURL: this.#moderator.displayAvatarURL() })
            .setTimestamp();
        return page;
    }

    /**
     * @returns {import('discord.js').MessageReplyOptions}
     */
    #content() { return { embeds: [this.#embed()], components: this.#components() }; }
}

module.exports = {
    role: 'security',
    name: 'punishments',
    slashCommandName: 'pu',
    alias: ['backgroundcheck', 'pu', 'ui', 'userinfo'],
    description: 'Displays all mutes, warnings or suspensions any user has',
    varargs: true,
    args: [
        slashArg(SlashArgType.User, 'user', {
            description: 'The discord user you want to view'
        }),
        ...Array(7).fill(0).map((_, idx) => slashArg(SlashArgType.User, `user${idx + 2}`, {
            description: 'Another discord user to view',
            required: false
        })),
        slashArg(SlashArgType.Boolean, 'full', {
            description: 'If given, will display all embeds in full instead of paginated',
            required: false
        })
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    getNotes() {
        return { title: 'Chat Command Args', value: '<User> [Users...] [\'Full\']\n\n**Other Notes**\nThe `full` option if provided sends all embeds instead of using pagination\n\nWill default to `full` if only a single user was provided and they have `8` or fewer total punishments.' };
    },
    /**
     * @param {import('discord.js').ChatInputCommandInteraction} interaction
     * @param {import('discord.js').Client} bot
     * @param {import('mysql2').Pool} db
     */
    async slashCommandExecute(interaction, bot, db) {
        const { options } = interaction;
        const members = [options.getMember('user'), ...Array(7).fill(0).map((_, idx) => options.getMember(`user${idx + 2}`))].filter(m => m).map(m => m.id);
        const pui = new PunishmentsUI(interaction, interaction.guild, bot.settings[interaction.guild.id], members);
        pui.initialize(db, !!options.getBoolean('full', false));
    },
    async execute(interaction, args, bot, db) {
        const full = args[args.length - 1].toLowerCase() == 'full';
        if (full) args.pop();
        const settings = bot.settings[interaction.guild.id];

        const unfound = [];
        const members = [];
        for (const search of args) {
            const member = interaction.guild.findMember(search);
            if (member) members.push(member);
            else unfound.push(search);
        }
        if (members.length > 0) {
            const pui = new PunishmentsUI(interaction, interaction.guild, settings, members.map(m => m.id).slice(0, 21));
            await pui.initialize(db, full);
        }
        if (unfound.length > 0) {
            const embed = new EmbedBuilder()
                .setTitle('Users not found')
                .setColor(Colors.Gold)
                .setDescription(unfound.join(', '));
            await interaction.followUp({ embeds: [embed] });
        }
    }
};
