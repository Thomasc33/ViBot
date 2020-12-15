const { execute } = require("./redeem");

module.exports = {
    name: 'generatetokens',
    role: 'developer',
    args: '<cooldown> <time(ms)> <amount>',
    requiredArgs: 3,
    async execute(message, args, bot, db, tokenDB) {
        if (message.author.id !== '277636691227836419') return

        //arg 0
        let hasCooldown
        if (args[0].charAt(0).toLowerCase() == 't') hasCooldown = true
        else if (args[0].charAt(0).toLowerCase() == 'f') hasCooldown = false
        else return message.channel.send(`Please provide either true or false for cooldown`)

        //arg 1
        let time = parseInt(args[1])
        if (time == 0 || time == NaN) return message.channel.send(`Time unknown: ${time}`)

        //arg 2
        let amount = parseInt(args[2])
        if (amount == 0 || amount == NaN) return message.channel.send(`Amount unknown: ${amount}`)

        //generate amount of tokens
        let tokens = []
        for (let i = 0; i < amount; i++) tokens.push(generateToken(64, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'))

        //insert into DB
        let query = `INSERT INTO tokens (token, hasCooldown, duration) VALUES `
        for (let i in tokens) query += `('${tokens[i]}', ${hasCooldown}, '${time}'),`
        query = query.substr(0, query.length - 1)
        tokenDB.query(query, err => {
            if (err) message.channel.send(err)
        })
        let tokenString = ''
        for (let i in tokens) {
            if (tokenString.length >= 1800) {
                message.author.send(tokenString)
                tokenString = ''
            }
            tokenString += tokens[i] + ','
        }
        message.author.send(tokenString)
    }
}

function generateToken(length, chars) {
    let result = '';
    for (let i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}