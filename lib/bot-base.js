/*global config:true */

var extend  = require('./node.extend');
var util    = require('util');

var debug = false;
var disconnected = false;

if (!debug) {
	/* to hopefully keep bot from crashing */
	process.on('uncaughtException', function (err) {
		console.log('Caught exception: ' + err);
		// TODO: catch if socket was closed and reboot bot...
		/*
		if (err === "Error: This socket is closed.") {
			onReady();
		}
		*/
	}); 
}


var bot = null;
var config = null;
var ttRoom = {
	roomMods	: null,
	history		: [],
	djList		: {},
	recentDjs	: {},
	danceUsers	: [],
	danceCounter: 0,  // how many ppl have told the bot to dance this song
	botOnDeck	: false,  // true when the bot is on deck
	djHelper 	: false  // set true when bot is dj'ing in 'help' mode
};


var botState = {
	queue	: [],
}



var Song = function() {
	this.songTitle = '';
	this.artist = '';
	this.djId = '';
	this.djName = '';
	this.votes = { 'up': 0, 'down': 0 };
	this.hearts = 0;
};
	
var currentSong = new Song();


var addCurrentSongToHistory = function(data) {
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

var isRoomMod = function(userid) {
	if (ttRoom.roomMods) {
		return ttRoom.roomMods.indexOf(userid) > -1 ? true : false;
	} else {
		return false;
	}
};

var findOwner = function() {
	bot.stalk(config.botOwner, function (data) {
		bot.roomRegister(data.roomId);
	});
};

var homeRoom = function() {
	bot.roomRegister(config.roomid);
};


var timeFormat = function(num) {
	return (num < 10) ? "0" + num : num;
};

var getIdleTimes = function() {
	var str = '';
	var now = new Date();
	for (var dj in ttRoom.djList) {
		var djObj = ttRoom.djList[dj];
		var lastActivity = djObj.lastActivity;
		var diffMS = now - lastActivity;
		var diff = new Date(diffMS);
		var idleTime;
		
		if ( diff.getUTCHours() > 0 ) {
			idleTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
		} else {
			idleTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
		}
		
		str = str + djObj.name + ': ' + idleTime + '; ';
		
	}
	return str;
};

var getAfkTimes = function(time) {
	var str = '';
	var now = new Date();
	for (var dj in ttRoom.djList) {
		var djObj = ttRoom.djList[dj];
		var lastActivity = djObj.lastActivity;
		var diffMS = now - lastActivity;
		var diff = new Date(diffMS);
		var idleTime;
		
		if ( diffMS >= (time*60000) ) {
		
			if ( diff.getUTCHours() > 0 ) {
				idleTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
			} else {
				idleTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
			}
			
			str = str + util.format('@%s: %s;',djObj.name, idleTime);
		}
	}
	if (str === '') {
		str = util.format('No DJs currently over %s minutes idle', time);
	}
	return str;
};


var getDjTimes = function() {
	var str = '';
	var now = new Date();
	for (var dj in ttRoom.djList) {
		var djObj = ttRoom.djList[dj];
		var startedSpinning = djObj.startedSpinning;
		var diffMS = now - startedSpinning;
		var diff = new Date(diffMS);
		var spinningTime;
		
		if ( diff.getUTCHours() > 0 ) {
			spinningTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
		} else {
			spinningTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
		}
		
		str = str + djObj.name + ': ' + spinningTime + '; ';
		
	}
	return str;
};

var getLastSongs = function(param) {
	var string = '';
	if (param > 3) {
		param = 3;
		botSpeak(where, "I don't keep a history that far back. Here's what I know. ", commandObj.pmID);
	}
	var len = param || 1;
	
	for (var i = 0; i < len; i++) {
		if (ttRoom.history[i] === undefined) {
			string = string + 'I don\'t have history for the ' + getGetOrdinal(i+1) + ' song, sorry. ';
			continue;
		}
		string = string + util.format('♫ %s played "%s" by %s. Votes: %d⇑ %d⇓. ♥s: %d. ', ttRoom.history[i].djName, ttRoom.history[i].songTitle, ttRoom.history[i].artist, ttRoom.history[i].votes.up, ttRoom.history[i].votes.down, ttRoom.history[i].hearts);
	}
	return string;

};


var getGetOrdinal = function(n) {
   var s=["th","st","nd","rd"],
       v=n%100;
   return n+(s[(v-20)%10]||s[v]||s[0]);
};


var addUserToDJList = function(user) {
	// if there is 5 or more ppl on djlist, something went wrong
	// let's remove the first one
	if ( Object.keys(ttRoom.djList).length >= 5 ) {
		delete ttRoom.djList[Object.keys(ttRoom.djList)[0]];
	}

	user.lastActivity = new Date();
	user.startedSpinning = new Date();
	ttRoom.djList[user.userid] = user;

};

// where to speak, what to speak, who to speak to (pm only)
var botSpeak = function(where, what, who) {
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


var selfCommand = function(command, param) {
	var who = {
		isOwner : true,
		isMod : true,
		isDj : null
	};
	
	var commandObj = {
		'command' 	: command,
		'param'		: param,
		'who'		: who
	};
	
	doCommand(commandObj);
	
};


//var doCommand = function(command, param, who, data) {
var doCommand = function(commandObj) {
	console.log(commandObj);
	// who's talking to us? 
	var who = commandObj.who;
	var spkr = {
		isOwner : false,
		isSelf : false,
		isMod : false,
		isDj : false
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

	switch(commandObj.command){
		// ANYONE COMMANDS
		case 'help':
			botSpeak(where, "help avail here: https://bit.ly/SamIAmHelp", commandObj.pmID);
			break;
		case 'dance':
			if (config.danceMode) {
				if (ttRoom.danceUsers.indexOf(commandObj.data.userid) === -1) {
					ttRoom.danceUsers.push(commandObj.data.userid);
					ttRoom.danceCounter++;
				}
				if (ttRoom.danceCounter >= config.danceVotesReq) bot.vote('up');
			}
			break;
		case 'last':
			botSpeak(where, getLastSongs(param), commandObj.pmID);
			break;
		case 'roominfo':
			bot.roomInfo(false, function(data) {
				if (data.room.description) {
					botSpeak('chat', data.room.description);
				} else {
					botSpeak('chat', "There doesn't seem to be any info about this room!");
				}
			});
			break;
			 
		case 'fliptable': 
			botSpeak('chat', '(ノಠ益ಠ)ノ彡┻━┻');
			break;
		case 'fixtable': 
			botSpeak('chat', '┬─┬ノ( º _ ºノ)');
			break;
		case 'q':
			//console.log('q', botState.queue);
			if (botState.queue.length > 0) {
				var str = '';
				for (var i=0; i < botState.queue.length; i++) {
					if (i > 0) str = str + ', ';
					str = str + botState.queue[i];
					// console.log('current string', str);
					// console.log('currnet index', botState.queue.indexOf(botState.queue[i]));
					
				}
				
				botSpeak(where, str);
			} else {
				// queue was empty
				// console.log('queue was empty');
				botSpeak(where, "Queue seems to be empty");
			}
			break;
		case 'q+':
			queueAddUser(commandObj.data.userid, commandObj.data.name);
			break;
		case 'q-':
			var param = {
				'userid': commandObj.data.userid,
				'username': commandObj.data.name,
				'announce': true
			}
			queueRemoveUser(param);
			break;
			
		// DJ COMMANDS
		case 'afk':
			var time = parseInt(param);
			time = ( (typeof(time) === "number") && (time > 0) ) ? time : 15;
			if (spkr.isDj || spkr.isMod || spkr.isOwner) botSpeak(where, getAfkTimes(time), commandObj.pmID);
			break;
		case 'idle':
			if (spkr.isDj || spkr.isMod || spkr.isOwner) botSpeak(where, getIdleTimes(), commandObj.pmID);
			break;
		case 'timers':
			if (spkr.isDj || spkr.isMod || spkr.isOwner) botSpeak(where, getDjTimes(), commandObj.pmID);
			break;
		case 'current':
			if (spkr.isDj || spkr.isMod || spkr.isOwner) {
				var string = util.format('%s is playing "%s" by %s. Votes: %d⇑ %d⇓. ', currentSong.djName, currentSong.songTitle, currentSong.artist, currentSong.votes.up, currentSong.votes.down);
				botSpeak(where, string, commandObj.pmID);
			}
			break;
		
			
		// OWNER OR MODERATOR COMMANDS
		case 'hi':
			if (spkr.isMod || spkr.isOwner) botSpeak(where, "hi", commandObj.pmID);;
			break;
		case 'lame':
			if (spkr.isMod || spkr.isOwner) bot.vote('down');
			break;
		case 'dj':
			if (spkr.isMod || spkr.isOwner) {
				bot.addDj();
				ttRoom.botOnDeck = true;
			}
			break;
		case 'djhelp':
			if (spkr.isMod || spkr.isOwner) {
				if (Object.keys(ttRoom.djList).length < 2) {
					ttRoom.djHelper = true;
					bot.addDj();
					ttRoom.botOnDeck = true;
				}
			}
			break;
		case 'hold':
			if (spkr.isMod || spkr.isOwner) {
				bot.addDj();
				config.holdMode = true;
				ttRoom.botOnDeck = true;
			}
			break;
		case 'down':
			if (spkr.isMod || spkr.isOwner) {
				bot.remDj();
				config.holdMode = false;
				ttRoom.botOnDeck = false;
				ttRoom.djHelper = false;
			}
			break;
		case 'skip':
			if (spkr.isMod || spkr.isOwner) bot.stopSong();
			break;
		case 'goodnight':
		case 'goodbye':
			if (spkr.isMod || spkr.isOwner) bot.roomDeregister();
			break;
		case 'autobop':
			if (spkr.isMod || spkr.isOwner) config.autobop = param;
			break;
		case 'autobot':
			if (spkr.isMod || spkr.isOwner) config.autobot = param;
			break;
		case 'autodj':
			if (spkr.isMod || spkr.isOwner) config.autoDj = param;
			break;
		case 'q:clear':
			if (spkr.isMod || spkr.isOwner) queueClear();
			break;
		case 'q:removefirst':
			if (spkr.isMod || spkr.isOwner) queueRemoveFirst();
			break;
		case 'q:removelast': 
		if (spkr.isMod || spkr.isOwner) queueRemoveLast();
			break;
		
		// OWNER ONLY COMMANDS
		
		case 'avatar':
			if (spkr.isOwner) bot.setAvatar(param);
			break;
		case 'watch':
			if (spkr.isOwner) config.watchMode = param;
			break;
		case 'dancemode':
			if (spkr.isOwner) config.danceMode = param;
			break;
		case 'vote':
			if (spkr.isOwner) bot.vote(param);
			break;
		case 'snag':
			if (spkr.isOwner) {
				bot.snag();
				bot.playlistAdd(currentSong.songId); 
			}
			break;
		case 'follow':
			if (spkr.isOwner) config.followMe = param;
			break;
		case 'speak':
			var say = commandObj.paramOrig || commandObj.param;
			if (spkr.isOwner) bot.speak(say);
			break;
		case 'gohome': 
			if (spkr.isOwner) homeRoom();
			break;
		case 'findme':
			console.log(spkr.isOwner);
			if (spkr.isOwner) findOwner();
			break;
		case 'command':
			// backdoor to run any other ttapi commands that aren't built in to the bot
			if (spkr.isOwner) eval(param);
			break;
	}
};


var connect = function(roomid) {
	// Reset the disconnected flag
	disconnected = false;

	// Attempt to join the room
	bot.roomRegister(roomid, function (data) {
	if (data && data.success) {
		console.log('Joined ' + data.room.name);
	} else {
		console.log('Failed to join room');
		if (!disconnected) {
		// Set the disconnected flag
		disconnected = true;
		// Try again in 60 seconds
		setTimeout(connect, 60 * 1000, roomid);
		}
	}
	});
}

// ============= EVENT FUNCTIONS ==================


var onReady = function(data) {
	if (config.followMe) {
		bot.stalk(config.botOwner, function (data) {
			if (data.success == true) {
				bot.roomRegister(data.roomId);
			} else {
				bot.roomRegister(config.roomid);
			}
	   });
	} else {
		connect(config.roomid);
	}
};

var onDeregistered = function (data) {
	if (data.user[0].userid == config.botOwner && config.followMe) {
		setTimeout(function () {
			findOwner();
		}, 5000);
	}

	// TODO: if someone was on the queue, let's start a timer and remove them after 5 min if they aren't back in the room
	
	/*
	var qRemovalTimer = setTimeout(() => {
		var param = {
			'userid': data.user[0].userid,
			'username': data.user[0].name
		}
		queueRemoveUser(param);
	}, 1000);
	*/
	// eventually want this at 5 min? 300000
};

var onRegistered = function (data) {
	var string = "Welcome to the room. Current DJ idle times: " + getIdleTimes();
	var isMod = isRoomMod(data.user[0].userid);
	if (isMod || data.user[0].userid == config.botOwner) {
		botSpeak('pm', string, data.user[0].userid);
	}
};

var onRoomChanged = function (data) {
	for (var i=0; i < data.users.length; i++) {
		if (data.users[i].userid == config.botOwner) {
			break;
		}
	}
	addCurrentSongToHistory(data);
	
	ttRoom.roomMods = data.room.metadata.moderator_id;
};

var onBootedUser = function (data) {
	var reason = data.reason;
	if (data.userid === config.userid) {
		bot.getProfile(data.modid, function(data) {
			console.log('I was booted by ' + data.name + ' because: ' + reason);
		});
	}
};


var onSpeak = function(data) {

	if (config.watchMode) {
		var text = data.text;
		bot.getProfile(data.userid, function(data) {
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
		greetings = greetings.concat(config.botGreetingsMod);
	}
	
	for (var i=0, len=greetings.length; i<len; i++) {
		var pattern = new RegExp('(^' + greetings[i] + ')(.*?)( .*)?$');
		dataTextLower = data.text.toLowerCase();
		result = dataTextLower.match(pattern);
		/* why did I have this instead of matching lower all the time?
		textLower = data.text.toLowerCase();
		resultLower = textLower.match(pattern);
		*/
		if (result) break;
	}
	
	if(result) {
		var greeting = result[1].trim().toLowerCase();
		var command = result[2].trim().toLowerCase();
		var param = '';
		var paramOrig = '';
		if (result.length == 4 && result[3]){
			param = result[3].trim().toLowerCase();
			paramOrig = result[2].trim();
		}
		
		var who = {
			isOwner : isOwner,
			isSelf : isSelf,
			isMod : isModerator,
			isDj : isDj
		};

		var commandObj = {
			'command' 	: command,
			'param'		: param,
			'paramOrig'	: paramOrig,
			'who'		: who,
			'data'		: data,
			'where'		: 'chat'
		};
		doCommand(commandObj);
	}
};

var onPM = function(data){	
	var isOwner = (data.senderid === config.botOwner);
	var isSelf = (data.senderid === config.userid);
	var isModerator = ttRoom.roomMods.indexOf(data.senderid) > -1 ? true : false;
	var isDj = ttRoom.djList[data.senderid] ? true : false;
		
	var pattern = new RegExp('(.*?)( .*)?$');
	var result = data.text.match(pattern);
	
	if(result){
		var command = result[1].trim().toLowerCase();
		var param = '';
		var paramOrig = '';
		if (result.length == 3 && result[2]){
			param = result[2].trim().toLowerCase();
			paramOrig = result[2].trim();
		}
		
		var who = {
			isOwner : isOwner,
			isSelf : isSelf,
			isMod : isModerator,
			isDj : isDj
		};
		
		var commandObj = {
			'command' 	: command,
			'param'		: param,
			'paramOrig'	: paramOrig,
			'who'		: who,
			'data'		: data,
			'where'		: 'pm',
			'pmID'		: data.senderid
		};
		
		doCommand(commandObj);
	}
};

// Add everyone in the users list.
var onRoomChangedAfkTimer = function (data) {
	var djs = data.room.metadata.djs;
	ttRoom.djList = { };
	var len = djs.length;
	for (var i=0; i<len; i++) {  
		bot.getProfile(djs[i], function(data) {
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
		if ( djCount === 1 ) {
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
		if (offDeckTime > 600000) {
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
		if ( djCount === 2 ) {
			selfCommand("speak", "Hi! I'm just here to help. I'll step down when someone else gets on deck.");
		} else if ( djCount > 2 ) {
			selfCommand("speak", "Looks like you've got enough people to keep the tunes flowing. Have fun!");
			selfCommand('down');
		}
	}

	// TODO: if they were on the queue, remove them
	// Probably want a timer here, or wait until after first song plays?
	
	var param = {
		'userid': user.userid,
		'username': user.name
	}
	// queueRemoveUser(param);
};


// Someone wants to be on the queue
var queueAddUser = function(userid, username) {
	// note: username isn't coming when the command is PMed

	// check if user is already on the queue
	if (botState.queue.indexOf(username) > -1) {
		// user is in queue
		botSpeak("chat", "You seem to already be in the queue");
	} else if (ttRoom.djList[userid] !== undefined) {
		// see if user is a current DJ? 
		botSpeak("chat", "You seem to already be on deck");
	} else {
		// add user to queue
		botState.queue.push(username);
		botSpeak("chat", username + " has been added to the queue.");
	}

	console.log(botState.queue);
	
};


// Remove a user from the queue
var queueRemoveUser = function(param) {
	
	var paramDefault = {
		'userid': null,
		'username': null,
		'announce': false
	}
	var param = {...paramDefault, ...param};

	// console.log('removeUserFromQueue', param.userid, param.username);


	// check if user is in queue
	if (botState.queue.indexOf(param.username) > -1) {
		console.log('found user in queue');
		var pos = botState.queue.indexOf(param.username);
		console.log('position in array', pos);
		botState.queue.splice(pos,1);
		
		botSpeak("chat", param.username + " has been removed from the queue.");
	} else {
		if (param.announce) {
			botSpeak("chat", param.username + " didn't seem to be in the queue.");
		}
	}
	
};


// Someone wants to be on the queue
var queueClear = function(userid, username) {
	botState.queue = [];	
};

var queueRemoveFirst = function() {
	botState.queue.splice(0,1);
};

var queueRemoveLast = function() {
	var len = botState.queue.length;
	botState.queue.splice(len-1,1);
};


// Someone vote, update his timestamp.
var onUpdateVotesUpdateDjTimestamp = function (data) {
	var votelog = data.room.metadata.votelog;
	for (var i=0; i<votelog.length; i++) {
		var userid = votelog[i][0];
		if (ttRoom.djList[userid] !== undefined) {
			ttRoom.djList[userid].lastActivity = new Date();
		}
	}
};

// on some actions, update the DJ lastActivity
var updateDjTimestamp = function (data) {
	var userid = data.userid;
	if (ttRoom.djList[userid] !== undefined) {
		ttRoom.djList[data.userid].lastActivity = new Date();
	}
};

var onNewSong = function(data){
	//if (config.debug) console.log('new song ===================================================');
	
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
	if ( (data.room.metadata.current_dj === config.userid) && config.holdMode ) {
		selfCommand('skip');
	}
	
	addCurrentSongToHistory(data);
	
	ttRoom.danceUsers = [];
	ttRoom.danceCounter = 0;
};

var onUpdateVotes = function(data){
	currentSong.votes['up'] = data.room.metadata.upvotes;
	currentSong.votes['down'] = data.room.metadata.downvotes;
};

var updateHeartCount = function(data) {
	currentSong.hearts = currentSong.hearts + 1;
};

var onNoSong = function(data) {
	if (config.autoDj) {
		selfCommand('djhelp');
		selfCommand('speak', 'I will jump down when two other people are on deck');
	}
};


// ============= EXPORTED BOT ==================

var baseBot = {


	currVotes : { 'up': 0, 'down': 0 },

		
	init : function(botObj) {
		bot = botObj.bot;
		config = botObj.config;

		bot.on('ready', function (data) {
			onReady(data);
			console.log('bot ready');
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

		bot.on('speak', function(data){
			onSpeak(data);
			updateDjTimestamp(data);
		});
		
		bot.on('pmmed', function(data){	
			onPM(data);
		});

		bot.on('rem_dj', function (data) {
			onRemDj(data);
		});

		bot.on('add_dj', function (data) {
			onAddDj(data);
		});

		bot.on('update_votes', function (data) {
			onUpdateVotesUpdateDjTimestamp(data);
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

		
		bot.on('disconnected', function (data) {
			console.log('a recoverable connection error has occured');
			if (!disconnected) {
				// Set the disconnected flag and display message
				disconnected = true;
				console.log("disconnected: " + data);
				// Attempt to reconnect in 10 seconds
				setTimeout(connect, 10 * 1000, config.roomid);
			  }
		});
	
	},

	commands : doCommand


};


module.exports = baseBot;

