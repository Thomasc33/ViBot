const { createClient } = require('redis');
const { getDB } = require('./dbSetup.js');
const Discord = require('discord.js');
const botSettings = require('./settings.json');
const { commands } = require('./lib/commands');
let client;

/* The MockMessage class is a JavaScript class that represents a message in a webhook interaction and
provides methods for deleting and editing the message. */
class MockMessage {
    constructor(webhook, interaction) {
        this.webhook = webhook;
        this.interaction = interaction;
    }

    async delete() {
        return await this.webhook.deleteMessage(this.interaction.message.id);
    }

    async edit(opts) {
        return await this.webhook.editMessage(this.interaction.message, opts);
    }
}

module.exports = {
    /* The `async setup()` function is responsible for setting up the Redis client connection. */
    async setup() {
        client = createClient(botSettings.redis);

        client.on('error', err => console.log('Redis Client Error: ', err));

        await client.connect();
    },
    async createReactionRow(message, commandName, callback, buttons, allowedUser, state) {
        // eslint-disable-next-line camelcase
        let opts = { valid_ids: JSON.stringify(buttons.components.map((c) => c.data.custom_id)), command: commandName, callback, state: JSON.stringify(state) };
        if (message instanceof Discord.InteractionResponse) opts = { token: message.interaction.token, whid: message.interaction.webhook.id, ...opts };
        if (allowedUser) opts.allowedUser = allowedUser.id;
        const key = 'messagebuttons:' + (await message.fetch()).id;
        // eslint-disable-next-line new-cap
        await client.multi().HSET(key, opts).EXPIRE(key, 86400 /* 1 day */).exec();
    },
    async handleReactionRow(bot, interaction) {
        if (!(interaction instanceof Discord.ButtonInteraction)) return false;
        const messageKey = `messagebuttons:${interaction.message.id}`;
        // eslint-disable-next-line new-cap
        const data = await client.HGETALL(messageKey);
        if (!data.command || !data.callback) return false;
        if (data.allowedUser && data.allowedUser != interaction.user.id) return false;
        const command = commands.get(data.command) || commands.find(cmd => cmd.alias && cmd.alias.includes(data.command));
        const callback = command[data.callback];
        const db = getDB(interaction.guild.id);
        const updateStateFunc = async (k, v) => {
            // eslint-disable-next-line new-cap
            await client.EVAL(`
                    local state = cjson.decode(redis.call('HGET', KEYS[1], 'state'))
                    state[ARGV[1]] = ARGV[2]
                    redis.call('HSET', KEYS[1], 'state', cjson.encode(state))
                `, {
                keys: [messageKey],
                arguments: [k, v]
            });
        };
        if (data.token) {
            const resp = new MockMessage(new Discord.InteractionWebhook(bot, data.whid, data.token), interaction);
            await callback(bot, resp, db, interaction.customId, JSON.parse(data.state), updateStateFunc);
        } else {
            const resp = interaction.message;
            resp.interaction = interaction;
            await callback(bot, resp, db, interaction.customId, JSON.parse(data.state), updateStateFunc);
        }
        return true;
    }
};
