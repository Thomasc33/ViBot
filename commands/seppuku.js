const { settings } = require('../lib/settings');

module.exports = {
    name: 'seppuku',
    role: 'eventrl',
    description: '死ぬ',
    async execute(message, args, bot, db) {
        const { roles, lists } = settings[message.guild.id];
        const time = 300000; // 5 min
        const reason = 'seppuku';
        let userRolesString = '';
        const userRoles = [];

        // remove roles and suspend
        message.member.roles.cache.each(r => {
            if (!r.managed) return;
            if (lists.discordRoles.map(role => roles[role]).includes(r.id)) return;
            userRoles.push(r.id);
            userRolesString = userRolesString.concat(`${r.id} `);
        });
        await message.member.roles.remove(userRoles);

        setTimeout(() => { message.member.roles.add(roles.tempsuspended); }, 1000);
        db.query('INSERT INTO suspensions (id, guildid, suspended, uTime, reason, modid, roles, logmessage) VALUES (?, ?, true, ?, ?, ?, ?, ?);',
            [message.member.id, message.guild.id, Date.now() + time, db.escape(reason), message.author.id, userRolesString, message.id]);

        message.channel.send('死ぬ!');
    }
};
