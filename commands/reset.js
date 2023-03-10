const Discord = require('discord.js');
const pointLogger = require('../lib/pointLogger')

//This takes away points
async function resetPoints(points_log_message, message, bot, db) {
    let sum = 0;
    if (points_log_message == "No Points Given") return;
    points_array = points_log_message.split("\n");

    pointsLog = [];
    for (let point_string of points_array) {
        point_string_split = point_string.split('`')
        let points = +point_string_split[1];
        let user = point_string_split[0].slice(3, point_string_split[0].indexOf('>'))

        try {
            await db.promise().query(`UPDATE users SET points = points - ${points} WHERE id = '${user}'`)
        } catch (er) {
            console.log('error running reset command (revoke points) in ', message.guild.id)
        }
        pointsLog.push({
            uid: user,
            points: -points,
            reason: 'Reset',
        });
        sum++;
    }
    let throwaway_embed = new Discord.EmbedBuilder();
    throwaway_embed.setAuthor({ name: `${message.member.nickname.replace(/[^a-z|]/gi, '').split('|')[0]} Reset` }).setColor("#FF0000");
    await pointLogger.pointLogging(pointsLog, message.guild, bot, throwaway_embed);
    return sum;
}

//This refunds points
async function resetPointsUsers(points_users, early_location_cost, message, db) {
    let sum = 0;
    for (let user of points_users) {
        try {
            await db.promise().query(`UPDATE users SET points = points + ${early_location_cost} WHERE id = '${user}'`)
            console.log("here")
        } catch (er) {
            console.log('error running reset command (refund points) in ', message.guild.id)
        }
        sum++;
    }
    return sum;
}

//This removes a key pop
async function resetKeyPop(key_poppers, key_log_name, message, db) {
    let sum = 0;
    for (let user of key_poppers) {
        try {
            await db.promise().query(`UPDATE users SET ${key_log_name} = ${key_log_name} - 1 WHERE id = '${user}'`)
        } catch(er) {
            console.log(`error running reset command: ${key_log_name} missing from ${message.guild.name} ${message.guild.id}`);
        }
        sum++;
    }
    return sum;
}

//This resets nitro uses
async function resetNitro(nitro_users, message, db) {
    let sum = 0;
    for (let user of nitro_users) {
        try {
            await db.promise().query(`UPDATE users SET lastnitrouse = 0 WHERE id = '${user}'`)
        } catch (er) {
            console.log(`error running reset command (refund nitro points) in ${message.guild.id}`)
        }
        sum++;
    }
    return sum;
}

async function resetLoggedRuns(raiders, run_log_name, message, db) {
    let sum = 0;
    for (let user of raiders) {
        try {
            await db.promise().query(`UPDATE users SET ${run_log_name} = ${run_log_name} - 1 WHERE id = '${user}'`)
        } catch (er) {
            console.log(`error running reset command (remove logged run) in ${message.guild.id}`)
        }
        sum++;
    }
    return sum;
}

module.exports = {
    name: 'reset',
    description: 'Removes amd refunds points and keys for the passed run-history id. The run-history id can be obtained by copying the id of the *history* embed from the run-info channel. The history embed has a Points User field. Only pass history ids of messages with a Points User field.',
    requiredArgs: 1,
    args: "<info-channel history embed id>",
    role: 'officer',

    async execute(message, args, bot, db) {
        const history_id = args[0];
        const settings = bot.settings[message.guild.id];
        const channels = message.guild.channels;
        const run_logs = channels.cache.get(settings.channels.runlogs);
        const point_channel = channels.cache.get(settings.channels.pointlogging)

        let key_log_name;
        let run_log_name;
        let history_message_fields;
        await run_logs.messages.fetch()
            .then(messages => {
                let history_embeds = messages.filter(m => m.id === history_id);
                if (history_embeds.size != 0) {
                    let history_embed_title = history_embeds.first().embeds[0].title.split(" ").pop();
                    if (history_embed_title == "Void") {
                        key_log_name = 'keypops';
                        run_log_name = 'voidRuns';
                    } else if (history_embed_title == "Cult") {
                        key_log_name = 'keypops';
                        run_log_name = 'voidRuns';
                    } else if (history_embed_title == "Event") {
                        key_log_name = 'eventpops';
                        run_log_name = 'eventruns';
                    }
                    history_message_fields = history_embeds.first().embeds[0].fields;
                } else {
                    message.channel.send("Couldn't find the run-history embed with given id.")
                }
            }, reason => { console.error(reason) });
        if (!history_message_fields) {
            message.channel.send("Couldn't find the run-history embed with given id.")
            return;
        }

        let key;
        let raiders;
        let nitro;
        let points_users;
        let early_location_cost;

        if (history_message_fields[2].value != "None!") {
            key = history_message_fields[2].value.replaceAll("<@!", "").replaceAll("<@", "").replaceAll(">", "").split(", ");
        }
        if (history_message_fields[4].value != "None!") {
            raiders = history_message_fields[4].value.replaceAll("<@!", "").replaceAll("<@", "").replaceAll(">", "").split(", ");
        }
        if (history_message_fields[5].value != "None!") {
            nitro = history_message_fields[5].value.replaceAll("<@!", "").replaceAll("<@", "").replaceAll(">", "").split(", ");
        }
        if (history_message_fields[6].value != "None!") {
            points_users = history_message_fields[6].value.replaceAll("<@!", "").replaceAll("<@", "").replaceAll(">", "").split(", ");
            early_location_cost = +history_message_fields[6].name.split(" ").pop();
        }
        const points_mid = history_message_fields[7].value;

        let points_log_message;
        await point_channel.messages.fetch()
            .then(messages => {
                let points_log_embeds = messages.filter(m => m.id === points_mid);
                points_log_message = points_log_embeds.first().embeds[0].description;
            }, reason => { console.error(reason) })

        let point_sum = 0;
        let key_sum = 0;
        let raiders_sum = 0;
        let nitro_sum = 0;
        let point_users_sum = 0;

        if (points_log_message) point_sum = await resetPoints(points_log_message, message, bot, db);

        if (key_log_name && key) key_sum = await resetKeyPop(key, key_log_name, message, db);

        if (run_log_name && raiders) raiders_sum = await resetLoggedRuns(raiders, run_log_name, message, db);

        if (nitro) nitro_sum = await resetNitro(nitro, message, db);

        if (points_users) point_users_sum = await resetPointsUsers(points_users, early_location_cost, message, db);

        let result_embed = new Discord.EmbedBuilder();
        result_embed.setTitle("Reset Succesful!")
            .setColor("#FFFFFF")
            .setDescription(`Points revoked for \`${point_sum}\` user(s).\nPoints refunded for \`${point_users_sum}\` user(s).\nLogged run revoked for \`${raiders_sum}\` user(s).\nNitro use refunded for \`${nitro_sum}\` user(s).\nKey pop revoked for \`${key_sum}\` user(s).`)
        await message.channel.send({ embeds: [result_embed] });
    }
}
