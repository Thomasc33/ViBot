const Discord = require('discord.js');
const prefix = require('../settings.json').prefix;
const SlashArgType = require('discord-api-types/v10').ApplicationCommandOptionType;
const { LegacyCommandOptions } = require('../utils.js')
const ErrorLogger = require(`./logError`)
const MAX_WAIT = 120000;

module.exports = {
    MAX_WAIT: MAX_WAIT,
    isHttpURL: function (string) {
        let url;

        try {
            url = new URL(string);
        } catch (_) {
            return false;
        }

        return url.protocol === "http:" || url.protocol === "https:";
    },
    parse: function (expression, valueObj) {
        const templateMatcher = /\${\s?([^{}\s]*)\s?}/g;
        let text = expression.replace(templateMatcher, (substring, value, index) => {
            value = Object.byString(valueObj, value);
            return value;
        });
        return text
    },
    getRoleStrings(botSettings, member) {
        return member.roles.cache.map(role => Object.entries(botSettings.roles).filter(([name, id]) => id == role.id).map(i => i[0])).flat()
    },
    createEmbed
};

/* Promise.wait = Promise.wait || function(time) {
    let waiter, rej;
    return { finished: new Promise((resolve, reject) => { rej = reject; waiter = setTimeout(resolve, time) }), cancel: () => { clearTimeout(waiter); rej(new Error('Wait cancelled.')); } };
} */ // try { await Promise.wait(3000).finished } catch (err) { cancelled }; 
// const timer = Promise.wait(3000);
//... (somewhere that needs to cancel it) 
// timer.cancel();
Promise.wait = Promise.wait || function Wait(time) {
    return new Promise(resolve => setTimeout(() => {
        resolve()
    }, time))
};
/**
 * Get the next message in this channel matching filter
 * 
 * @param {function({message:Discord.Message})} filter Filter what the message should look like.
 * @param {string?} requirementMessage Message to provide when filter fails
 * @param {Discord.Snowflake?} author_id Id of the user to watch for. If not provided, will accept any message that isn't from a bot user.
 */
Discord.BaseChannel.prototype.next = function Next(filter, requirementMessage, author_id) {
    return new Promise((resolve, reject) => {
        const collector = this.createMessageCollector({ filter: (message) => !message.author.bot && (author_id ? message.author.id == author_id : true), time: MAX_WAIT });
        let resolved = false;
        let error;
        collector.on('collect', async (message) => {
            resolved = true;
            if (message.content.toLowerCase() === 'cancel') {
                collector.stop();
                reject('Manually cancelled.');
                return;
            }

            if (error)
                error.then(err => err.delete());

            let result = message;
            if (message.deletable)
                result = await message.delete();
            if (filter && !filter(result)) {
                resolved = false;
                error = message.channel.send(`${result.content} is not a valid input.\r\n${requirementMessage}\r\nType cancel to cancel.`)
                return;
            }
            collector.stop();
            resolve(result);
        })
        collector.on('end', () => {
            const err = 'timed out';
            err.stack = new Error().stack;
            if (!resolved)
                reject(err)
        });
    });
};

Discord.Message.prototype.smartDelete = async function() {
    if (this.deletable) {
        return await this.delete()
    }
}

Discord.BaseInteraction.prototype.smartDelete = async function() {
    if (this.deletable) {
        return await this.delete()
    }
}

Discord.Message.prototype.replySuccess = async function() {
    return await this.react('✅')
}

Discord.BaseInteraction.prototype.replySuccess = async function(msg) {
    return await this.reply({ content: msg, ephemeral: true })
}

Discord.Message.prototype.replyInternalError = async function() {
    return await this.react('🛟')
}

Discord.BaseInteraction.prototype.replyInternalError = async function(msg) {
    return await this.reply({ content: msg, ephemeral: true })
}

Discord.Message.prototype.replyUserError = async function(msg) {
    return await this.reply(msg)
}

Discord.Message.prototype.followUp = async function(msg) {
    return await this.reply(msg)
}

Discord.BaseInteraction.prototype.replyUserError = async function(msg) {
    return await this.reply({ content: msg, ephemeral: true })
}

Discord.CommandInteractionOptionResolver.prototype.getVarargs = function() { return [] }

Object.defineProperty(Discord.BaseInteraction.prototype, 'content', {
    get() {
        return `${prefix}${this.commandName} ${this.getArgs().join(' ')}`
    }
})

Object.defineProperty(Discord.BaseInteraction.prototype, 'mentions', {
    get() {
        return {
            members: this.options.resolved.members || new Discord.Collection(),
            users: this.options.resolved.users || new Discord.Collection(),
        }
    }
})

Object.defineProperty(Discord.BaseInteraction.prototype, 'author', {
    get() {
        return this.user
    }
})

Discord.BaseInteraction.prototype.react = async function(emoji) {
    return await this.reply(emoji)
}

Discord.BaseInteraction.prototype.getArgs = function(emoji) {
    return this.options.data.map((opt) => {
                if (opt.type == SlashArgType.Subcommand) {
                    return [opt.name, ...opt.options.map((opt) => opt.value)]
                }
                return opt.value
            }).flat()
}

