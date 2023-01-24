const Discord = require('discord.js');
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
    }
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

/**
 * Reacts to this message with ✅ ❌ and waits for the user to confirm. Returns true if ✅ was reacted and false if ❌ was reacted.
 * @param {Discord.Snowflake?} author_id Id of the user we want to confirm with. If not provided, will accept any user's confirmation. 
 */
Discord.Message.prototype.confirm = function ConfirmYesNo(author_id) {
    const filter = (reaction, user) => !user.bot && ['✅', '❌'].includes(reaction.emoji.name) && (author_id ? user.id == author_id : true);
    return new Promise((resolve, reject) => {
        const collector = this.createReactionCollector({ filter, time: MAX_WAIT });
        this.react('✅').then(this.react('❌'));
        let resolved = false;
        collector.once('collect', async (reaction, user) => {
            resolved = true;
            collector.stop();
            this.reactions.removeAll().catch(e => { });
            resolve(reaction.emoji.name === '✅');
        })
        collector.on('end', async () => {
            this.reactions.removeAll().catch(e => { });
            const err = 'timed out';
            err.stackTrace = new Error().stack;
            if (!resolved)
                reject(err)
        });
    })
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
            if (!(author_id ? interaction.user.id == author_id : true)) return;
            resolved = true;
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

Discord.Message.prototype.editButton = async function editButton(custom_id, label = null, disabled = null) {
    let newComponents = this.components.map(oldActionRow => {
        let updatedActionRow = new Discord.ActionRowBuilder()
        updatedActionRow.addComponents(oldActionRow.components.map(buttonComponent => {
          let newButton = Discord.ButtonBuilder.from(buttonComponent)
          if (custom_id == buttonComponent.customId && disabled != null) newButton.setDisabled(disabled)
          if (custom_id == buttonComponent.customId && label != null) newButton.setLabel(label)
          return newButton
        }));
        return updatedActionRow
      });
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
const overrideDevs = ['277636691227836419', '258286481167220738', '178840516882989056', '120540036855889921']
Discord.GuildMember.prototype.can = function GuildMemberRolePermissionCheck(role) {
    if (typeof role == 'string') {
        role = this.guild.roles.cache.get(this.client.settings[this.guild.id].roles[role]);
    }
    return this.roles.highest.comparePositionTo(role) >= 0 || overrideDevs.includes(this.id);
}

Discord.Guild.prototype.findMember = function FindGuildMember(search) {
    let member = null;
    if (!member) member = this.members.cache.get(search.replace(/\D+/gi, ''));
    if (!member && /#\d{4}$/.test(search)) member = this.members.cache.find(user => user.user.tag.toLowerCase() == search.toLowerCase());
    if (!member) member = this.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.toLowerCase() == search || nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(search.toLowerCase()));
    return member
}