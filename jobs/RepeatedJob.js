const cron = require('cron')

class RepeatedJob {
    bot
    #intervalId = null
    #cronJob = null

    constructor(bot) {
        this.bot = bot
    }

    run() {
        throw new Error("`run` not implimented for RepeatedJob " + this)
    }

    runOnce() {
        return this.run(this.bot)
    }

    runAtInterval(msec) {
        if (this.#intervalId !== null) return false

        this.#intervalId = setInterval(() => this.runOnce(), msec)
        return true;
    }

    stopInterval() {
        if (this.#intervalId === null) return false

        clearInterval(this.#intervalId)
        this.#intervalId = null
        return true;
    }

    schedule(cronString) {
        if (this.#cronJob !== null) return false

        this.#cronJob = cron.job(cronString, () => this.runOnce(), null, true, 'America/New_York', null, false)
        return true;
    }

    endSchedule() {
        if (this.#cronJob === null) return false

        this.#cronJob.stop()
        this.#cronJob = null
        return true;
    }
}

module.exports = { RepeatedJob }
