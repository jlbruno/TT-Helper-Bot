/*global config:true */

var fs = require('fs');
var extend = require('./node.extend');
var util = require('util');
var startTime = new Date();

var debug = false;

if (!debug) {
    /* to hopefully keep bot from crashing */
    process.on('uncaughtException', function (err) {
        botSpeak('console', 'Caught exception: ' + err);
        // TODO: catch if socket was closed and reboot bot...
        if (err === "Error: This socket is closed.") {
            onReady();
        }
    });
}

var bot = null;
var config = null;
var ttRoom = {
    roomMods: null,
    history: [],
    djList: {},
    userList: {},
    recentDjs: {},
    danceUsers: [],
    danceCounter: 0,  // how many ppl have told the bot to dance this song
    botOnDeck: false,  // true when the bot is on deck
    djHelper: false,  // set true when bot is dj'ing in 'help' mode
    queue: [] // array of users in queue
};

var getUpTime = function () {
    var str = '';
    var now = new Date();
    var diffMS = now - startTime;
    var diff = new Date(diffMS);
    var spinningTime;

    str = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());

    return str;
};

var Song = function () {
    this.songTitle = '';
    this.artist = '';
    this.djId = '';
    this.djName = '';
    this.votes = { 'up': 0, 'down': 0 };
    this.hearts = 0;
};

var currentSong = new Song();

var addCurrentSongToHistory = function (data) {
    if (data.room.metadata.current_song === null) {
        return;
    }

    // create a new 'play' object with the last played song
    // this is what we'll add to the history
    var play = new Song();
    play.songTitle = currentSong.songTitle;
    play.artist = currentSong.artist;
    play.djId = currentSong.djId;
    play.djName = currentSong.djName;
    play.votes.up = currentSong.votes['up'];
    play.votes.down = currentSong.votes['down'];
    play.hearts = currentSong.hearts;

    // add the 'play' object to history
    if (play.djId !== '') {
        ttRoom.history.unshift(play);
        if (ttRoom.history.length > 3) {
            ttRoom.history.pop();
        }
    }

    // reset the properties of the 'currentSong' object to what is currently playing
    currentSong.songId = data.room.metadata.current_song._id;
    currentSong.songTitle = data.room.metadata.current_song.metadata.song;
    currentSong.artist = data.room.metadata.current_song.metadata.artist;
    currentSong.djId = data.room.metadata.current_song.djid;
    currentSong.djName = data.room.metadata.current_song.djname;
    currentSong.votes.up = data.room.metadata.upvotes;
    currentSong.votes.down = data.room.metadata.downvotes;
    currentSong.hearts = 0;
};

var isRoomMod = function (userid) {
    if (ttRoom.roomMods) {
        return ttRoom.roomMods.indexOf(userid) > -1 ? true : false;
    } else {
        return false;
    }
};

var findOwner = function () {
    bot.stalk(config.botOwner, function (data) {
        bot.roomRegister(data.roomId);
    });
};

var homeRoom = function () {
    bot.roomRegister(config.roomid);
};


var timeFormat = function (num) {
    return (num < 10) ? "0" + num : num;
};

var getIdleTimes = function () {
    var str = '';
    var now = new Date();
    for (var dj in ttRoom.djList) {
        var djObj = ttRoom.djList[dj];
        var lastActivity = djObj.lastActivity;
        var diffMS = now - lastActivity;
        var diff = new Date(diffMS);
        var idleTime;

        if (diff.getUTCHours() > 0) {
            idleTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
        } else {
            idleTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
        }

        str = str + djObj.name + ': ' + idleTime + '; ';

    }
    return str;
};

var getAfkTimes = function (time) {
    var str = '';
    var now = new Date();
    for (var dj in ttRoom.djList) {
        var djObj = ttRoom.djList[dj];
        var lastActivity = djObj.lastActivity;
        var diffMS = now - lastActivity;
        var diff = new Date(diffMS);
        var idleTime;

        if (diffMS >= (time * 60000)) {

            if (diff.getUTCHours() > 0) {
                idleTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
            } else {
                idleTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
            }

            str = str + util.format('@%s: %s;', djObj.name, idleTime);
        }
    }
    if (str === '') {
        str = util.format('No DJs currently over %s minutes idle', time);
    }
    return str;
};

//var pmMods = function (text) {
//    for (var user in ttRoom.roomMods) {
//        ttRoom.roomMods[user].moderator_id;
//        botSpeak('pm', text);
//    }
//};


