module.exports = {
    name: 'seppuku',
    role: 'eventrl',
    description: '死ぬ',
    async execute(message, args, bot, db) {
        const settings = bot.settings[message.guild.id];
        const suspendedRole = settings.roles.tempsuspended;
        const time = 300000; // 5 min
        const reason = 'seppuku';
        let userRolesString = '';
        const userRoles = [];

        // remove roles and suspend
        message.member.roles.cache.each(r => {
            if (!r.managed) return;
            if (settings.lists.discordRoles.map(role => settings.roles[role]).includes(r.id)) return;
            userRoles.push(r.id);
            userRolesString = userRolesString.concat(`${r.id} `);
        });
        await message.member.roles.remove(userRoles);

        setTimeout(() => { message.member.roles.add(suspendedRole); }, 1000);
        db.query('INSERT INTO suspensions (id, guildid, suspended, uTime, reason, modid, roles, logmessage) VALUES (?, ?, true, ?, ?, ?, ?, ?);',
            [message.member.id, message.guild.id, Date.now() + time, db.escape(reason), message.author.id, userRolesString, message.id]);

        message.channel.send('死ぬ!');
    }
};