/**
 * Update this message with buttons ✅ ❌ and waits for the user to confirm. Returns true if ✅ was interacted and false if ❌ was interacted.
 * @param {Discord.Snowflake?} author_id Id of the user we want to confirm with. If not provided, will accept any user's confirmation.
 */
 Discord.Message.prototype.confirmButton = function ConfirmYesNo(author_id) {
    const buttonAccept = new Discord.ButtonBuilder()
        .setCustomId('Accepted')
        .setLabel('✅ Accept')
        .setStyle(Discord.ButtonStyle.Success);
    const buttonDecline = new Discord.ButtonBuilder()
        .setCustomId('Cancelled')
        .setLabel('❌ Cancel')
        .setStyle(Discord.ButtonStyle.Danger);
    const buttonsOn = new Discord.ActionRowBuilder().addComponents(buttonAccept, buttonDecline);
    return new Promise((resolve, reject) => {
        const buttonCollector = new Discord.InteractionCollector(this.client, { time: MAX_WAIT, message: this, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
        this.edit({ components: [buttonsOn] });
        let resolved = false;
        buttonCollector.on('collect', async interaction => {
            if (author_id && interaction.user.id != author_id) return;
            resolved = true;
            interaction.deferUpdate();
            buttonCollector.stop();
            resolve(interaction.customId === 'Accepted');
        });
        buttonCollector.on('end', async interaction => {
            const err = 'Timed out.';
            err.stackTrace = new Error().stack;
            if (!resolved) reject(err);
        });
    });
};

const originalDiscordMessageReply = Discord.Message.prototype.reply;

// Add fetchReply as an abstraction, more ability to reuse code for message & interaction
Discord.Message.prototype.reply = async function (options) {
    const lastReply = await originalDiscordMessageReply.call(this, options)
    Object.defineProperty(this, 'lastReply', {
        get() { return lastReply },
        configurable: true
    })
    return lastReply
}

Discord.Message.prototype.fetchReply = async function () {
    return this.lastReply
}

Discord.Message.prototype.editReply = async function(options) {
    return await this.lastReply.edit(options)
}

Discord.Message.prototype.confirmReply = async function() {
    return await this.fetchReply().then(reply => reply.confirmButton(this.author.id))
}

Discord.BaseInteraction.prototype.confirmReply = async function() {
    return await this.confirmButton(this.member.id)
}

/**
 * Update this message with buttons ✅ ❌ and waits for the user to confirm. Returns true if ✅ was interacted and false if ❌ was interacted.
 * @param {Discord.Snowflake?} author_id Id of the user we want to confirm with. If not provided, will accept any user's confirmation.
 */
Discord.BaseInteraction.prototype.confirmButton = async function ConfirmYesNo(author_id) {
    const buttonAccept = new Discord.ButtonBuilder()
        .setCustomId('Accepted')
        .setLabel('✅ Accept')
        .setStyle(Discord.ButtonStyle.Success);
    const buttonDecline = new Discord.ButtonBuilder()
        .setCustomId('Cancelled')
        .setLabel('❌ Cancel')
        .setStyle(Discord.ButtonStyle.Danger);
    const buttonsOn = new Discord.ActionRowBuilder().addComponents(buttonAccept, buttonDecline);
    return new Promise(async (resolve, reject) => {
        const interactionFetchReply = this.fetchReply()
        const buttonCollector = new Discord.InteractionCollector(this.client, { time: MAX_WAIT, message: interactionFetchReply, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
        this.editReply({ components: [buttonsOn] });
        let resolved = false;
        buttonCollector.on('collect', async interaction => {
            if (!(author_id ? interaction.user.id == author_id : true)) return interaction.deferUpdate();
            resolved = true;
            buttonCollector.stop();
            resolve(interaction.customId === 'Accepted');
            interaction.deferUpdate()
        });
        buttonCollector.on('end', async interaction => {
            const err = 'Timed out.';
            err.stackTrace = new Error().stack;
            if (!resolved) reject(err);
        });
    });
};

/**
 * Update this message with buttons from 1️⃣ to 🔟 and waits for the user to confirm. Returns true if a number was interacted and false if ❌ was interacted.
 * @param {number} buttonsNeeded The number of buttons needed on the message.
 * @param {Discord.Snowflake?} author_id Id of the user we want to confirm with. If not provided, will accept any user's confirmation.
 */

Discord.Message.prototype.confirmNumber = function ConfirmYesNo(buttonsNeeded, author_id) {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'];
    // Determine number of buttons and action rows to add based on buttonsNeeded
    let buttons = [];
    const actionRows = new Array;
    for (let i = 1; i <= buttonsNeeded; i++) {
        const buttonToAdd = new Discord.ButtonBuilder()
            .setCustomId(`${numbers[i - 1]}`)
            .setLabel(numberEmojis[i - 1])
            .setStyle(Discord.ButtonStyle.Secondary);
        buttons.push(buttonToAdd);
        if ([5, 10, 15, 20, 25, 30].includes(i)) {
            actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
            buttons = [];
        }
    }
    const declineButton = new Discord.ButtonBuilder()
        .setCustomId('Cancelled')
        .setLabel('❌ Cancel')
        .setStyle(Discord.ButtonStyle.Danger);
    if (buttons.length == 5) {
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
        actionRows.push(new Discord.ActionRowBuilder().addComponents(declineButton));
    } else {
        buttons.push(declineButton);
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
    }
    return new Promise((resolve, reject) => {
        const buttonCollector = new Discord.InteractionCollector(this.client, { time: MAX_WAIT, message: this, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
        this.edit({ components: actionRows });
        let resolved = false;
        buttonCollector.on('collect', async interaction => {
            if (!(author_id ? interaction.user.id == author_id : true)) return;
            resolved = true;
            buttonCollector.stop();
            resolve(interaction.customId);
        });
        buttonCollector.on('end', () => {
            const err = 'Timed out.';
            err.stackTrace = new Error().stack;
            if (!resolved) reject(err);
        });
    });
};

/**
 * Update this message with buttons from 1️⃣ to 🔟 and waits for the user to confirm. Returns true if a number was interacted and false if ❌ was interacted.
 * @param {number} buttonsNeeded The number of buttons needed on the message.
 * @param {Discord.Snowflake?} author_id Id of the user we want to confirm with. If not provided, will accept any user's confirmation.
 */

Discord.BaseInteraction.prototype.confirmNumber = function ConfirmYesNo(buttonsNeeded, author_id) {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
    const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'];
    // Determine number of buttons and action rows to add based on buttonsNeeded
    let buttons = [];
    const actionRows = new Array;
    for (let i = 1; i <= buttonsNeeded; i++) {
        const buttonToAdd = new Discord.ButtonBuilder()
            .setCustomId(`${numbers[i - 1]}`)
            .setLabel(numberEmojis[i - 1])
            .setStyle(Discord.ButtonStyle.Secondary);
        buttons.push(buttonToAdd);
        if ([5, 10, 15, 20, 25, 30].includes(i)) {
            actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
            buttons = [];
        }
    }
    const declineButton = new Discord.ButtonBuilder()
        .setCustomId('Cancelled')
        .setLabel('❌ Cancel')
        .setStyle(Discord.ButtonStyle.Danger);
    if (buttons.length == 5) {
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
        actionRows.push(new Discord.ActionRowBuilder().addComponents(declineButton));
    } else {
        buttons.push(declineButton);
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
    }
    return new Promise((resolve, reject) => {
        const buttonCollector = new Discord.InteractionCollector(this.client, { time: MAX_WAIT, message: this, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
        this.editReply({ components: actionRows });
        let resolved = false;
        buttonCollector.on('collect', async interaction => {
            if (!(author_id ? interaction.user.id == author_id : true)) return;
            resolved = true;
            buttonCollector.stop();
            resolve(interaction.customId);
        });
        buttonCollector.on('end', () => {
            const err = 'Timed out.';
            err.stackTrace = new Error().stack;
            if (!resolved) reject(err);
        });
    });
};

/**
 * Update this message with buttons based on a list and waits for the user to confirm. Returns true if a button from the list was interacted and false if ❌ was interacted.
 * @param {number} buttonsList The list of buttons needed on the message.
 * @param {Discord.Snowflake?} author_id Id of the user we want to confirm with. If not provided, will accept any user's confirmation.
 */
Discord.Message.prototype.confirmList = function ConfirmYesNo(buttonsList, author_id) {
    // Determine number of buttons and action rows to add based on buttonsList
    let buttons = [];
    const actionRows = new Array;
    for (let i = 1; i <= buttonsList.length; i++) {
        const buttonToAdd = new Discord.ButtonBuilder()
            .setCustomId(buttonsList[i - 1])
            .setLabel(buttonsList[i - 1])
            .setStyle(Discord.ButtonStyle.Primary);
        buttons.push(buttonToAdd);
        if (i == 5 || i == 10 || i == 15) {
            actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
            buttons = [];
        }
    }
    const declineButton = new Discord.ButtonBuilder()
        .setCustomId('Cancelled')
        .setLabel('❌ Cancel')
        .setStyle(Discord.ButtonStyle.Danger);
    if (buttons.length == 5) {
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
        actionRows.push(new Discord.ActionRowBuilder().addComponents(declineButton));
    } else {
        buttons.push(declineButton);
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
    }
    return new Promise((resolve, reject) => {
        const buttonCollector = new Discord.InteractionCollector(this.client, { time: MAX_WAIT, message: this, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
        this.edit({ components: actionRows });
        let resolved = false;
        buttonCollector.on('collect', async interaction => {
            if (!(author_id ? interaction.user.id == author_id : true)) return;
            resolved = true;
            buttonCollector.stop();
            resolve(interaction.customId);
        });
        buttonCollector.on('end', () => {
            const err = 'Timed out.';
            err.stackTrace = new Error().stack;
            if (!resolved) reject(err);
        });
    });
};

/**
 * Update this message with buttons based on a list and waits for the user to confirm. Returns true if a button from the list was interacted and false if ❌ was interacted.
 * @param {number} buttonsList The list of buttons needed on the message.
 * @param {Discord.Snowflake?} author_id Id of the user we want to confirm with. If not provided, will accept any user's confirmation.
 */
Discord.Message.prototype.confirmListEmojis = function ConfirmYesNo(buttonsList, author_id) {
    // Determine number of buttons and action rows to add based on buttonsList
    let buttons = [];
    const actionRows = new Array;
    for (let i = 1; i <= buttonsList.length; i++) {
        const buttonToAdd = new Discord.ButtonBuilder()
            .setCustomId(buttonsList[i - 1])
            .setEmoji(buttonsList[i - 1])
            .setStyle(Discord.ButtonStyle.Secondary);
        buttons.push(buttonToAdd);
        if (i == 5 || i == 10 || i == 15) {
            actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
            buttons = [];
        }
    }
    const declineButton = new Discord.ButtonBuilder()
        .setCustomId('Cancelled')
        .setLabel('❌ Cancel')
        .setStyle(Discord.ButtonStyle.Danger);
    if (buttons.length == 5) {
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
        actionRows.push(new Discord.ActionRowBuilder().addComponents(declineButton));
    } else {
        buttons.push(declineButton);
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
    }
    return new Promise((resolve, reject) => {
        const buttonCollector = new Discord.InteractionCollector(this.client, { time: MAX_WAIT, message: this, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
        this.edit({ components: actionRows });
        let resolved = false;
        buttonCollector.on('collect', async interaction => {
            if (!(author_id ? interaction.user.id == author_id : true)) return;
            resolved = true;
            buttonCollector.stop();
            resolve(interaction.customId);
            interaction.deferUpdate()
        });
        buttonCollector.on('end', () => {
            if (!resolved) {
                // If we timeout, return Cancelled so it behaves as if the user had selected Cancelled
                resolve('Cancelled')
            }
        });
    });
};

Discord.ButtonInteraction.prototype.confirmListEmojisWithText = async function ConfirmYesNo(buttonsListEmojis, buttonsListEmojisNames, buttonsListEmojisIDs, author_id) {
    // Determine number of buttons and action rows to add based on buttonsList
    let buttons = [];
    const actionRows = new Array;
    for (let i = 1; i <= buttonsListEmojis.length; i++) {
        const buttonToAdd = new Discord.ButtonBuilder()
            .setCustomId(buttonsListEmojisIDs[i - 1])
            .setEmoji(buttonsListEmojis[i - 1])
            .setLabel(buttonsListEmojisNames[i - 1])
            .setStyle(Discord.ButtonStyle.Secondary);
        buttons.push(buttonToAdd);
        if (i == 5 || i == 10 || i == 15) {
            actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
            buttons = [];
        }
    }
    const declineButton = new Discord.ButtonBuilder()
        .setCustomId('Cancelled')
        .setLabel('❌ Cancel')
        .setStyle(Discord.ButtonStyle.Danger);
    if (buttons.length == 5) {
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
        actionRows.push(new Discord.ActionRowBuilder().addComponents(declineButton));
    } else {
        buttons.push(declineButton);
        actionRows.push(new Discord.ActionRowBuilder().addComponents(buttons));
    }
    return new Promise(async (resolve, reject) => {
        const interactionFetchReply = this.fetchReply()
        const buttonCollector = new Discord.InteractionCollector(this.client, { time: MAX_WAIT, message: interactionFetchReply, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button });
        await this.editReply({ components: actionRows });
        let resolved = false;
        buttonCollector.on('collect', async interaction => {
            if (!(author_id ? interaction.user.id == author_id : true)) return;
            resolved = true;
            buttonCollector.stop();
            resolve(interaction.customId);
        });
        buttonCollector.on('end', () => {
            const err = 'Timed out.';
            err.stackTrace = new Error().stack;
            if (!resolved) reject(err);
        });
    });
};

function createEmbed(messageOrInteraction, text, image) {
    const embed = new Discord.EmbedBuilder()
    embed.setDescription(text)
    if (image) embed.setImage(image)
    embed.setTimestamp(Date.now())
    embed.setFooter({ text: messageOrInteraction.guild.name, iconURL: messageOrInteraction.guild.iconURL() })
    return embed
}

const DiscordMessageType = {
    'MESSAGE_REPLY': 0,
    'INTERACTION_REPLY': 1,
    'INTERACTION_FOLLOWUP' : 2
}

async function createConfirmPanel(messageOrInteraction, text, image, confirmButton = Discord.ButtonBuilder, cancelButton = Discord.ButtonBuilder(), messageType, time = MAX_WAIT, deletePanel = false) {
    const confirmPanelEmbed = createEmbed(messageOrInteraction, `${text}\nThis window will close in ${time/1000} seconds and cancel.`, image)
    confirmButton.setCustomId('Confirmed')
    cancelButton.setCustomId('Cancelled')
    cancelButton.setLabel('❌ Cancel')
    cancelButton.setStyle(Discord.ButtonStyle.Danger)
    const confirmPanelActionRow = new Discord.ActionRowBuilder().addComponents([confirmButton, cancelButton])
    
    async function deleteConfirmPanel(panel) {
        switch (messageType) {
            case DiscordMessageType.MESSAGE_REPLY:
                await panel.delete()
                break
            case DiscordMessageType.INTERACTION_REPLY:
            case DiscordMessageType.INTERACTION_FOLLOWUP:
                break
        }
    }

    return new Promise(async (resolve) => {
        let confirmPanelMessage = null
        switch (messageType) {
            case DiscordMessageType.MESSAGE_REPLY:
            case DiscordMessageType.INTERACTION_REPLY:
                confirmPanelMessage = await messageOrInteraction.reply({ content: null, embeds: [confirmPanelEmbed], components: [confirmPanelActionRow], fetchReply: true, ephemeral: true})
                break
            case DiscordMessageType.INTERACTION_FOLLOWUP:
                confirmPanelMessage = await messageOrInteraction.followUp({ content: null, embeds: [confirmPanelEmbed], components: [confirmPanelActionRow], fetchReply: true, ephemeral: true})
                break
        }
        const confirmPanelCollector = new Discord.InteractionCollector(confirmPanelMessage.client, { time: time, message: confirmPanelMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        let resolved = false
        confirmPanelCollector.on('collect', async interaction => {
            resolved = true
            confirmPanelCollector.stop()
            if (deletePanel) await deleteConfirmPanel(confirmPanelMessage)
            resolve({ value: interaction.customId === confirmButton.data.custom_id, interaction: interaction })
        })
        confirmPanelCollector.on('end', async () => {
            if (!resolved) {
                if (deletePanel) await deleteConfirmPanel(confirmPanelMessage)
                resolve({ value: null, interaction: null })
            }
        })
    })
}

async function createSelectPanel(messageOrInteraction, text, image, stringSelectMenu, messageType, time = MAX_WAIT, custom = false, deletePanel = false) {
    const selectPanelEmbed = createEmbed(messageOrInteraction, `${text}\nThis window will close in ${time/1000} seconds and cancel.`, image)
    stringSelectMenu.setMinValues(1)
    stringSelectMenu.setMaxValues(1)
    stringSelectMenu.setCustomId('Confirmed')
    if (custom) stringSelectMenu.addOptions({ label: 'Custom', value: 'custom' })
    const selectPanelActionRow = new Discord.ActionRowBuilder().addComponents([stringSelectMenu])

    async function deleteSelectPanel(panel) {
        switch (messageType) {
            case DiscordMessageType.MESSAGE_REPLY:
                await panel.delete()
                break
            case DiscordMessageType.INTERACTION_REPLY:
            case DiscordMessageType.INTERACTION_FOLLOWUP:
                break
        }
    }

    return new Promise(async (resolve) => {
        let selectPanelMessage = null
        switch (messageType) {
            case DiscordMessageType.MESSAGE_REPLY:
            case DiscordMessageType.INTERACTION_REPLY:
                selectPanelMessage = await messageOrInteraction.reply({ content: null, embeds: [selectPanelEmbed], components: [selectPanelActionRow], fetchReply: true, ephemeral: true})
                break
            case DiscordMessageType.INTERACTION_FOLLOWUP:
                selectPanelMessage = await messageOrInteraction.followUp({ content: null, embeds: [selectPanelEmbed], components: [selectPanelActionRow], fetchReply: true, ephemeral: true})
                break
        }
        const selectPanelCollector = new Discord.InteractionCollector(selectPanelMessage.client, { time: time, message: selectPanelMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.StringSelect })
        const selectPanelModalCollector = new Discord.InteractionCollector(selectPanelMessage.client, { time: time, message: selectPanelMessage, interactionType: Discord.InteractionType.ModalSubmit })
        let resolved = false
        selectPanelCollector.on('collect', async interaction => {
            if (interaction.values[0] === 'custom') {
                const selectPanelModal = new Discord.ModalBuilder()
                    .setCustomId(`modal`)
                    .setTitle(`Custom Value`)
                const selectPanelModalActionRow = new Discord.ActionRowBuilder().addComponents(
                    new Discord.TextInputBuilder()
                        .setCustomId(`modalField`)
                        .setLabel(`What custom value would you like to set?`)
                        .setStyle(Discord.TextInputStyle.Short)
                        .setRequired(true)
                )
                selectPanelModal.addComponents(selectPanelModalActionRow)
                await interaction.showModal(selectPanelModal)
            } else {
                resolved = true
                selectPanelCollector.stop()
                selectPanelModalCollector.stop()
                if (deletePanel) await deleteSelectPanel(selectPanelMessage)
                resolve({ value: interaction.values[0], interaction: interaction })
            }
        })
        selectPanelCollector.on('end', async () => {
            if (!resolved) {
                if (deletePanel) await deleteSelectPanel(selectPanelMessage)
                resolve({ value: null, interaction: null })
            }
        })
        selectPanelModalCollector.on('collect', async interaction => {
            resolved = true
            selectPanelCollector.stop()
            selectPanelModalCollector.stop()
            if (deletePanel) await deleteSelectPanel(selectPanelMessage)
            let modal = interaction.fields.getTextInputValue(`modalField`)
            resolve({ value: modal, interaction: interaction })
        })
    })
}

async function createConfirmMenuPanel(messageOrInteraction, text, image, confirmButton = Discord.ButtonBuilder, cancelButton = Discord.ButtonBuilder(), messageType, time = MAX_WAIT, deletePanel = false) {
    const confirmMenuPanelEmbed = createEmbed(messageOrInteraction, `${text}\nThis window will close in ${time/1000} seconds and cancel.`, image)
    confirmButton.setCustomId('Confirmed')
    cancelButton.setCustomId('Cancelled')
    cancelButton.setLabel('❌ Cancel')
    cancelButton.setStyle(Discord.ButtonStyle.Danger)
    const confirmMenuPanelActionRow = new Discord.ActionRowBuilder().addComponents([confirmButton, cancelButton])

    async function deleteConfirmMenuPanel(panel) {
        switch (messageType) {
            case DiscordMessageType.MESSAGE_REPLY:
                await panel.delete()
                break
            case DiscordMessageType.INTERACTION_REPLY:
            case DiscordMessageType.INTERACTION_FOLLOWUP:
                break
        }
    }

    return new Promise(async (resolve) => {
        let confirmMenuPanelMessage = null
        switch (messageType) {
            case DiscordMessageType.MESSAGE_REPLY:
            case DiscordMessageType.INTERACTION_REPLY:
                confirmMenuPanelMessage = await messageOrInteraction.reply({ content: null, embeds: [confirmMenuPanelEmbed], components: [confirmMenuPanelActionRow], fetchReply: true, ephemeral: true})
                break
            case DiscordMessageType.INTERACTION_FOLLOWUP:
                confirmMenuPanelMessage = await messageOrInteraction.followUp({ content: null, embeds: [confirmMenuPanelEmbed], components: [confirmMenuPanelActionRow], fetchReply: true, ephemeral: true})
                break
        }
        const confirmMenuPanelCollector = new Discord.InteractionCollector(confirmMenuPanelMessage.client, { time: time, message: confirmMenuPanelMessage, interactionType: Discord.InteractionType.MessageComponent, componentType: Discord.ComponentType.Button })
        const confirmMenuPanelModalCollector = new Discord.InteractionCollector(confirmMenuPanelMessage.client, { time: time, message: confirmMenuPanelMessage, interactionType: Discord.InteractionType.ModalSubmit })
        let resolved = false
        confirmMenuPanelCollector.on('collect', async interaction => {
            if (interaction.customId === confirmButton.data.custom_id) {
                const confirmMenuPanelModal = new Discord.ModalBuilder()
                    .setCustomId(`modal`)
                    .setTitle(`Menu Value`)
                const confirmMenuPanelModalActionRow = new Discord.ActionRowBuilder().addComponents(
                    new Discord.TextInputBuilder()
                        .setCustomId(`modalField`)
                        .setLabel(`What value would you like to input?`)
                        .setStyle(Discord.TextInputStyle.Short)
                        .setRequired(true)
                )
                confirmMenuPanelModal.addComponents(confirmMenuPanelModalActionRow)
                await interaction.showModal(confirmMenuPanelModal)
            } else {
                resolved = true
                confirmMenuPanelCollector.stop()
                confirmMenuPanelModalCollector.stop()
                if (deletePanel) await deleteConfirmMenuPanel(confirmMenuPanelMessage)
                resolve({ value: interaction.customId === confirmButton.data.custom_id, interaction: interaction })
            }
        })
        confirmMenuPanelCollector.on('end', async () => {
            if (!resolved) {
                if (deletePanel) await deleteConfirmMenuPanel(confirmMenuPanelMessage)
                resolve({ value: null, interaction: null })
            }
        })
        confirmMenuPanelModalCollector.on('collect', async interaction => {
            resolved = true
            confirmMenuPanelCollector.stop()
            confirmMenuPanelModalCollector.stop()
            if (deletePanel) await deleteConfirmMenuPanel(confirmMenuPanelMessage)
            let modal = interaction.fields.getTextInputValue(`modalField`)
            resolve({ value: modal, interaction: interaction })
        })
    })
}

Discord.Message.prototype.confirmPanel = async function confirmPanel(text, image, confirmButton = Discord.ButtonBuilder, cancelButton = Discord.ButtonBuilder(), time = MAX_WAIT, deletePanel = false) {
    return await createConfirmPanel(this, text, image, confirmButton, cancelButton, DiscordMessageType.MESSAGE_REPLY, time, deletePanel)
}

Discord.Message.prototype.confirmMenuPanel = async function confirmMenuPanel(text, image, confirmButton = Discord.ButtonBuilder, cancelButton = Discord.ButtonBuilder(), time = MAX_WAIT, deletePanel = false) {
    return await createConfirmMenuPanel(this, text, image, confirmButton, cancelButton, DiscordMessageType.MESSAGE_REPLY, time, deletePanel)
}

Discord.Message.prototype.selectPanel = async function selectPanel(text, image, stringSelectMenu, time = MAX_WAIT, custom = false, deletePanel = false) {
    return await createSelectPanel(this, text, image, stringSelectMenu, DiscordMessageType.MESSAGE_REPLY, time, custom, deletePanel)
}

Discord.ButtonInteraction.prototype.confirmPanel = async function confirmPanel(text, image, confirmButton = Discord.ButtonBuilder, cancelButton = Discord.ButtonBuilder(), time = MAX_WAIT, deletePanel = false) {
    if (this.replied || this.deferred) return await createConfirmPanel(this, text, image, confirmButton, cancelButton, DiscordMessageType.INTERACTION_FOLLOWUP, time, deletePanel)
    else return await createConfirmPanel(this, text, image, confirmButton, cancelButton, DiscordMessageType.INTERACTION_REPLY, time, deletePanel)
}

Discord.ButtonInteraction.prototype.confirmMenuPanel = async function confirmMenuPanel(text, image, confirmButton = Discord.ButtonBuilder, cancelButton = Discord.ButtonBuilder(), time = MAX_WAIT, deletePanel = false) {
    if (this.replied || this.deferred) return await createConfirmMenuPanel(this, text, image, confirmButton, cancelButton, DiscordMessageType.INTERACTION_FOLLOWUP, time, deletePanel)
    else return await createConfirmMenuPanel(this, text, image, confirmButton, cancelButton, DiscordMessageType.INTERACTION_REPLY, time, deletePanel)
}

Discord.ButtonInteraction.prototype.selectPanel = async function selectPanel(text, image, stringSelectMenu, time = MAX_WAIT, custom = false, deletePanel = false) {
    if (this.replied || this.deferred) return await createSelectPanel(this, text, image, stringSelectMenu, DiscordMessageType.INTERACTION_FOLLOWUP, time, custom, deletePanel)
    else return await createSelectPanel(this, text, image, stringSelectMenu, DiscordMessageType.INTERACTION_REPLY, time, custom, deletePanel)
}

Discord.Message.prototype.editButton = async function editButton(newButtonDict) {
    let newComponents = this.components.map(oldActionRow => {
        let updatedActionRow = new Discord.ActionRowBuilder()
        updatedActionRow.addComponents(oldActionRow.components.map(buttonComponent => {
            let newButton = Discord.ButtonBuilder.from(buttonComponent)
            let newButtonElements = newButtonDict[buttonComponent.customId]
            if (newButtonElements) {
                if (newButtonElements.disabled != null) newButton.setDisabled(newButtonElements.disabled)
                if (newButtonElements.label != null) newButton.setLabel(newButtonElements.label)
            }
            return newButton
        }));
        return updatedActionRow
      });
    await this.edit({ components: newComponents });
};

function disableButtons(components, newButtonDict) {
    return components.map(oldActionRow => {
        let updatedActionRow = new Discord.ActionRowBuilder()
        updatedActionRow.addComponents(oldActionRow.components.map(buttonComponent => {
            let newButton = Discord.ButtonBuilder.from(buttonComponent)
            newButton.setDisabled(newButtonDict.disabled)
            return newButton
        }));
        return updatedActionRow
    });
}

Discord.BaseInteraction.prototype.editButtons = async function editButtons(newButtonDict) {
    const newComponents = disableButtons(this.message.components, newButtonDict)
    await this.update({ components: newComponents });
};

Discord.Message.prototype.editButtons = async function editButtons(newButtonDict) {
    const newComponents = disableButtons(this.components, newButtonDict)
    await this.edit({ components: newComponents });
};

Discord.BaseChannel.prototype.nextInt = function NextInt(filter, requirementMessage, author_id) {
    return new Promise((resolve, reject) => {
        const collector = this.createMessageCollector({ filter: (message) => !message.author.bot && (author_id ? message.author.id == author_id : true) && (!isNaN(message.content) || message.content.toLowerCase() === 'cancel'), time: MAX_WAIT });
        let resolved = false;
        let error;
        collector.on('collect', async (message) => {
            resolved = true;
            if (message.content.toLowerCase() === 'cancel') {
                collector.stop();
                reject('Manually cancelled.');
                return;
            }

            if (error)
                error.then(err => err.delete());

            const result = !message.deletable ? parseInt(message.content) : parseInt((await message.delete()).content);

            if (filter && !filter(result)) {
                resolved = false;
                error = message.channel.send(`${result} is not a valid input.\r\n${requirementMessage}\r\nType cancel to cancel.`);
                return;
            }

            collector.stop();
            resolve(result);
        });
        collector.on('end', () => {
            const err = 'timed out';
            err.stackTrace = new Error().stack;
            if (!resolved)
                reject(err)
        })
    })
}

Discord.Message.prototype.getReactionBatch = function GetAllReactions(author_id) {
    return new Promise(async (resolve) => {
        const collector = this.createReactionCollector((reaction, user) => user.id == author_id, { time: MAX_WAIT * 3 });
        collector.on('collect', (reaction) => {
            if (!this.client.emojis.cache.get(reaction.emoji.id))
                if (reaction.emoji.name.replace(/[a-z0-9_]/gi, '') != reaction.emoji.name)
                    reaction.remove();
            if (reaction.emoji.name === '❌')
                collector.stop();
        })
        collector.once('end', (collected) => {
            const reacts = this.reactions.cache.map(r => r.emoji).filter(e => e.name !== '❌');
            this.reactions.removeAll();
            resolve(reacts);
        });
        await this.react('❌');
    });
}

Object.byString = function (o, s) {
    s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    s = s.replace(/^\./, ''); // strip a leading dot
    var a = s.split('.');
    for (var i = 0, n = a.length; i < n; ++i) {
        var k = a[i];
        if (o === Object(o) && k in o) {
            o = o[k];
        } else {
            return;
        }
    }
    return o;
}
Discord.GuildMember.prototype.can = function GuildMemberRolePermissionCheck(role, bot) {
    if (typeof role == 'string') {
        role = this.guild.roles.cache.get(this.client.settings[this.guild.id].roles[role]);
    }
    if (!role) { return bot.adminUsers.includes(this.id) }
    return this.roles.highest.comparePositionTo(role) >= 0 || bot.adminUsers.includes(this.id)
}

Discord.GuildMember.prototype.canCommand = function GuildMemberRoleCommandPermissionCheck(command, bot) {
    const settings = this.client.settings[this.guild.id]
    let role = null
    if (settings.commandRolePermissions[command.name]) { role = this.guild.roles.cache.get(settings.roles[settings.commandRolePermissions[command.name]]) }
    if (!role) { role = this.guild.roles.cache.get(this.client.settings[this.guild.id].roles[command.role]) }
    if (!role) { return bot.adminUsers.includes(this.id) }
    return this.roles.highest.comparePositionTo(role) >= 0 || bot.adminUsers.includes(this.id)
}

Discord.GuildMember.prototype.supporterHierarchy = function supporterHierarchy(settings) {
    let roles = settings.roles

    if (this.roles.cache.has(roles.supporterTierSix)) return 6
    else if (this.roles.cache.has(roles.supporterTierFive)) return 5
    else if (this.roles.cache.has(roles.supporterTierFour)) return 4
    else if (this.roles.cache.has(roles.supporterTierThree)) return 3
    else if (this.roles.cache.has(roles.supporterTierTwo)) return 2
    else if (this.roles.cache.has(roles.supporterTierOne)) return 1
    else return 0
}

Discord.Role.prototype.supporterHierarchy = function supporterHierarchy(settings) {
    let roles = settings.roles

    if (this.id == roles.supporterTierSix) return 6
    else if (this.id == roles.supporterTierFive) return 5
    else if (this.id == roles.supporterTierFour) return 4
    else if (this.id == roles.supporterTierThree) return 3
    else if (this.id == roles.supporterTierTwo) return 2
    else if (this.id == roles.supporterTierOne) return 1
    else return 0
}

Discord.GuildMember.prototype.supporterRoleHierarchy = function supporterRoleHierarchy(settings) {
    let roles = settings.roles

    if (this.roles.cache.has(roles.supporterTierSix)) return roles.supporterTierSix
    else if (this.roles.cache.has(roles.supporterTierFive)) return roles.supporterTierFive
    else if (this.roles.cache.has(roles.supporterTierFour)) return roles.supporterTierFour
    else if (this.roles.cache.has(roles.supporterTierThree)) return roles.supporterTierThree
    else if (this.roles.cache.has(roles.supporterTierTwo)) return roles.supporterTierTwo
    else if (this.roles.cache.has(roles.supporterTierOne)) return roles.supporterTierOne
    else return null
}

Discord.Guild.prototype.findMember = function FindGuildMember(search) {
    let member = null;
    if (!member) member = this.members.cache.get(search.replace(/\D+/gi, ''));
    if (!member && /#\d{4}$/.test(search)) member = this.members.cache.find(user => user.user.tag.toLowerCase() == search.toLowerCase());
    if (!member) member = this.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.toLowerCase() == search || nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(search.toLowerCase()));
    return member
}

Discord.Guild.prototype.findRole = function FindRole(search) {
    if (!search) {return null}
    search = search.toLowerCase();
    const guildRoles = this.roles.cache.sort((a, b) => b.position - a.position).map(r => r);
    for (const role of guildRoles) {
        let roleName = role.name.toLowerCase()
        if (role.id == search) return role
        else if (roleName == search) return role
        else if (roleName.replace(/ /g, '') == search.replace(/ /g, '')) return role
        else if (roleName.split(' ').map(([v]) => v).join('') == search) return role
        else if (roleName.substring(0, search.length) == search) return role
    }
    return null
}

Discord.Guild.prototype.findChannel = function FindChannel(search) {
    if (!search) {return null}
    search = search.toLowerCase();
    const channels = this.channels.cache.sort((a, b) => b.position - a.position).map(r => r);
    for (const channel of channels) {
        let channelName = channel.name.toLowerCase()
        if (channel.id == search) return channel
        else if (channelName == search) return channel
        else if (channelName.replace(/ /g, '') == search.replace(/ /g, '')) return channel
        else if (channelName.split(' ').map(([v]) => v).join('') == search) return channel
        else if (channelName.substring(0, search.length) == search) return channel
    }
    return null
}

Discord.Guild.prototype.findUsersWithRoleAsHighest = function FindUsersWithRoleAsHighest(role) {
    role = this.findRole(role)
    if (!role) return null

    const memberList = []
    const guildList = this.roles.cache.get(role.id).members.map(member => member)
    for (const index in guildList) {
        const member = guildList[index]
        if (member.roles.highest.position == role.position) { memberList.push(member) }
    }
    return memberList
}

Discord.Guild.prototype.findUsersWithRoleNotAsHighest = function FindUsersWithRoleNotAsHighest(role) {
    role = this.findRole(role)
    if (!role) return null

    const memberList = []
    const guildList = this.roles.cache.get(role.id).members.map(member => member)
    for (const index in guildList) {
        const member = guildList[index]
        if (member.roles.highest.position != role.position) { memberList.push(member) }
    }
    return memberList
}

Discord.Guild.prototype.findUsersWithRole = function FindUsersWithRole(role) {
    role = this.findRole(role)
    if (!role) return null
    return this.roles.cache.get(role.id).members.map(member => member)
}

String.prototype.deCamelCase = function() {
    return this.charAt(0).toUpperCase() + this.slice(1).replace(/[A-Z]|(?<=3).|o3|p(?=op)/g, (i) => ` ${i.toUpperCase()}`)
}