var getuserlist = function () {
    var str = '';
    var now = new Date();
    for (var user in ttRoom.userList) {
        var userObj = ttRoom.userList[user];
        var lastActivity = userObj.lastActivity;
        var diffMS = now - lastActivity;
        var diff = new Date(diffMS);
        var idleTime;
        if (diff.getUTCHours() > 0) {
            idleTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
        } else {
            idleTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
        }
        str = str + util.format('%s: %s;', userObj.name, idleTime);
    }
    return str;
};

//AFK CHECKING
var afkCheck = function () {
    var str = '';
    var now = new Date();

    for (var dj in ttRoom.djList) {
        var djObj = ttRoom.djList[dj];
        var lastActivity = djObj.lastActivity;
        var diffMS = now - lastActivity;
        var diff = new Date(diffMS);
        var idleTime;

        if (config.afkCheck) {
            if ((diff.getUTCMinutes() === 10) && (diff.getUTCSeconds() === 0) && (djObj.userid != config.userid)) {
                idleTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
                str = util.format('%s', idleTime);
                botSpeak('chat', "Please keep active while on deck @" + djObj.name + " your AFK time is: " + str + " and I will escort at 15:00");
            }
            if ((diff.getUTCMinutes() === 15) && (diff.getUTCSeconds() === 0) && (djObj.userid != config.userid)) {
                idleTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
                str = util.format('%s', idleTime);
                bot.remDj(djObj.userid);
                botSpeak('chat', "@" + djObj.name + " escorted for AFK time of: " + str);
                WriteToLog(config.botlog, djObj.name + " : " + djObj.userid + " escorted for AFK time of: " + str);
            }
        }
    }
};

setInterval(afkCheck, 1000) //This repeats the every 1 second

///TIMERS
var TimersCheck = function () {
    var str = '';
    var now = new Date();
    for (var dj in ttRoom.djList) {
        var djObj = ttRoom.djList[dj];
        var startedSpinning = djObj.startedSpinning;
        var diffMS = now - startedSpinning;
        var diff = new Date(diffMS);
        var spinningTime;

        if ((diff.getUTCHours() === 3) && (diff.getUTCMinutes() === 0) && (diff.getUTCSeconds() === 0)) {
            spinningTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
            str = util.format('%s', spinningTime);
            botSpeak('chat', "Please step down after your next track @" + djObj.name + " your deck time is at: " + str);
        }
        if ((diff.getUTCHours() === 3) && (diff.getUTCMinutes() >= 30) && (diff.getUTCSeconds() === 0) && (djObj.userid != config.userid) && (djObj.userid != currentSong.djId)) {
            spinningTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
            str = util.format('%s', spinningTime);
            botSpeak('chat', "Please step down after your next track @" + djObj.name + " your deck time is at: " + str);
        }
    }
};

setInterval(TimersCheck, 5000) //This repeats the every 5 seconds

//CROWD AFK CHECKING
var afkCrowdCheck = function () {
    var str = '';
    var now = new Date();

    for (var user in ttRoom.userList) {
        var userObj = ttRoom.userList[user];
        var lastActivity = userObj.lastActivity;
        var diffMS = now - lastActivity;
        var diff = new Date(diffMS);
        var inactiveTime;

        if (config.crowdCheck) {
            if ((diff.getUTCHours() >= config.inactiveLimit) && (diff.getUTCMinutes() === 0) && (diff.getUTCSeconds() === 0) && (userObj.userid != config.userid) && (userObj.userid != config.battlebot)) {
                inactiveTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
                str = util.format('%s', inactiveTime);
                bot.bootUser(userObj.userid, 'crowd control for afk over ' + config.inactiveLimit + " hours.");
                WriteToLog(config.botlog, "afk crowd limit up for @" + userObj.name + " " + userObj.userid + ": " + str);
            }
        }
    }
};

setInterval(afkCrowdCheck, 1000) //This repeats the every 1 second

var getDjTimes = function () {
    var str = '';
    var now = new Date();
    for (var dj in ttRoom.djList) {
        var djObj = ttRoom.djList[dj];
        var startedSpinning = djObj.startedSpinning;
        var diffMS = now - startedSpinning;
        var diff = new Date(diffMS);
        var spinningTime;

        if (diff.getUTCHours() > 0) {
            spinningTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
        } else {
            spinningTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
        }

        str = str + djObj.name + ': ' + spinningTime + '; ';

    }
    return str;
};

