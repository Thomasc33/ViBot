const logInfoIds = require('../data/loggingInfo.json').info;
const Discord = require('discord.js');
const botSettings = require('../settings.json');

const loggerEnabled = botSettings.parseLogger?.discord || botSettings.parseLogger?.console;

/**
 * @description Logs text to the specified channel
 * @param {string} text text to log
 * @param {LogDestinations} logDestination channel to log to
 */
function logOCR(text) {
    if (!loggerEnabled || !botSettings.parseLogger.ocr) return;
    if (!logInfoIds.ocr) return;
}

/** 
 * @description Logs an embed to the parse logging channel in discord only
 * @param {Discord.Embed[]} embeds 
 */
function logParseEmbeds(embeds) {
    if (!loggerEnabled || !botSettings.parseLogger.parse) return;
    if (!logInfoIds.parse) return;

}
