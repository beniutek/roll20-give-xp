// author: beniutek (Biskup Beniutek)
// license: MIT
// The script checks all character sheets and saves the ones that have
// {{current_player}} in the GM notes as characters controlled by players (so that later one only those characters progress with xp)
//
// COMMAND
// !givexp [xp amount]
// SYNOPSIS
// !givexp [--all --selected --total --portion] [xp amount]
// DESCRIPTION
// xp amount must be numeric. It can be negative
// --all makes it so that all available characters controlled by players receive xp
// --selected makes it so that only character tokens selected on the map receive xp. This is the default. If there are no selected PCs then it takes all PCs available.
// --total tells the script to treat the xp amount as a total amount of xp to be distributed between valid characters. This is the defaul
// --portion tells the script that this xp value should be added to each character (so no distribution)
// EXAMPLES
// assumption: There are total of 4 PCs.
// !givexp 1000           -> takes all SELECTED PCs and gives 250 XP to each
// !givexp --all 1000     -> takes all PCs and give 250 XP to each
// !givexp --portion 1000 -> takes all SELECTED PCs and gives 100 XP to each

on('ready', () => {
    if (BENIUTEKTRACKEXPERIENCEPOINTS.playerCharacters.length > 0) return;

    let playerCharacters = [];
    const characters = findObjs({ _type: 'character' });

    _.forEach(characters, (character) => {
        character.get("gmnotes", (str) => {
            if (BENIUTEKTRACKEXPERIENCEPOINTS.markedAsActivePlayer(str)) {
                expMultiplier = BENIUTEKTRACKEXPERIENCEPOINTS.getExpMultiplier(str) || 1;
                log({ name: character.attributes.name, characterId: character.attributes._id, expMultiplier: expMultiplier });
                BENIUTEKTRACKEXPERIENCEPOINTS.playerCharacters.push({ name: character.attributes.name, characterId: character.attributes._id, expMultiplier: expMultiplier });
            }
        });
    });
});

on('chat:message', function(msg) {
    if (msg.type !== 'api') return;
    if (!/^!givexp(\b\s|$)/i.test(msg.content)) return;
    if (!playerIsGM(msg.playerid)) {
        sendChat("Rorch", "Tylko MG może przyznawać punkty doświadczenia chuje");
        return;
    }

    log(msg);

    const xp = BENIUTEKTRACKEXPERIENCEPOINTS.getExpFromChat(msg);

    if (!xp) {
        sendChat("Rorch", "wpisz wartość liczbową debilu");
        return;
    }

    // !givexp --portion 100 --> przyznaje 100 XP każdemy playerowi
    // !givexp 100 --> przyznaje 100 XP całej drużynie (czyli 100 podzielone przez ilość postaci)
    const xpDistribution = BENIUTEKTRACKEXPERIENCEPOINTS.getXpDistributionFromChat(msg);
    BENIUTEKTRACKEXPERIENCEPOINTS.setXpDistribution(xpDistribution);
    // !givexp --all 100 --> przyznaje XP wszystkim postaciom
    // !givexp 100 --> przyznaje XP tylko zaznaczonym postaciom. Jesli nie ma zaznaczonych tokenów
    // to przyznaje 100 xp wszystkim postaciom
    const mode = BENIUTEKTRACKEXPERIENCEPOINTS.getModeFromChat(msg);
    let playerCharacters = []

    switch (mode) {
        case BENIUTEKSCRIPTMODE.SELECTED:
          playerCharacters = BENIUTEKTRACKEXPERIENCEPOINTS.getSelectedCharactersFromChat(msg);
        break;
        case BENIUTEKSCRIPTMODE.ALL:
          playerCharacters = BENIUTEKTRACKEXPERIENCEPOINTS.playerCharacters;
        break;
        default:
          playerCharacters = BENIUTEKTRACKEXPERIENCEPOINTS.playerCharacters;
    }

    BENIUTEKTRACKEXPERIENCEPOINTS.grantXpTo(playerCharacters, xp);
});

const BENIUTEKSCRIPTMODE = {
    ALL: 'all',
    SELECTED: 'selected'
}

const XPDISTRIBUTION = {
    TOTAL: 'total',
    PORTION: 'portion'
}

const BENIUTEKTRACKEXPERIENCEPOINTS = {
    //
    // an array of objects
    // [{ name:, characterId:, expMultiplier:, }]
    //
    playerCharacters: [],
    xpDistribution: XPDISTRIBUTION.TOTAL,
    markedAsActivePlayer: (str) => { return /{{current_player}}/.test(str); },
    getExpMultiplier: (str) => {
        const result = /(?<={{experience_multiplier:).*(?=}})/.exec(str);
        return result && parseFloat(result[0]);
    },
    getExpFromChat: (chatMsg) => {
        const str = chatMsg.content;
        const result = /\d+/.exec(str);
        const parsed = parseInt(result && result[0]);
        return parsed === NaN ? null : parsed;
    },
    getModeFromChat: (chatMsg) => {
        const str = chatMsg.content;
        const all = /--all/.test(str);

        if (all) return BENIUTEKSCRIPTMODE.ALL;
        if (chatMsg.selected) return BENIUTEKSCRIPTMODE.SELECTED;

        return BENIUTEKSCRIPTMODE.ALL;
    },
    getXpDistributionFromChat: (chatMsg) => {
        const str = chatMsg.content;
        const portion = /--portion/.test(str);

        if (portion) return XPDISTRIBUTION.PORTION;

        return XPDISTRIBUTION.TOTAL;
    },
    setXpDistribution: (xpDistribution) => {
        BENIUTEKTRACKEXPERIENCEPOINTS.xpDistribution = xpDistribution;
    },
    getSelectedCharactersFromChat: (chatMsg) => {
        let tokenIds = [];
        let selectedCharacters = [];

        _.forEach(chatMsg.selected, (item) => tokenIds.push(item._id));
        const selectedTokens = filterObjs((obj) => (obj.get('_type') === 'graphic' && tokenIds.includes(obj.get('_id'))));
        _.forEach(selectedTokens, (token) => {
            const tmp = _.find(BENIUTEKTRACKEXPERIENCEPOINTS.playerCharacters, (player) => player.characterId === token.get('represents'));
            if (!_.find(selectedCharacters, (player) => player.characterId === tmp.characterId)) selectedCharacters.push(tmp);
        });

        return selectedCharacters
    },
    grantXpTo: (characters, xp) => {
        if (!characters || characters.length === 0) return;

        const teamSize = characters.length;
        const portionXp = BENIUTEKTRACKEXPERIENCEPOINTS.xpDistribution === XPDISTRIBUTION.TOTAL ? xp/teamSize : xp;
        const tmp = []
        _.forEach(characters, (characterInfo) => {
            const characterXp = findObjs({ type: 'attribute', characterid: characterInfo.characterId, name: 'expcurrent' })[0];
            if (!characterXp) {
                sendChat("Rorch", "Zjebao sie, nie odnalezionio characterXp dla " + characterInfo.name);
            } else {
                const currentXp = parseInt(characterXp.get('current'));
                const newXp = currentXp + portionXp * characterInfo.expMultiplier
                characterXp.set('current', Math.round(newXp));
                tmp.push({ name: characterInfo.name, xp: (portionXp * characterInfo.expMultiplier) });
            }
        });
        const title = "&{template:default} {{name=Granted experience}}"
        const body = _.map(tmp, (i) => (' {{' + i.name + '=' + Math.round(i.xp) + '}}')).join('');
        sendChat('Rorch', title + body);
    },
}
