const AfkTemplate = require('../../commands/afkTemplate.js');
const Discord = require('discord.js');

module.exports = class AfkButton {
    #displayName;
    #name;
    #type;
    #parent;
    #choice;
    #confirm;
    #confirmationMessage;
    #confirmationMedia;
    #location;
    #start;
    #lifetime;
    #disableStart;
    #points;
    #emote;
    #minRole;
    #minStaffRoles;
    #color;
    #logOptions;
    #isCap;

    constructor(botSettings, storedEmojis, guild, { points, disableStart, emote, minRole, minStaffRoles, confirmationMessage, color, logOptions, displayName, limit, name, type, parent, choice, confirm, location, confirmationMedia, start, lifetime, isCap, members, logged }) {
        // template
        this.#displayName = displayName;
        this.limit = limit;
        this.#name = name;
        this.#type = type;
        this.#parent = parent;
        this.#choice = choice;
        this.#confirm = confirm;
        this.#location = location;
        this.#confirmationMedia = confirmationMedia;
        this.#start = start;
        this.#lifetime = lifetime;

        // processButtons
        this.#points = typeof points == 'string' ? botSettings.points[points] : points ?? 0;
        this.#disableStart = disableStart || start;
        this.#emote = storedEmojis[emote];
        this.#minRole = guild.roles.cache.get(botSettings.roles[minRole]);
        this.#minStaffRoles = minStaffRoles && minStaffRoles.map(role => guild.roles.cache.get(botSettings.roles[role]));
        this.#confirmationMessage = confirmationMessage;
        this.#color = color in AfkTemplate.TemplateButtonColors ? color : Discord.ButtonStyle.Secondary;
        this.#logOptions = logOptions && Object.entries(logOptions).reduce((obj, [key, logOption]) => {
            obj[key] = {
                ...logOption,
                points: typeof logOption.points == 'string' ? botSettings.points[logOption.points] : logOption.points ?? 0,
                multiplier: typeof logOption.multiplier == 'string' ? botSettings.points[logOption.multiplier] : logOption.multiplier ?? 1
            };
            return obj;
        }, {});

        // reactable parameters
        this.members = members || [];
        this.logged = logged || 0;

        // capButtons
        this.#isCap = isCap === undefined ? this.limit === 0 : isCap;
    }

    get name() { return this.#name; }
    get type() { return this.#type; }
    get confirm() { return this.#confirm; }
    get confirmationMedia() { return this.#confirmationMedia; }
    get confirmationMessage() { return this.#confirmationMessage; }
    get location() { return this.#location; }
    get points() { return this.#points; }
    get emote() { return this.#emote; }
    get minRole() { return this.#minRole; }
    get logOptions() { return this.#logOptions; }
    get isCap() { return this.#isCap; }
    get choice() { return this.#choice; }

    label() {
        return `${this.#displayName ? `${this.#name} ` : ''}${this.limit ? ` ${this.members.length}/${this.limit}` : ''}`;
    }

    memberListLabel(isRequest) {
        return `${this.#emote ? this.#emote.text : ''} ${this.#name}${isRequest ? ' Request' : ''}${this.limit ? ` (${this.limit})` : ''}${this.#location ? ' `L`' : ''}`;
    }

    isLogged() {
        return [AfkTemplate.TemplateButtonType.LOG, AfkTemplate.TemplateButtonType.LOG_SINGLE].includes(this.type);
    }

    present(phase) {
        const end = this.#start + this.#lifetime;
        return (phase >= this.#start || phase >= this.#disableStart) && phase < end;
    }

    disabled(phase) {
        return !!((this.#disableStart < this.#start && this.#start > phase)
            || (this.limit && this.members.length >= this.limit));
    }

    reactableButton(phase) {
        const button = new Discord.ButtonBuilder()
            .setStyle(this.#color)
            .setCustomId(this.#name)
            .setLabel(this.label())
            .setDisabled(this.disabled(phase));
        if (this.emote) button.setEmoji(this.emote.id);
        return button;
    }

    memberList() {
        const emote = this.emote ? `${this.emote.text} ` : '';
        if (this.members.length == 0) {
            return 'None!';
        }
        const memberString = this.members.reduce((string, id, ind) => string + `${emote ? emote : ind + 1}: <@!${id}>\n`, '');
        return memberString.length >= 1024 ? '*Too many users to process*' : memberString;
    }

    async choicePrompt(message, user) {
        if (this.#minStaffRoles && !this.#minStaffRoles.some(role => user.roles.cache.has(role.id))) return;
        const choiceText = this.emote ? `${this.emote.text} **${this.name}**` : `**${this.name}**`;
        switch (this.#choice) {
            case AfkTemplate.TemplateButtonChoice.NO_CHOICE: return;
            case AfkTemplate.TemplateButtonChoice.YES_NO_CHOICE: {
                const text = `Do you want to add ${choiceText} reacts to this run?\n If no response is received, this run will use the default ${this.limit} ${choiceText}.`;
                const confirmButton = new Discord.ButtonBuilder()
                    .setLabel('✅ Confirm')
                    .setStyle(Discord.ButtonStyle.Success);
                const cancelButton = new Discord.ButtonBuilder();
                const { value: confirmValue } = await message.confirmPanel(text, null, confirmButton, cancelButton, 30000, true);
                this.limit = (confirmValue === null || confirmValue) ? this.limit : 0;
                break;
            }
            case AfkTemplate.TemplateButtonChoice.NUMBER_CHOICE_PRESET: {
                const text = `How many ${choiceText} reacts do you want to add to this run?\n If no response is received, this run will use the default ${this.limit} ${choiceText}.`;
                const confirmSelectMenu = new Discord.StringSelectMenuBuilder()
                    .setPlaceholder(`Number of ${this.name}s`)
                    .setOptions(
                        { label: '1', value: '1' },
                        { label: '2', value: '2' },
                        { label: '3', value: '3' },
                        { label: 'None', value: '0' }
                    );
                const { value: confirmValue } = await message.selectPanel(text, null, confirmSelectMenu, 30000, false, true);
                this.limit = Number.isInteger(parseInt(confirmValue)) ? parseInt(confirmValue) : this.limit;
                break;
            }
            case AfkTemplate.TemplateButtonChoice.NUMBER_CHOICE_CUSTOM: {
                const text = `How many ${choiceText} reacts do you want to add to this run?\n If no response is received, this run will use the default ${this.limit} ${choiceText}.`;
                const confirmSelectMenu = new Discord.StringSelectMenuBuilder()
                    .setPlaceholder(`Number of ${this.name}s`)
                    .setOptions(
                        { label: '1', value: '1' },
                        { label: '2', value: '2' },
                        { label: '3', value: '3' },
                        { label: 'None', value: '0' }
                    );
                const { value: confirmValue } = await message.selectPanel(text, null, confirmSelectMenu, 30000, true, true);
                this.limit = Number.isInteger(parseInt(confirmValue)) ? parseInt(confirmValue) : this.limit;
                break;
            }
            default:
        }
    }

    confirmationDescription(descriptionMiddle) {
        const emote = this.emote ? `${this.emote.text} ` : '';
        const descriptionBeginning = `You reacted with ${emote}${this.#name}.`;
        const descriptionEnd = 'Press ✅ to confirm your reaction. Otherwise press ❌';
        return `${descriptionBeginning}\n${descriptionMiddle}${descriptionEnd}`;
    }

    toJSON() {
        return {
            name: this.#name,
            limit: this.limit,
            members: this.members,
            logged: this.logged,
            isCap: this.#isCap
        };
    }
};
