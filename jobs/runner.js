const { bot } = require('../botMeta.js');
const { discordToken } = require('../settings.json')
const { setupBotDBs } = require('../botSetup.js')
const dbSetup = require('../dbSetup.js')

// Jobs
const unbanJobs = require('./unban.js')
const quotaJobs = require('./quota.js')

const jobNameMap = {
    unbanVet: unbanJobs.UnbanVet,
    unsuspend: unbanJobs.Unsuspend,
    keyAlert: require('./keyAlert.js').KeyAlert,
    mute: require('./mute.js').Mute,
    biWeeklyQuota: quotaJobs.BiWeeklyQuota,
    monthlyQuota: quotaJobs.MonthlyQuota,
}

const jobsToRun = {
    oneshot: [],
    interval: [],
    cron: [],
}

process.argv.slice(2).forEach(arg => {
    const argParts = arg.split(':')
    if (argParts.length > 2) throw new Error('Invalid argument ' + arg + '\nArguments must be of the form <jobName> (for run-once jobs) or <jobName>:<frequencyString> (for recurring jobs)')
    const [jobName, freqString] = argParts;
    const job = jobNameMap[jobName]
    if (!job) throw new Error('Invalid job name ' + jobName + '. Valid job names are: ', Object.keys(jobNameMap).join(', '))
    job.cliRunnerJobName = jobName;
    if (!freqString) {
        jobsToRun.oneshot.push(job)
    } else if (freqString.match(/^\d+$/)) {
        const interval = parseInt(freqString)
        console.log('Scheduling ' + jobName + ' to run every ' + (interval / 1000) + ' seconds')
        jobsToRun.interval.push([job, interval])
    } else if (freqString.split(' ').length == 5) {
        console.log('Scheduling ' + jobName + ' to run with the schedule: ' + freqString)
        jobsToRun.cron.push([job, freqString])
    } else {
        throw new Error('Invalid frequency string ' + freqString)
    }
})

bot.on('ready', async () => {
    console.log('Connecting to DB...')
    await dbSetup.init(bot)
    console.log('DB connecting complete')
    await Promise.all(jobsToRun.oneshot.map(async Job => {
        console.log('Running oneshot job ' + Job.cliRunnerJobName)
        const jobExecutor = new Job(bot);
        await jobExecutor.runOnce();
        console.log('Job ' + Job.cliRunnerJobName + ' complete')
    }))
    console.log('Launching interval jobs')
    const intervalJobPromises = jobsToRun.interval.map(([Job, interval]) => {
        const jobExecutor = new Job(bot)
        return jobExecutor.runAtInterval(interval)
    })
    console.log('Launching cron jobs')
    const cronJobPromises = jobsToRun.cron.map(([Job, cronString]) => {
        const jobExecutor = new Job(bot)
        jobExecutor.schedule(cronString)
        // Cron never ends, so unresolvable promise
        return new Promise(() => {})
    })
    await Promise.all(intervalJobPromises.concat(cronJobPromises))
    await bot.destroy()
    dbSetup.endAll()
})

bot.login(discordToken);
