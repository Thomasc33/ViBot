const Discord = require('discord.js');
const channel = require('../data/loggingInfo.json').info.rateLimits;
const { config } = require('./settings');
const DISCORD_EMBED_MAX = 4000;

/**
 * @typedef {{
 *  hash: string,
 *  url: string,
 *  method: string,
 *  global: boolean,
 *  uri: string,
 *  stack: string,
 *  date: Date
 * }} RateLimitPrintOptions
 */

/**
 * @param {RateLimitPrintOptions} options
 * @returns
 */
function textPrint({ hash, url, method, global, uri, stack, date }) {
    return `${date.toLocaleTimeString()} ${date.toLocaleDateString()} ${method}${global ? ' GLOBAL' : ''} [${hash} => ${url}] ${uri} ${stack}`;
}

/**
 * @param {RateLimitPrintOptions} options
 * @returns
 */
function embedPrint({ hash, url, method, global, uri, stack, date }) {
    return `<t:${Math.floor(date.getTime() / 1000)}:f> \`${method}${global ? ' GLOBAL' : ''}\` [${hash}](${url})\n${uri}\n${stack}`;
}

/**
 * @param {Discord.Client} bot
 * @param {Discord.RateLimitData} limit
 * @returns
 */
function buildURL(bot, limit) {
    const match = /\/channels\/(\d+)\/messages\/(\d+)/.exec(limit.url);
    if (match && bot.channels.cache.get(match[1])) return `https://discord.com/channels/${bot.channels.cache.get(match[1]).guild.id}/${match[1]}/${match[2]}`;
    return `<#${limit.major}>`;
}

/** @type {RateLimitPrintOptions[]} */
const limits = [];

function log(bot) {
    if (!config.rateLimitLogger?.discord) return;
    if (!limits.length) return;

    if (limits.reduce((n, limit) => n + embedPrint(limit).length, 0) > DISCORD_EMBED_MAX) {
        const buffer = Buffer.from(limits.map(limit => textPrint(limit)).join('\n'));
        const file = new Discord.AttachmentBuilder()
            .setFile(buffer)
            .setName('ratelimits.log');
        bot.channels.cache.get(channel).send({ files: [file] });
    } else {
        const embed = new Discord.EmbedBuilder()
            .setTitle('Rate Limits Hit')
            .setColor('DarkBlue');
        embed.setDescription(limits.map(limit => embedPrint(limit)).join('\n\n'));
        bot.channels.cache.get(channel).send({ embeds: [embed] });
    }
    limits.splice(0, limits.length);
}

/**
 * @param {Discord.Client} bot
 * @param {Discord.RateLimitData} limit
 */
function processLimit(bot, limit) {
    const stack = new Error().stack?.split('\n')?.pop()?.trim();

    const data = {
        method: limit.method,
        hash: limit.hash,
        url: limit.url,
        global: limit.global,
        date: new Date(),
        stack,
        uri: buildURL(bot, limit)
    };

    if (config.rateLimitLogger?.console) {
        console.log(textPrint(data));
    }

    if (config.rateLimitLogger?.discord) limits.push(data);
}

/**
 * @param {Discord.Client} bot
 */
function rateLimitLogger(bot) {
    if (!config.rateLimitLogger?.console && !config.rateLimitLogger?.discord) return;

    bot.rest.on('restDebug', data => {
        if (!data.includes('Major parameter')) {
            if (config.rateLimitLogger?.console) console.log(data);
            return;
        }
        const lines = data.split('\n');
        const tokens = {};
        for (const line of lines) {
            const split = line.split(':');
            const prop = split.shift().trim().split(' ')[0].toLowerCase();
            const value = split.join(':').trim();
            tokens[prop] = value;
        }
        tokens.global = tokens.global === 'true';
        processLimit(bot, tokens);
    });

    bot.rest.on('rateLimited', limit => {
        limit.major = limit.majorParameter;
        limit.bucket = limit.route;
        processLimit(bot, limit);
    });

    setInterval(() => log(bot), 60000);
}

module.exports = { rateLimitLogger };