var getLastSongs = function (param) {
    var string = '';
    if (param > 3) {
        param = 3;
        botSpeak(where, "I don't keep a history that far back. Here's what I know. ", commandObj.pmID);
    }
    var len = param || 1;

    for (var i = 0; i < len; i++) {
        if (ttRoom.history[i] === undefined) {
            string = string + 'I don\'t have history for the ' + getGetOrdinal(i + 1) + ' song, sorry. ';
            continue;
        }
        string = string + util.format('♫ %s played "%s" by %s. Votes: %d⇑ %d⇓. ♥s: %d. ', ttRoom.history[i].djName, ttRoom.history[i].songTitle, ttRoom.history[i].artist, ttRoom.history[i].votes.up, ttRoom.history[i].votes.down, ttRoom.history[i].hearts);
    }
    return string;

};


var getGetOrdinal = function (n) {
    var s = ["th", "st", "nd", "rd"],
       v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};


var addUserToDJList = function (user) {
    // if there is 5 or more ppl on djlist, something went wrong
    // let's remove the first one
    if (Object.keys(ttRoom.djList).length >= 5) {
        delete ttRoom.djList[Object.keys(ttRoom.djList)[0]];
    }

    user.lastActivity = new Date();
    user.startedSpinning = new Date();
    ttRoom.djList[user.userid] = user;

};

// where to speak, what to speak, who to speak to (pm only)
var botSpeak = function (where, what, who) {
    switch (where) {
        case 'chat':
            bot.speak(what);
            break;
        case 'pm':
            bot.pm(what, who);
            break;
        case 'console':
            console.log(what);
            break;
    }
};


var selfCommand = function (command, param) {
    var who = {
        isOwner: true,
        isMod: true,
        isDj: null
    };

    var commandObj = {
        'command': command,
        'param': param,
        'who': who
    };

    doCommand(commandObj);

};


