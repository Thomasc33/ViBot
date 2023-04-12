const {InfluxDB, Point} = require('@influxdata/influxdb-client')
const Discord = require('discord.js')
const botSettings = require('./settings.json')
const process = require('process')

const influxDB = !!botSettings.influxDB ? new InfluxDB({token: botSettings.influxDB.token, url: botSettings.influxDB.url}).getWriteApi('vibot', botSettings.influxDB.bucket, 'ns') : undefined

// write node resource/cpu/memory usage
function writeProcessUsage() {
    const point = new Point('node_process')
    let ru = process.resourceUsage()
    for (const [key, value] of Object.entries(ru)) {
      point.intField(key, value)
    }
    let mu = process.memoryUsage()
    for (const [key, value] of Object.entries(mu)) {
      point.intField(key, value)
    }
    point.floatField('uptime', process.uptime())
    if (!influxDB) return
    influxDB.writePoint(point)
}

const nodeUsageTimer = setInterval(writeProcessUsage, 10000)

function onShutdown() {
  clearInterval(nodeUsageTimer)
}

process.on('exit', onShutdown)

module.exports = {
    genPoint (measure, message) {
        let point = new Point(measure)
            .stringField('id', message.id)
            .tag('type', message instanceof Discord.Message ? "message" : (message instanceof Discord.BaseInteraction ? "interaction" : undefined))
        if (message.inGuild()) {
            point.tag('guild', message.guild?.name + ':' + message.guildId)
            point.tag('channel', message.channel?.name + ':' + message.channelId)
        } else if (message.channel.isDMBased()) {
            point.tag('dmuser', message.channel.recipient?.tag + ':' + message.channel.recipientId)
        }
        return point
    },
    logMessage(measure, message, f) {
        let point = module.exports.genPoint(measure, message)
        if (f) point = f(point)
        if (!influxDB) return
        influxDB.writePoint(point)
        influxDB.flush()
    },
    logWrapper(measurement, f) {
        return async function(message, ...argv) {
            let point = module.exports.genPoint(measurement, message)
            let log = function(tag) {
                if (tag) point = point.tag(tag, true)
            }
            const ret = await f(log, message, ...argv)
            module.exports.writePoint(point)
            return ret
        }
    },
    writePoint(point) {
        if (!influxDB) return
        influxDB.writePoint(point)
        influxDB.flush()
    }
}

