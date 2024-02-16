const { EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder, InteractionCollector, ComponentType } = require('discord.js');
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { slashArg, slashCommandJSON } = require('../utils.js');

function flattenOnId(rows) {
    return rows.reduce((obj, row) => {
        if (!obj[row.id]) obj[row.id] = [];
        obj[row.id].push(row);
        return obj;
    }, {});
}

function timeString(permanent, ending, ended) {
    if (!ended && permanent) return 'Permanently';
    return `<t:${ended || ending}:R> at <t:${ended || ending}:f>`;
}

class PunishmentsUI {
    #members = [];
    #index = 0;
    #page = 'Warns';

    #warns = {};
    #suspensions = {};
    #mutes = {};

    #interaction;
    #message;
    #guild;
    #settings;
    #moderator;
    #bot;

    /** @type {NodeJS.Timeout} */
    #timer;
    #collector;
    constructor(interaction, guild, settings, members) {
        this.#guild = guild;
        this.#moderator = interaction.member;
        this.#settings = settings;
        this.#members = members;
        this.#interaction = interaction;
        this.#bot = guild.client;
    }

    async initialize(db) {
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
            const [mutes] = await db.promise().query('SELECT *  FROM mutes WHERE id in (?) AND guildid = ? ORDER BY removedOn DESC', [ids, this.#guild.id]);
            this.#mutes = flattenOnId(mutes);
        }
        this.#page = this.#availablePages[0];
        this.#message = await this.#interaction.reply(this.#content);
        this.#timer = setTimeout(() => this.#stop(), 300_000);
        this.#timer.unref();
        this.#collector = new InteractionCollector(this.#bot, {
            message: this.#message,
            filter: i => i.member.id == this.#moderator.id && (i.componentType == ComponentType.Button || i.componentType == ComponentType.StringSelect)
        });
        this.#collector.on('collect', interaction => this.#process(interaction));
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
                this.#page = this.#availablePages[0];
                break;
            default:
        }
        await interaction.update(this.#content);
    }

    async #stop() {
        await this.#message.edit({ embeds: [this.#embed], components: [] });
    }

    get #memberId() { return this.#members[this.#index]; }

    get #member() { return this.#guild.members.cache.get(this.#memberId); }

    get #memberSelect() {
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

            if (id == this.#memberId) option.setDefault(true);
            menu.addOptions(option);
        }
        return menu;
    }

    get #components() {
        const components = [];
        if (this.#members.length > 1) components.push(new ActionRowBuilder().addComponents(this.#memberSelect));

        const buttons = this.#availablePages.map(page => {
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

    get #availablePages() {
        return [
            this.#warns[this.#memberId] && 'Warns',
            this.#suspensions[this.#memberId] && 'Suspensions',
            this.#mutes[this.#memberId] && 'Mutes'
        ].filter(page => page);
    }

    get #noPunishmentsPage() {
        const member = this.#member;
        return new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle('No Punishments')
            .setDescription(`${member} has no punishments in ${this.#guild.name}.`);
    }

    get #warnsPage() {
        const member = this.#member;
        const embed = new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setTitle('Warns')
            .setDescription(`Warns for ${member}`);
        const rows = this.#warns[this.#memberId];
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
        embed.addFields(fields.map((text) => ({ name: '\u000B', value: text, inline: true })));
        if (i - 1 != rows.length) embed.addFields({ name: 'Too Many Warns', value: `${member} has ${rows.length} warns but only ${i - 1} could fit in the UI.` });
        return embed;
    }

    get #suspensionsPage() {
        const member = this.#member;
        const embed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('Suspensions')
            .setDescription(`Suspensions for ${member}`);

        const rows = this.#suspensions[this.#memberId];
        const fields = [''];
        let i = 1;
        for (; i <= rows.length; i++) {
            const row = rows[i - 1];
            const time = timeString(row.perma, (row.uTime / 1000).toFixed(0));
            const text = `\`${(i).toString().padStart(3, ' ')}\`${row.suspended ? ' **Active**' : ''} By <@!${row.modid}> ${time}\`\`\`${row.reason}\`\`\`\n`;
            if (embed.length + fields.map(f => f.length).reduce((a, c) => a + c, 0) + text.length >= 5600) break;
            if (fields[fields.length - 1].length + text.length >= 800) fields.push('');
            fields[fields.length - 1] += text;
        }
        embed.addFields(fields.map((text) => ({ name: '\u000B', value: text, inline: true })));
        if (i - 1 != rows.length) embed.addFields({ name: 'Too Many Suspensions', value: `${member} has ${rows.length} suspensions but only ${i - 1} could fit in the UI.` });
        return embed;
    }

    get #mutesPage() {
        const member = this.#member;
        const embed = new EmbedBuilder()
            .setColor(Colors.LightGrey)
            .setTitle('Mutes')
            .setDescription(`Mutes for ${member}`);

        const fields = [''];
        const rows = [...this.#mutes[this.#memberId].filter(row => !row.removedOn), ...this.#mutes[this.#memberId].filter(row => row.removedOn)];
        let i = 1;
        for (;i <= rows.length; i++) {
            const row = rows[i - 1];
            const time = (row.duration ? '' : 'ending ') + timeString(!row.duration, row.appliedOn + row.duration, row.removedOn);
            const text = `\`${(i).toString().padStart(3, ' ')}\`${!row.removedOn ? ' **Active**' : ''} By <@!${row.modid}> ${time} \`\`\`${row.reason}\`\`\`\n`;
            if (embed.length + fields.map(f => f.length).reduce((a, c) => a + c, 0) + text.length >= 5600) break;
            if (fields[fields.length - 1].length + text.length >= 800) fields.push('');
            fields[fields.length - 1] += text;
        }
        embed.addFields(fields.map((text) => ({ name: '\u000B', value: text, inline: true })));
        if (i - 1 != rows.length) embed.addFields({ name: 'Too Many Mutes', value: `${member} has ${rows.length} mutes but only ${i - 1} could fit in the UI.` });
        return embed;
    }

    get #embed() {
        const member = this.#member;
        const pages = this.#availablePages;
        let page = this.#noPunishmentsPage;
        if (pages.includes('Warns') && this.#page == 'Warns') page = this.#warnsPage;
        else if (pages.includes('Suspensions') && this.#page == 'Suspensions') page = this.#suspensionsPage;
        else if (pages.includes('Mutes') && this.#page == 'Mutes') page = this.#mutesPage;
        page.setAuthor({ name: member.displayName, value: member.displayAvatarURL() })
            .setFooter({ text: `Search by ${this.#moderator.displayName}`, iconURL: this.#moderator.displayAvatarURL() })
            .setTimestamp();
        return page;
    }

    get #content() { return { embeds: [this.#embed], components: this.#components }; }
}

module.exports = {
    role: 'security',
    name: 'punishments',
    slashCommandName: 'pu',
    alias: ['backgroundcheck', 'pu', 'ui', 'userinfo'],
    description: 'Displays all mutes, warnings or suspensions any user has',
    varargs: true,
    args: [
        slashArg(SlashArgType.String, 'user', {
            description: 'The discord user ID, @mention, or ign you want to view'
        }),
    ],
    getSlashCommandData(guild) { return slashCommandJSON(this, guild); },
    async execute(interaction, args, bot, db) {
        const settings = bot.settings[interaction.guild.id];

        const unfound = [];
        const members = [];
        for (const search of args) {
            const member = interaction.guild.findMember(search);
            if (member) members.push(member);
            else unfound.push(member);
        }

        if (members.length > 0) {
            const pui = new PunishmentsUI(interaction, interaction.guild, settings, members.map(m => m.id));
            await pui.initialize(db);
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
