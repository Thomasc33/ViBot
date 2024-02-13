const logInfoIds = require('../data/loggingInfo.json').info;
const Discord = require('discord.js'); // TODO is this needed for typing?
const botSettings = require('../settings.json');

const loggerEnabled = botSettings.parseLogger?.discord || botSettings.parseLogger?.console; // TODO check if this is the right way to do this, how often is this evaluated?

/**
 * @description Logs text to the specified channel
 * @param {Discord.Client} bot - the bot client
 * @param {string} url - link to the image sent to the OCR
 * @param {string} ocrOutput - the output of the OCR
 */
function logOCR(bot, url, ocrOutput) {
    if (!loggerEnabled || !botSettings.parseLogger.ocr) return;
    if (botSettings.parseLogger.discord && !logInfoIds.ocr) return; // TODO can only check this once somehow?

    const logText = '**OCR Log**\n'
    + `${new Date().toLocaleString()}\n`
    + `**Image URL:** ${url}\n`
    + '**OCR Output:**\n'
    + `${ocrOutput}`;

    if (botSettings.parseLogger.console) console.log(logText);
    if (botSettings.parseLogger.discord) {
        const logChannel = bot.channels.cache.get(logInfoIds.ocr); // TODO fetch? console log error if invalid?
        if (logChannel) logChannel.send(logText);
    }
}

/**
 * @description Logs an embed to the parse logging channel in discord only
 * @param {Discord.Client} bot - the bot client
 * @param {string} url - link to the image sent to the OCR
 * @param {string} ocrOutput - the raw output of the OCR
 * @param {Discord.Embed[]} embeds - the embeds to log
 */
function logParseEmbeds(bot, url, ocrOutput, embeds) {
    if (!loggerEnabled || !botSettings.parseLogger.parse) return;
    if (botSettings.parseLogger.discord || !logInfoIds.parse) return;

    const logText = '**OCR Log**\n'
    + `${new Date().toLocaleString()}\n`
    + `**Image URL:** ${url}\n`
    + '**OCR Output:**\n'
    + `${ocrOutput}`;

    // TODO decide how to do console logging, what to log?
    if (botSettings.parseLogger.discord) {
        const logChannel = bot.channels.cache.get(logInfoIds.parse); // TODO fetch? console log error if invalid?
        if (logChannel) {
            logChannel.send(logText); // TODO send all embeds in one message
            embeds.forEach(embed => logChannel.send({ embed }));
        }
    }
}
