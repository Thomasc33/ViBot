const Discord = require('discord.js');
const MAX_WAIT = 120000;

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
Discord.Channel.prototype.next = function Next(filter, requirementMessage, author_id) {
    return new Promise((resolve, reject) => {
        const collector = this.createMessageCollector((message) => !message.author.bot && (author_id ? message.author.id == author_id : true), { time: MAX_WAIT });
        let resolved = false;
        let error;
        collector.on('collect', async(message) => {
            resolved = true;
            if (message.content.toLowerCase() === 'cancel') {
                collector.stop();
                reject('Manually cancelled.');
                return;
            }

            if (error)
                error.then(err => err.delete());

            const result = await message.delete();
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
        const collector = this.createReactionCollector(filter, { time: MAX_WAIT });
        this.react('✅').then(this.react('❌'));
        let resolved = false;
        collector.once('collect', async(reaction, user) => {
            resolved = true;
            collector.stop();
            await this.reactions.removeAll();
            resolve(reaction.emoji.name === '✅');
        })
        collector.on('end', async() => {
            await this.reactions.removeAll();
            const err = 'timed out';
            err.stackTrace = new Error().stack;
            if (!resolved)
                reject(err)
        });
    })
}

Discord.Channel.prototype.nextInt = function NextInt(filter, requirementMessage, author_id) {
    return new Promise((resolve, reject) => {
        const collector = this.createMessageCollector((message) => !message.author.bot && (author_id ? message.author.id == author_id : true) && (!isNaN(message.content) || message.content.toLowerCase() === 'cancel'), { time: MAX_WAIT });
        let resolved = false;
        let error;
        collector.on('collect', async(message) => {
            resolved = true;
            if (message.content.toLowerCase() === 'cancel') {
                collector.stop();
                reject('Manually cancelled.');
                return;
            }

            if (error)
                error.then(err => err.delete());
            const result = parseInt((await message.delete()).content);

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
    return new Promise(async(resolve) => {
        const collector = this.createReactionCollector((reaction, user) => user.id == author_id, { time: MAX_WAIT * 3 });
        collector.on('collect', (reaction) => {
            if (!this.client.emojis.cache.get(reaction.emoji.id))
                if (reaction.emoji.name.replace(/[a-z0-9_]/gi, '') != reaction.emoji.name)
                    reaction.remove();
            if (reaction.emoji.name === '❌')
                collector.stop();
        })
        collector.once('end', (collected) => {
            const reacts = this.reactions.cache.array().map(r => r.emoji).filter(e => e.name !== '❌');
            this.reactions.removeAll();
            resolve(reacts);
        });
        await this.react('❌');
    });
}