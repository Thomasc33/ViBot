// README
// This file contains the helper functions used in ./commands/parse.js

module.exports = {
    /** @typedef MemberResult
     * @property {string} memberID - member id key
     * @property {string} nameInGame - Properly capitalized name of the player in the game
     * @property {Discord.Member} member - Discord Member object
    */
    /** @typedef IdentifyRaidMembersResult
     * @property {string[]} unidentifiedNames
     * @property {MemberResult[]} identifiedMembers
     */
    /**
     * @param {Map<string, string>} whoNamesMap names of the players in the game
     * @param {Discord.Member[]} allowedMembers members allowed to be in the raid (raid members || vc members)
     * @returns {{string[], MemberResult[]}}
     */
    identifyRaidMembers(whoNamesMap, allowedMembers) {
        // for each name search the allowed members for a match
        // if no match is found, try searching combinations of the name in allowedMembers
        // if still not found, add to unidentifiedNames
        /** @type {string[]} */
        const unidentifiedNames = new Map();
        /** @type {MemberResult[]} */
        const foundRaidMembers = [];

        const nicknameToMemberMap = new Map();
        for (const member of allowedMembers) {
            const nicknames = splitNickNames(member);
            nicknames.forEach(nickname => {
                nicknameToMemberMap.set(nickname, member);
            });
        }
        const playerNames = whoNamesMap.keys();
        for (let i = 0; i < playerNames; i++) {
            let playerName = playerNames[i];
            let member = nicknameToMemberMap.get(playerName);
            if (!member) {
                const { matchedRaider, nameArray } = searchCombinationNames(playerNames.slice(i, i + 3), nicknameToMemberMap);
                member = matchedRaider;
                if (matchedRaider) {
                    playerName = nameArray.join('');
                    // update the whoNamesMap to use the combined name
                    whoNamesMap.set(playerName, nameArray.map(name => whoNamesMap.get(name)).join(''));
                    nameArray.forEach(name => whoNamesMap.delete(name));
                    i += nameArray.length - 1; // skip forward by the length of combination
                }
            }
            if (member) foundRaidMembers.push({ memberID: member.id, nameInGame: whoNamesMap.get(playerName), member });
            else unidentifiedNames.set(playerName, whoNamesMap.get(playerName));
        }
        return { unidentifiedNames, foundRaidMembers };
    }
};

/**
 * @description Searches for a sequential combination of playerArray strings in allowedRaidersNicknames, starting by combining all strings, then all but the last, then but the last two, etc.
 *  If a match is found, the Discord.Member object is returned. and the playerArray is spliced to remove the matched names.
 * @param {string[]} playerArray - names to combine and check
 * @param {{{id: Discord.Member, nicknames: string[]}[]}} allowedRaidersNicknames - map of raider id to their nicknames
 * @returns {Discord.Member, string[]} - The matched raider and the number of names combined to match
 */
function searchCombinationNames(playerArray, nicknameToIdMap) {
    for (let i = playerArray.length; i > 1; i--) { // don't bother ot search for single names, that was already checked before
        const combinedName = playerArray.slice(0, i).join('');
        const matchedRaider = nicknameToIdMap.get(combinedName);
        if (matchedRaider) return { matchedRaider, nameArray: playerArray.slice(0, i) };
    }
    return { matchedRaider: null, nameArray: null };
}

/**
 * Takes a GuildMember object and returns the lowercased names split by the | character
 * @param {Discord.Member} member Member object to extract nicknames from
 * @returns {string[]} array of nicknames
 */
function splitNickNames(member) {
    return member.nickname?.replace(/[^a-z|]/gi, '').toLowerCase().split('|');
}
