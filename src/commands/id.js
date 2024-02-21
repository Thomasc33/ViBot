module.exports = {
    name: "id",
    description: "Gets user ID",
    args: '[IGN | mention | tag]',
    requiredArgs: 1,
    role: 'almostrl',
    async execute(message, args, bot, db) {
        const memberSearch = args.join(' ');
        let member = null;
        if (!args.length) member = message.member;
        if (!member) member = message.guild.members.cache.get(memberSearch.replace(/\D+/gi, ''));
        if (!member && /#\d{4}$/.test(memberSearch)) member = message.guild.members.cache.find(user => user.user.tag.toLowerCase() == memberSearch.toLowerCase());
        if (!member) member = message.guild.members.cache.filter(user => user.nickname != null).find(nick => nick.nickname.toLowerCase() == memberSearch || nick.nickname.replace(/[^a-z|]/gi, '').toLowerCase().split('|').includes(memberSearch.toLowerCase()));
        if (!member) return message.channel.send(`No user found for ${memberSearch}`);
        message.channel.send(`${member.id}`);
    }
}