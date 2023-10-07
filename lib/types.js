/**
 * @typedef QuotaValue
 * @property {string} name
 * @property {number} value
 */
/**
 * @typedef Quota
 * @property {string} name
 * @property {number} total
 * @property {QuotaValue[]} values
 */
/**
 * @typedef QuotaExcuse
 * @property {import('discord.js').Snowflake} modid
 * @property {string} reason
 * @property {string} image
 */
/**
 * @typedef MemberQuota
 * @property {import('discord.js').GuildMember} member
 * @property {boolean} leave
 * @property {QuotaExcuse} excuse
 */
/**
 * @typedef QuotaColumn
 * @property {string} column
 * @property {string} name
 * @property {number} value
 * @property {boolean?} isRun
 */
/**
 * @typedef GuildQuota
 * @property {string} id
 * @property {string} name
 * @property {string[]} roles
 * @property {number} quota
 * @property {QuotaColumn[]} values
 */
