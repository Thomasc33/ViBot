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

    this.name = "LegacyParserError";
  }
}


class LegacyCommandOptions {
    args = {}
    subcommand
    #message
    #opts
    #users = []
    #attachments

    constructor(opts, message, varargs) {
        this.#opts = opts
        this.#message = message
        this.#attachments = message.attachments.map((v) => v)
        let s = message.content
        const prefix = s.slice(0, 1);
        const [command, ...args] = s.slice(1).split(/ +/gi)
        let optsToParse = opts.slice();
        while (optsToParse.length != 0) {
            let currentOpt = optsToParse.shift();
            if (currentOpt.required && (currentOpt.type == SlashArgType.Attachment ? this.#attachments.length == 0 : args.length == 0)) throw new LegacyParserError("Not enough arguments. Expected: " + argString(opts))
            if (args.length == 0) break;
            let currentArg = args.shift();
            if (currentOpt.type == SlashArgType.Subcommand) {
                // Grab all the subcommand options
                let possibleSubcommands = [currentOpt]
                while (optsToParse[0]?.type == SlashArgType.Subcommand) possibleSubcommands.push(optsToParse.shift())
                // Get matching subcommand
                const subcommands = possibleSubcommands.filter((sc) => sc.name.startsWith(currentArg))
                if (subcommands.length != 1) throw new LegacyParserError("Could not uniquely identify a subcommand. Options are: " + possibleSubcommands.map((c) => c.name).join(', '))
                const subcommand = subcommands.shift();
                //this.args[subcommand.name] = {}
                this.subcommand = subcommand.name
                subcommand.options.forEach((opt) => {
                    if (args.length == 0 && opt.required) throw new LegacyParserError(`Not enough arguments for subcommand \`${subcommand.name}\`. Expected: ${argString(opts)}`)
                    if (args.length != 0) {
                        const v = this.#processType(opt.type, args.shift())
                        if (!v) throw new LegacyParserError(`Error parsing argument \`${opt.name}\``)
                        //this.args[subcommand.name][opt.name] = v
                        this.args[opt.name] = v
                    }
                })
            } else {
                const v = this.#processType(currentOpt.type, currentArg)
                if (!v) throw new LegacyParserError(`Error parsing argument \`${currentOpt.name}\``)
                this.args[currentOpt.name] = v
            }
        }
        if (varargs) {
            this.args['varargs'] = args
        } else if (args.length != 0) {
            throw new LegacyParserError("Too many arguments. Expected: " + argString(opts))
        }
    }

    get data() {
        return Object.entries(this.args).map(([k, v]) => ({name: k, value: v, type: this.#opts.find((opt) => opt.name == k).type}))
    }

    get resolved() {
        return {
            users: this.#users
        }
    }

    getVarargs() {
        return this.args.varargs || []
    }

    getString(k) {
        if (this.#optTypeMatch(SlashArgType.String, k)) return this.args[k]
    }

    getMember(k) {
        if (this.#optTypeMatch(SlashArgType.User, k)) return this.args[k]
    }

    getInteger(k) {
        if (this.#optTypeMatch(SlashArgType.Number, k)) return this.args[k]
    }

    getAttachment(k) {
        if (this.#optTypeMatch(SlashArgType.Attachment, k)) return this.args[k]
    }

    getSubcommand() {
        return this.subcommand
    }

    #optTypeMatch(expected_type, k) {
        return this.#opts.find((opt) => opt.name == k)?.type == expected_type ||
               (this.getSubcommand() && this.#opts.find((opt) => opt.name == this.getSubcommand()).options.find((opt) => opt.name == k)?.type == expected_type)
    }

    #processType(type, value) {
        switch (type) {
            case SlashArgType.User: {
                let member = this.#message.guild.members.cache.get(value)
                if (value.match(/^\d{10,}$/)) member = this.#message.guild.members.fetch(value)
                if (!member) member = this.#message.mentions.members.first()
                if (!member) member = this.#message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(value.toLowerCase()));
                if (member) this.#users.push(member)
                if (!member) throw new LegacyParserError(`User `${value}` not found`)
                return member
            }
            case SlashArgType.String: {
                return value
            }
            case SlashArgType.Number: {
                return parseInt(value)
            }
            case SlashArgType.Attachment: {
                return this.#attachments.shift()
            }
        }
    }
}

module.exports = {
    slashArg(type, name, opts) {
        let obj = {
            name: name,
            type: type,
            ...opts
        }
        if (type != SlashArgType.Subcommand) {
            obj.required = opts.required === undefined ? true : opts.required;
        }
        return obj
    },
    slashChoices(opts) {
        if (Array.isArray(opts)) {
            return opts.map((v) => ({'name': v, 'value': v.toLowerCase()}))
        } else if (typeof(opts) == 'object') {
            return Object.entries(opts).map(([k, v]) => ({'name': k, 'value': v}))
        }
    },
    slashCommandJSON(obj, guild) {
        let name = obj.slashCommandName || [obj.name, ...(obj.alias || [])].reduce((i, acc) => i.length < acc.length ? i : acc)
        let jsons = [{
            name: name,
            type: 1,
            description: obj.description,
            guild_id: guild.id, /* Not currently necessary bc we use the per-guild command creation endpoint, but just in case */
            options: obj.args
        }]
        if (obj.userCommand) {
            jsons.push({
                name: name,
                type: 2
            })
        }
        return jsons
    },
    LegacyCommandOptions,
    LegacyParserError
}