//var doCommand = function(command, param, who, data) {
var doCommand = function (commandObj) {
    //    botSpeak('console', commandObj);
    // who's talking to us? 
    var who = commandObj.who;
    var spkr = {
        isOwner: false,
        isSelf: false,
        isMod: false,
        isDj: false
    };
    extend(spkr, who);

    var levelOne = (spkr.isDj || spkr.isMod || spkr.isOwner || spkr.isSelf) ? true : false;
    var levelTwo = (spkr.isMod || spkr.isOwner || spkr.isSelf) ? true : false;
    var levelThree = (spkr.isOwner) ? true : false;

    var param = commandObj.param;
    // set param to true/false based on string passed in
    if (param === "true") {
        param = true;
    } else if (param === "false") {
        param = false;
    }

    // where should the bot respond? console, chat, pm?
    var where = commandObj.where || 'chat';

    switch (commandObj.command) {
        //ANYONE COMMANDS                                            
        case 'commands':
            botSpeak('chat', "My current commands are: *ANYONE: jdance, jlast, jroominfo, jfliptable, jfixtable *DJ: jafk, jidle, jtimers.");
            break;
        case 'tiny':
            botSpeak('chat', "Mix Mash Paddywhack tinychat link: http://tinychat.com/mixmash");
            break;
        case 'fb':
            botSpeak('chat', "MMPW FB group:    http://tinyurl.com/8a8d9vn");
            break;
        case 'rules':
            botSpeak('chat', "Mash-Ups or Remixes please, " + config.songLimit + " minute song limit at this time, 15min AFK rule, 3 hr DJ limit. Full rules at: http://tinyurl.com/88mnf7j");
            break;
        case 'dance':
            if (config.danceMode) bot.vote('up');
            break;
        case 'smoke':
            if (config.danceMode) bot.vote('up');
            botSpeak(where, "SMOKE 'EM IF YOU GOT 'EM!", commandObj.pmID);
            break;
        case 'last':
            botSpeak(where, getLastSongs(param), commandObj.pmID);
            break;
        case 'roominfo':
            bot.roomInfo(false, function (data) {
                if (data.room.description) {
                    botSpeak('chat', data.room.description);
                } else {
                    botSpeak('chat', "There doesn't seem to be any info about this room!");
                }
            });
            break;
        case 'theme':
            selfCommand('roominfo');
            break;

        case 'fliptable':
            botSpeak('chat', '(ノಠ益ಠ)ノ彡┻━┻');
            break;
        case 'fixtable':
            botSpeak('chat', '┬─┬ノ( º _ ºノ)');
            break;


        //DJ COMMANDS                                                 
        case 'afk':
            var time = parseInt(param);
            time = ((typeof (time) === "number") && (time > 0)) ? time : 15;
            if (spkr.isDj || spkr.isMod || spkr.isOwner) {
                botSpeak(where, getAfkTimes(time), commandObj.pmID);
            } else {
                botSpeak(where, "I'm sorry that is a DJ or Mod command.", commandObj.pmID);
            }
            break;
        case 'idle':
            if (spkr.isDj || spkr.isMod || spkr.isOwner) {
                botSpeak(where, getIdleTimes(), commandObj.pmID);
            } else {
                botSpeak(where, "I'm sorry that is a DJ or Mod command.", commandObj.pmID);
            }
            break;
        case 'timers':
            if (spkr.isDj || spkr.isMod || spkr.isOwner) {
                botSpeak(where, getDjTimes(), commandObj.pmID);
            } else {
                botSpeak(where, "I'm sorry that is a DJ or Mod command.", commandObj.pmID);
            }
            break;


        //MODERATOR COMMANDS          
        case 'uptime':
            if (spkr.isMod || spkr.isOwner) {
                botSpeak(where, getUpTime(), commandObj.pmID);
            }
            break;
        case 'logthis':
            if (spkr.isMod || spkr.isOwner) {
                var text = param;
                botSpeak(where, 'logged: ' + text, commandObj.pmID);
                WriteToLog(config.botlog, '*****mod logged: ' + text + ' by: ' + data.name);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'userlist':
            if (spkr.isMod || spkr.isOwner) {
                botSpeak(where, getuserlist(), commandObj.pmID);
            }
            break;
        case 'crowdcheck':
            if (spkr.isMod || spkr.isOwner) {
                config.crowdCheck = param;
                botSpeak(where, 'crowdCheck set to: ' + config.crowdCheck, commandObj.pmID);
                botSpeak('console', 'crowdCheck set to: ' + config.crowdCheck + " by: " + data.name);
                WriteToLog(config.botlog, 'crowdCheck set to: ' + config.crowdCheck + " by: " + data.name);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'setcrowdcheck':
            if (spkr.isMod || spkr.isOwner) {
                config.inactiveLimit = param;
                botSpeak(where, 'inactiveLimit set to: ' + config.inactiveLimit + " hours.", commandObj.pmID);
                botSpeak('console', 'inactiveLimit set to: ' + config.inactiveLimit + " hours." + " by: " + data.name);
                WriteToLog(config.botlog, 'inactiveLimit set to: ' + config.inactiveLimit + " hours." + " by: " + data.name);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'crowdcheckstat':
            if (spkr.isMod || spkr.isOwner) {
                botSpeak(where, 'crowdCheck set to: ' + config.crowdCheck + ' and at ' + config.inactiveLimit + ' hours.', commandObj.pmID);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'afkcheck':
            if (spkr.isMod || spkr.isOwner) {
                config.afkCheck = param;
                botSpeak(where, 'afkcheck set to: ' + config.afkCheck, commandObj.pmID);
                botSpeak('console', 'afkcheck set to: ' + config.afkCheck + " by: " + data.name);
                WriteToLog(config.botlog, 'afkcheck set to: ' + config.afkCheck + " by: " + data.name);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'afkcheckstat':
            if (spkr.isMod || spkr.isOwner) {
                botSpeak(where, 'afkcheck set to: ' + config.afkCheck, commandObj.pmID);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'songtimer':
            if (spkr.isMod || spkr.isOwner) {
                config.songTimer = param;
                botSpeak(where, 'songtimer set to: ' + config.songTimer, commandObj.pmID);
                botSpeak('console', 'songtimer set to: ' + config.songTimer + " by: " + data.name);
                WriteToLog(config.botlog, 'songtimer set to: ' + common + " by: " + data.name);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'songtimerstat':
            if (spkr.isMod || spkr.isOwner) {
                botSpeak(where, 'songtimer set to: ' + config.songTimer, commandObj.pmID);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'autobop':
            if (spkr.isMod || spkr.isOwner) {
                config.autobop = param;
                botSpeak(where, 'autobop set to: ' + config.autobop, commandObj.pmID);
                botSpeak('console', 'autobop set to: ' + config.autobop + " by: " + data.name);
                WriteToLog(config.botlog, 'autobop set to: ' + config.autobop + " by: " + data.name);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'autobopstat':
            if (spkr.isMod || spkr.isOwner) {
                botSpeak(where, 'autobop set to: ' + config.autobop, commandObj.pmID);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'setlimit':
            if (spkr.isMod) {
                config.songLimit = parseInt(param);
                botSpeak('chat', 'Song limit has been set to ' + config.songLimit + ' minutes starting next track. (however I do not escort at this time)');
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'whatslimit':
            if (spkr.isMod) {
                botSpeak(where, 'Song limit is ' + config.songLimit, commandObj.pmID);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'current':
            if (spkr.isMod || spkr.isOwner) {
                var string = util.format('%s is playing "%s" by %s. Votes: %d⇑ %d⇓. ', currentSong.djName, currentSong.songTitle, currentSong.artist, currentSong.votes.up, currentSong.votes.down);
                botSpeak(where, string, commandObj.pmID);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'lame':
            if (spkr.isMod || spkr.isOwner) {
                bot.vote('down');
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'dj':
            if (spkr.isMod || spkr.isOwner) {
                bot.addDj();
                ttRoom.botOnDeck = true;
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'djhelp':
            if (spkr.isMod || spkr.isOwner) {
                if (Object.keys(ttRoom.djList).length < 2) {
                    bot.modifyLaptop('chrome');
                    ttRoom.djHelper = true;
                    bot.addDj();
                    ttRoom.botOnDeck = true;
                }
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'hold':
            if (spkr.isMod || spkr.isOwner) {
                bot.addDj();
                config.holdMode = true;
                ttRoom.botOnDeck = true;
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'down':
            if (spkr.isMod || spkr.isOwner) {
                bot.remDj();
                config.holdMode = false;
                ttRoom.botOnDeck = false;
                ttRoom.djHelper = false;
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'skip':
            if (spkr.isMod || spkr.isOwner) {
                bot.stopSong();
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'autobop':
            if (spkr.isMod || spkr.isOwner) {
                config.autobop = param;
                botSpeak('console', 'autobop set to: ' + config.autobop + " by: " + commandObj.data.name);
                WriteToLog(config.botlog, 'autobop set to: ' + config.autobop + " by: " + commandObj.data.name);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'autobot':
            if (spkr.isMod || spkr.isOwner) {
                config.autobot = param;
                botSpeak('console', 'autobot set to: ' + config.autobot + " by: " + commandObj.data.name);
                WriteToLog(config.botlog, 'autobot set to: ' + config.autobot + " by: " + commandObj.data.name);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'autodj':
            if (spkr.isMod || spkr.isOwner) {
                config.autoDj = param;
                botSpeak('console', 'autodj set to: ' + config.autodj + " by: " + commandObj.data.name);
                WriteToLog(config.botlog, 'autodj set to: ' + config.autodj + " by: " + commandObj.data.name);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'avatar':
            if (spkr.isMod || spkr.isOwner) {
                bot.setAvatar(param);
            } else {
                botSpeak(where, "I'm sorry that is a Mod command.", commandObj.pmID);
            }
            break;
        case 'forum':
            if (spkr.isMod || spkr.isOwner) {
                botSpeak('pm', "http://danielmalgran.com/mixmash/", commandObj.pmID);
            }
            break;

        //OWNER ONLY COMMANDS                                                 
        case 'watch':
            if (spkr.isOwner) {
                config.watchMode = param;
                botSpeak(where, 'autobop set to: ' + config.autobop + " by: " + commandObj.data.name, commandObj.pmID);
            } else {
                botSpeak('chat', "I'm sorry that is an owner command.", commandObj.pmID);
            }
            break;
        case 'dancemode':
            if (spkr.isOwner) {
                config.danceMode = param;
                botSpeak(where, 'danceMode set to: ' + config.danceMode + " by: " + commandObj.data.name, commandObj.pmID);
            }
            break;
        case 'vote':
            if (spkr.isOwner) bot.vote(param);
            break;
        case 'snatch':
            if (spkr.isOwner) {
                bot.snag();
                bot.playlistAdd(currentSong.songId);
                botSpeak(where, "mmm have some of mine.", commandObj.pmID);
            }
            break;
        case 'follow':
            if (spkr.isOwner) config.followMe = param;
            break;
        case 'speak':
            var say = commandObj.paramOrig || commandObj.param;
            if (spkr.isOwner) bot.speak(say);
            break;
        case 'command':
            // backdoor to run any other ttapi commands that aren't built in to the bot
            if (spkr.isOwner) eval(param);
            break;
    }
};

// ============= EVENT FUNCTIONS ==================

var onReady = function (data) {
    bot.roomRegister(config.roomid);
    WriteToLog(config.botlog, '********bot started.********');
    botSpeak('console', "bot started at: " + startTime);
};

var onDeregistered = function (data) {
    var user = data.user[0];
    if (user.userid == config.botOwner && config.followMe) {
        setTimeout(function () {
            findOwner();
        }, 5000);
    }

    //remove user from userList
    if (user.userid != config.userid && user.userid != config.battlebot)
        delete ttRoom.userList[user.userid];
};


//registered
var onRegistered = function (data) {
    var user = data.user[0];
    for (var i = 0; i < config.blackList.length; i++) {
        if (user.userid == config.blackList[i]) {
            bot.bootUser(user.userid, 'You have been blacklisted.');
            WriteToLog(config.botlog, "BLACKLIST BOOT: " + user.name + " : " + user.userid);
            break;
        }
        bot.becomeFan(user.userid);
    }


    botSpeak('console', "registered: " + user.name + " : " + user.userid);
    WriteToLog(config.userlog, "registered: " + user.name + " : " + user.userid);

    //add user to userList
    if (user.userid != config.userid && user.userid != config.battlebot) {
        user.lastActivity = new Date();
        ttRoom.userList[user.userid] = user;
    }
};

var onRoomChanged = function (data) {
    for (var i = 0; i < data.users.length; i++) {
        if (data.users[i].userid == config.botOwner) {
            break;
        }
    }
    addCurrentSongToHistory(data);

    ttRoom.roomMods = data.room.metadata.moderator_id;

    // add all users to userList
    ttRoom.userList = {};
    var users = data.users;
    for (var i = 0; i < users.length; i++) {
        var user = users[i];
        if (user.userid != config.userid && user.userid != config.battlebot) {
            user.lastActivity = new Date();
            ttRoom.userList[user.userid] = user;
        }
    }
};

var onBootedUser = function (data) {
    var reason = data.reason;
    WriteToLog(config.botlog, "booted: " + user.name + " : " + user.userid + " because: " + reason);
};

var onSpeak = function (data) {
        WriteToLog(config.chatlog, data.userid + ", " + data.name + ": " + data.text);

    if (config.watchMode) {
        var text = data.text;
        bot.getProfile(data.userid, function (data) {
            botSpeak('pm', data.name + ': ' + text, config.botOwner);
        });
    }

    var isOwner = (data.userid === config.botOwner);
    var isSelf = (data.userid === config.userid);
    var isModerator = ttRoom.roomMods.indexOf(data.userid) > -1 ? true : false;
    var isDj = ttRoom.djList[data.userid] ? true : false;

    //var result = data.text.match(/^bot (.*?)( .*)?$/) || data.text.match(/^bot(.*?)( .*)?$/) || data.text.match(/^sorry (.*?)( .*)?$/) || data.text.match(/^sam (.*?)( .*)?$/);

    var greetings = config.botGreetings;
    var result;
    if (isOwner || isModerator) {
        greetings = greetings.concat(config.botGreetingsGeneric);
    }

    for (var i = 0, len = greetings.length; i < len; i++) {
        var pattern = new RegExp('(^' + greetings[i] + ')(.*?)( .*)?$');
        result = data.text.match(pattern);
        textLower = data.text.toLowerCase();
        resultLower = textLower.match(pattern);
        if (result) break;
    }

    if (result) {
        var greeting = result[1].trim().toLowerCase();
        var command = result[2].trim().toLowerCase();
        var param = '';
        var paramOrig = '';
        if (result.length == 4 && result[3]) {
            param = result[3].trim().toLowerCase();
            paramOrig = result[2].trim();
        }

        var who = {
            isOwner: isOwner,
            isSelf: isSelf,
            isMod: isModerator,
            isDj: isDj
        };

        var commandObj = {
            'command': command,
            'param': param,
            'paramOrig': paramOrig,
            'who': who,
            'data': data,
            'where': 'chat'
        };
        doCommand(commandObj);
    }
};

var onPM = function (data) {
    var isOwner = (data.senderid === config.botOwner);
    var isSelf = (data.senderid === config.userid);
    var isModerator = ttRoom.roomMods.indexOf(data.senderid) > -1 ? true : false;
    var isDj = ttRoom.djList[data.senderid] ? true : false;

    var pattern = new RegExp('(.*?)( .*)?$');
    var result = data.text.match(pattern);

    if (result) {
        var command = result[1].trim().toLowerCase();
        var param = '';
        var paramOrig = '';
        if (result.length == 3 && result[2]) {
            param = result[2].trim().toLowerCase();
            paramOrig = result[2].trim();
        }

        var who = {
            isOwner: isOwner,
            isSelf: isSelf,
            isMod: isModerator,
            isDj: isDj
        };

        var commandObj = {
            'command': command,
            'param': param,
            'paramOrig': paramOrig,
            'who': who,
            'data': data,
            'where': 'pm',
            'pmID': data.senderid
        };

        doCommand(commandObj);
        //doCommand(command, param, who, data);
    }
};

// Add everyone in the users list.
var onRoomChangedAfkTimer = function (data) {
    var djs = data.room.metadata.djs;
    ttRoom.djList = {};
    var len = djs.length;
    for (var i = 0; i < len; i++) {
        bot.getProfile(djs[i], function (data) {
            var user = {};
            user.userid = data.userid;
            user.name = data.name;
            user.lastActivity = new Date();
            user.startedSpinning = new Date();
            ttRoom.djList[user.userid] = user;
        });
    }
};

// Someone stopped dj'ing, remove them from the dj list
// add them to the recent DJs list
var onRemDj = function (data) {
    // add the user who is stepping down to the recent DJ list
    ttRoom.recentDjs[data.user[0].userid] = ttRoom.djList[data.user[0].userid];
    ttRoom.recentDjs[data.user[0].userid].steppedDown = new Date();
    delete ttRoom.djList[data.user[0].userid];

    // also, if the bot is in autodj mode
    if (config.autoDj) {
        // check how many users on deck
        var djCount = Object.keys(ttRoom.djList).length;
        if (djCount === 1) {
            selfCommand("speak", "Hi! I'm just here to help. I'll step down when someone else gets on deck.");
            selfCommand('djhelp');
        }
    }
};

// Someone starts dj'ing, add them.
var onAddDj = function (data) {
    var user = data.user[0];
    // first check if they are a recent DJ
    var userid = user.userid;
    if (ttRoom.recentDjs[userid] !== undefined) {
        // check when they stepped down
        var now = new Date();
        var offDeckTime = now - ttRoom.recentDjs[userid].steppedDown;
        // if the different is over 10 minutes, they aren't 'recent' anymore
        // just readd the user
        if (offDeckTime > 5000) {
            addUserToDJList(user);
        } else {
            // else add the user from the recent list and delete from recent DJs
            ttRoom.djList[user.userid] = ttRoom.recentDjs[userid];
            delete ttRoom.recentDjs[userid];
        }
    } else {
        addUserToDJList(user);
    }

    // also, if the bot is on deck in djHelper mode
    if (ttRoom.djHelper) {
        // check how many users on deck
        var djCount = Object.keys(ttRoom.djList).length;
        // and either introduce yourself, or step down.
        if (djCount === 2) {
            //            selfCommand("speak", "Hi! I'm just here to help. I'll step down when someone else gets on deck.");
        } else if (djCount > 2) {
            //            selfCommand("speak", "Looks like you've got enough people to keep the tunes flowing. Have fun!");
            selfCommand('down');
        }
    }
};

// Someone vote, update his timestamp.
var onUpdateVotesTimestamp = function (data) {
    var votelog = data.room.metadata.votelog;
    for (var i = 0; i < votelog.length; i++) {
        var userid = votelog[i][0];
        if (ttRoom.djList[userid] !== undefined) {
            ttRoom.djList[userid].lastActivity = new Date();
        }
        if (ttRoom.userList[userid] !== undefined) {
            ttRoom.userList[userid].lastActivity = new Date();
        }
    }
};

// on some actions, update the DJ lastActivity
var updateDjTimestamp = function (data) {
    var userid = data.userid;
    if (ttRoom.djList[userid] !== undefined) {
        ttRoom.djList[data.userid].lastActivity = new Date();
    }
    var userObj = ttRoom.userList[userid];
};

var updateUserTimestamp = function (data) {
    var userid = data.userid;
    var name = data.name;
    if ((ttRoom.userList[userid] !== undefined) && (data.userid != config.userid)) {
        ttRoom.userList[userid].lastActivity = new Date();
    }
};

//newsong
var onNewSong = function (data) {
    var songId = data.room.metadata.current_song._id;
    var genre = data.room.metadata.current_song.metadata.genre;
    var songTitle = data.room.metadata.current_song.metadata.song;
    var artist = data.room.metadata.current_song.metadata.artist;
    var djId = data.room.metadata.current_song.djid;
    var djName = data.room.metadata.current_song.djname;

    //    botSpeak('console', data.room.metadata.current_song.metadata);
    //    WriteToLog(config.playlog, artist + ": " + songTitle + ": " + songId + ": " + genre + ": " + djName);

    var NewSongLimitMin = config.songLimit; //minutes
    NewSongLimit = NewSongLimitMin * 60; //convert to seconds 
    var NewSongLen = (data.room.metadata.current_song.metadata.length);

    if (config.songTimer && (NewSongLen > NewSongLimit) && (djId != config.userid)) {
        var min = (((data.room.metadata.current_song.metadata.length - NewSongLimit) / 60) - ((((data.room.metadata.current_song.metadata.length - NewSongLimit) / 60) % 1)));
        var sec = Math.round(((((((data.room.metadata.current_song.metadata.length - NewSongLimit) / 60) % 1) * 60) * 100) / 100), 2);
        if (sec < 10) sec = '0' + sec.toString();
        botSpeak('chat', '@' + data.room.metadata.current_song.djname + ' Track length greater than ' + NewSongLimitMin + ' minutes, please skip with ' + min + ':' + sec + ' remaining.');
    };

    var min = 5000;
    var max = 30000;
    var rand = Math.floor(Math.random() * (max - min + 1)) + min;

    if (config.autobop) {
        setTimeout(function () {
            bot.vote('up');
        }, rand);
    }

    if (config.autobot) {
        setTimeout(function () {
            bot.speak('bot dance');
        }, rand);
    }

    // if the bot is the one playing the song, check and see if "holdMode" is set
    // if true, skip the song. 
    if ((data.room.metadata.current_dj === config.userid) && config.holdMode) {
        selfCommand('skip');
    }

    addCurrentSongToHistory(data);

    ttRoom.danceUsers = [];
    ttRoom.danceCounter = 0;

};

function WriteToLog(log, text) {
    var now = dateFormat(new Date(), "%Y-%m-%d %H:%M:%S", false);
    fs.createWriteStream(log, {
        flags: "a",
        encoding: "encoding",
        mode: 0666
    }).write(now + " " + text + '\r\n');
}

function dateFormat(date, fstr, utc) {
    utc = utc ? 'getUTC' : 'get';
    return fstr.replace(/%[YmdHMS]/g, function (m) {
        switch (m) {
            case '%Y': return date[utc + 'FullYear'](); // no leading zeros required
            case '%m': m = 1 + date[utc + 'Month'](); break;
            case '%d': m = date[utc + 'Date'](); break;
            case '%H': m = date[utc + 'Hours'](); break;
            case '%M': m = date[utc + 'Minutes'](); break;
            case '%S': m = date[utc + 'Seconds'](); break;
            default: return m.slice(1); // unknown code, remove %
        }
        // add leading zero if required
        return ('0' + m).slice(-2);
    });
}

var onUpdateVotes = function (data) {
    currentSong.votes['up'] = data.room.metadata.upvotes;
    currentSong.votes['down'] = data.room.metadata.downvotes;
};

var updateHeartCount = function (data) {
    currentSong.hearts = currentSong.hearts + 1;
};

var onNoSong = function (data) {
    if (config.autoDj) {
        selfCommand('djhelp');
        selfCommand('speak', 'I will jump down when two other people are on deck');
    }
};

// ============= EXPORTED BOT ==================

var baseBot = {

    currVotes: { 'up': 0, 'down': 0 },

    init: function (botObj) {
        bot = botObj.bot;
        config = botObj.config;

        bot.on('ready', function (data) {
            onReady(data);
        });

        bot.on('registered', function (data) {
            onRegistered(data);
        });

        bot.on('deregistered', function (data) {
            onDeregistered(data);
        });

        bot.on('roomChanged', function (data) {
            onRoomChanged(data);
            onRoomChangedAfkTimer(data);
        });

        bot.on('booted_user', function (data) {
            onBootedUser(data);
        });

        bot.on('speak', function (data) {
            onSpeak(data);
            updateDjTimestamp(data);
            updateUserTimestamp(data);
        });

        bot.on('pmmed', function (data) {
            onPM(data);
        });

        bot.on('rem_dj', function (data) {
            onRemDj(data);
        });

        bot.on('add_dj', function (data) {
            onAddDj(data);
        });

        bot.on('update_votes', function (data) {
            onUpdateVotesTimestamp(data);
            onUpdateVotes(data);
        });

        bot.on('snagged', function (data) {
            updateHeartCount(data);
        });

        bot.on('newsong', function (data) {
            onNewSong(data);
        });

        bot.on('nosong', function (data) {
            onNoSong(data);
        });

    },

    commands: doCommand


};


module.exports = baseBot;

