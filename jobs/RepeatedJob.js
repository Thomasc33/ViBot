const cron = require('cron')
const LogError = require('../lib/logError.js')

class RepeatedJob {
    bot
    #intervalId = null
    #intervalPromiseResolver
    #cronJob = null

    constructor(bot) {
        this.bot = bot
    }

    run() {
        throw new Error('`run` not implimented for RepeatedJob ' + this)
    }

    async runOnce() {
        try {
            return await this.run(this.bot)
        } catch (er) {
            LogError.log(er, this.bot)
        }
    }

    runAtInterval(msec) {
        if (this.#intervalId !== null) return false

        this.#intervalId = setInterval(() => this.runOnce(), msec)
        return new Promise(resolve => {
            this.#intervalPromiseResolver = resolve
        })
    }

    stopInterval() {
        if (this.#intervalId === null) return false

        clearInterval(this.#intervalId)
        this.#intervalId = null
        this.#intervalPromiseResolver()
        return true
    }

    schedule(cronString) {
        if (this.#cronJob !== null) return false

        this.#cronJob = cron.job(cronString, () => this.runOnce(), null, true, 'America/New_York', null, false)
        return true
    }

    endSchedule() {
        if (this.#cronJob === null) return false

        this.#cronJob.stop()
        this.#cronJob = null
        return true
    }
}

module.exports = { RepeatedJob }
