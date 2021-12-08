const Discord = require('discord.js');
const MAX_WAIT = 120000;

module.exports = {
    MAX_WAIT: MAX_WAIT,
    isHttpURL: function(string) {
        let url;

        try {
            url = new URL(string);
        } catch (_) {
            return false;
        }

        return url.protocol === "http:" || url.protocol === "https:";
    },
    parse: function(expression, valueObj) {
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
Discord.Channel.prototype.next = function Next(filter, requirementMessage, author_id) {
    return new Promise((resolve, reject) => {
        const collector = this.createMessageCollector({ filter: (message) => !message.author.bot && (author_id ? message.author.id == author_id : true), time: MAX_WAIT });
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
        collector.once('collect', async(reaction, user) => {
            resolved = true;
            collector.stop();
            this.reactions.removeAll().catch(e => {});
            resolve(reaction.emoji.name === '✅');
        })
        collector.on('end', async() => {
            this.reactions.removeAll().catch(e => {});
            const err = 'timed out';
            err.stackTrace = new Error().stack;
            if (!resolved)
                reject(err)
        });
    })
}

Discord.Channel.prototype.nextInt = function NextInt(filter, requirementMessage, author_id) {
    return new Promise((resolve, reject) => {
        const collector = this.createMessageCollector({ filter: (message) => !message.author.bot && (author_id ? message.author.id == author_id : true) && (!isNaN(message.content) || message.content.toLowerCase() === 'cancel'), time: MAX_WAIT });
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
            const reacts = this.reactions.cache.map(r => r.emoji).filter(e => e.name !== '❌');
            this.reactions.removeAll();
            resolve(reacts);
        });
        await this.react('❌');
    });
}

Object.byString = function(o, s) {
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
const overrideDevs = ['277636691227836419', '298989767369031684', '130850662522159104']
Discord.GuildMember.prototype.can = function GuildMemberRolePermissionCheck(role) {
    if (typeof role == 'string') {
        role = this.guild.roles.cache.get(this.client.settings[this.guild.id].roles[role]);
    }
    return this.roles.highest.comparePositionTo(role) >= 0 || overrideDevs.includes(this.id);
}

Discord.Guild.prototype.findMember = function FindGuildMember(search) {
    let member = this.members.cache.get(search);
    if (!member) member = this.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(search.toLowerCase()));
    return member;
}