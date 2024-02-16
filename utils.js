const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { argString } = require('./commands/commands.js');

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error%3E#custom_error_types
class LegacyParserError extends Error {
    constructor(...params) {
        // Pass remaining arguments (including vendor specific ones) to parent constructor
        super(...params);

        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, LegacyParserError);
        }

        this.name = 'LegacyParserError';
    }
}

class LegacyCommandOptions {
    args = {};
    subcommand;
    #message;
    #opts;
    #users = [];
    #attachments;
    #settings;
    constructor(opts, message, varargs) {
        this.#opts = opts;
        this.#message = message;
        this.#settings = message.client.settings[message.guild.id];
        this.#attachments = message.attachments.map((v) => v);
        const s = message.content;
        const [, ...args] = s.slice(1).split(/ +/gi);
        const optsToParse = opts.slice();
        while (optsToParse.length != 0) {
            const currentOpt = optsToParse.shift();
            if (currentOpt.required && (currentOpt.type == SlashArgType.Attachment ? this.#attachments.length == 0 : args.length == 0)) throw new LegacyParserError(`Not enough arguments. Expected: ${argString(opts)}`);
            if (args.length == 0) break;
            const currentArg = currentOpt.varargs ? args.splice(0).join(' ') : args.shift();
            if (currentOpt.type == SlashArgType.Subcommand) {
                // Grab all the subcommand options
                const possibleSubcommands = [currentOpt];
                while (optsToParse[0]?.type == SlashArgType.Subcommand) possibleSubcommands.push(optsToParse.shift());
                // Get matching subcommand
                const subcommands = possibleSubcommands.filter((sc) => sc.name.startsWith(currentArg));
                if (subcommands.length != 1) throw new LegacyParserError(`Could not uniquely identify a subcommand. Options are: ${possibleSubcommands.map((c) => c.name).join(', ')}`);
                const subcommand = subcommands.shift();
                this.subcommand = subcommand.name;
                subcommand.options.forEach((opt) => {
                    if (args.length == 0 && opt.required) throw new LegacyParserError(`Not enough arguments for subcommand \`${subcommand.name}\`. Expected: ${argString(opts)}`);
                    if (opt.varargs) {
                        const v = this.#processType(opt.type, args.splice(0).join(' '));
                        if (!v) throw new LegacyParserError(`Error parsing argument \`${opt.name}\``);
                        this.args[opt.name] = v;
                    }
                    if (args.length) {
                        const v = this.#processType(opt.type, args.shift());
                        if (!v) throw new LegacyParserError(`Error parsing argument \`${opt.name}\``);
                        this.args[opt.name] = v;
                    }
                });
            } else {
                const v = this.#processType(currentOpt.type, currentArg);
                if (!v) throw new LegacyParserError(`Error parsing argument \`${currentOpt.name}\``);
                this.args[currentOpt.name] = v;
            }
        }
        if (varargs) {
            this.args.varargs = args;
        } else if (args.length != 0) {
            throw new LegacyParserError(`Too many arguments. Expected: ${argString(opts)}`);
        }
    }

    get data() {
        return Object.entries(this.args).map(([k, v]) => ({ name: k, value: v, type: this.#opts.find((opt) => opt.name == k).type }));
    }

    get resolved() {
        return {
            users: this.#users
        };
    }

    /**
     * @returns {string[]}
     */
    getVarargs() {
        return this.args.varargs || [];
    }

    /**
     * @param {string} k
     * @returns {string}
     */
    getString(k) {
        if (this.#optTypeMatch(SlashArgType.String, k)) return this.args[k];
    }

    /**
     * @param {string} k
     * @returns {import('discord.js').GuildMember}
     */
    getMember(k) {
        if (this.#optTypeMatch(SlashArgType.User, k)) return this.args[k];
    }

    /**
     * @param {string} k
     * @returns {number}
     */
    getInteger(k) {
        if (this.#optTypeMatch(SlashArgType.Integer, k)) return this.args[k];
    }

    /**
     * @param {string} k
     * @returns {import('discord.js').Attachment}
     */
    getAttachment(k) {
        if (this.#optTypeMatch(SlashArgType.Attachment, k)) return this.args[k];
    }

    /**
     * @param {string} k
     * @returns {import('discord.js').Role | import('discord.js').BaseChannel | import('discord.js').GuildMember}
     */
    getMentionable(k) {
        if (this.#optTypeMatch(SlashArgType.Mentionable, k)) return this.args[k];
    }

    /**
     * @returns {string}
     */
    getSubcommand() {
        return this.subcommand;
    }

    #optTypeMatch(expectedType, k) {
        return this.#opts.find((opt) => opt.name == k)?.type == expectedType
           || (this.getSubcommand() && this.#opts.find((opt) => opt.name == this.getSubcommand()).options.find((opt) => opt.name == k)?.type == expectedType);
    }

    #processType(type, value) {
        switch (type) {
            case SlashArgType.User: {
                const member = this.#message.guild.findMember(value);
                if (!member) throw new LegacyParserError(`User \`${value}\` not found`);
                this.#users.push(member);
                return member;
            }
            case SlashArgType.Boolean: {
                value = value.toLowerCase();
                if (['f', 'false', 'no', 'n', '0'].includes(value)) return false;
                if (['t', 'true', '1', 'yes', 'y'].includes(value)) return true;
                throw new LegacyParserError(`\`${value}\` is not a valid value, try either \`true\` or \`false\`.`);
            }
            case SlashArgType.String: return value;
            case SlashArgType.Integer: return parseInt(value);
            case SlashArgType.Attachment: return this.#attachments.shift();
            case SlashArgType.Number: return parseFloat(value);
            case SlashArgType.Role: return Object.keys(this.#settings.roles).includes(value) ? this.#message.guild.roles.cache.get(this.#settings.roles[value]) : this.#message.guild.roles.cache.get(value.replace(/\D/g, ''));
            case SlashArgType.Channel: return Object.keys(this.#settings.channels).includes(value) ? this.#message.guild.channels.cache.get(this.#settings.channels[value]) : this.#message.guild.channels.cache.get(value.replace(/\D/g, ''));
            case SlashArgType.Mentionable: return this.#processType(SlashArgType.Role, value) ?? this.#processType(SlashArgType.Channel, value) ?? this.#message.guild.findMember(value);
            default: throw new Error('Unhandled type');
        }
    }
}
/**
 * @typedef {import('discord.js').Message & { options: LegacyCommandOptions } | import('discord.js').CommandInteraction} BotCommandInteraction
 */
module.exports = {
    slashArg(type, name, opts) {
        const obj = {
            name,
            type,
            ...opts
        };
        if (type != SlashArgType.Subcommand) {
            obj.required = opts.required === undefined ? true : opts.required;
        }
        return obj;
    },
    slashChoices(opts) {
        if (Array.isArray(opts)) return opts.map((v) => ({ name: v, value: v.toLowerCase() }));
        if (typeof(opts) == 'object') return Object.entries(opts).map(([k, v]) => ({ name: k, value: v }));
    },
    slashCommandJSON(obj, guild) {
        const name = obj.slashCommandName || [obj.name, ...(obj.alias || [])].reduce((i, acc) => i.length < acc.length ? i : acc);
        const jsons = [{
            name,
            type: 1,
            description: obj.description,
            // eslint-disable-next-line camelcase
            guild_id: guild.id, /* Not currently necessary bc we use the per-guild command creation endpoint, but just in case */
            options: obj.args
        }];
        if (obj.userCommand) {
            jsons.push({
                name,
                type: 2
            });
        }
        return jsons;
    },
    LegacyCommandOptions,
    LegacyParserError
};
