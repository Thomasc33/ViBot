const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;

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
            return opts.map((v) => ({'name': v, 'value': v}))
        } else if (typeof(opts) == 'object') {
            return Object.entries(opts).map(([k, v]) => ({'name': k, 'value': v}))
        }
    },
    slashCommandJSON(obj, guild) {
        return {
            name: obj.slashCommandName || [obj.name, ...(obj.alias || [])].reduce((i, acc) => i.length < acc.length ? i : acc),
            description: obj.description,
            guild_id: guild.id, /* Not currently necessary bc we use the per-guild command creation endpoint, but just in case */
            options: obj.args
        }
    }
}
