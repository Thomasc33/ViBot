const config = require('../settings.json');
const { ErrorLogger } = require('./logError');
const fs = require('fs');
const EventSource = require('eventsource');
module.exports = {
    config,
    settings: {},
    timestamp: {},
    async load(bot) {
        const { config } = this.config;
        await Promise.all(config?.guildIds.map(guildId => {
            const sseUrl = new URL(config.url);
            sseUrl.pathname = `/guild/${guildId}/sse`;
            sseUrl.searchParams.append('key', config.key);
            const settingsEventSource = new EventSource(sseUrl.toString());
            settingsEventSource.addEventListener('error', err => ErrorLogger.log(err, bot));
            settingsEventSource.addEventListener('open', () => console.log(`Settings SEE Socket opened for ${guildId}`));
            const cacheFile = `data/guildSettings.${guildId}.cache.json`;
            let fileReadTimeout;
            return new Promise(res => {
                // Wait 1s before reading from cache
                settingsEventSource.addEventListener('message', m => {
                    console.log(`Updated settings for ${guildId}`);
                    const data = JSON.parse(m.data);
                    this.settings[guildId] = data;
                    this.timestamp[guildId] = m.lastEventId;
                    res();
                    fs.writeFile(`data/guildSettings.${guildId}.cache.json`, JSON.stringify({ logId: m.lastEventId, ...data }), () => {});
                });

                // Read from cache
                fs.access(cacheFile, (err) => {
                    if (err) return;
                    fileReadTimeout = setTimeout(() => {
                        console.log(`Could not fetch settings for ${guildId} reading cache`);
                        const data = JSON.parse(fs.readFileSync(cacheFile));
                        this.timestamp[guildId] = data.logId;
                        delete data.logId;
                        this.settings[guildId] = data;
                        res();
                    }, 1000);
                });
            }).then(() => clearTimeout(fileReadTimeout));
        }) ?? []);
    }
};
