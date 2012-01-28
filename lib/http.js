/*global config:true */
var Bot    = require('ttapi');
var fs 		= require('fs');
var path 	= require('path');
//var twss 	= require('twss');

//var bot = new Bot(config.auth, config.userid, config.roomid);
var bot = new Bot(config.auth, config.userid);
bot.listen(config.port, '127.0.0.1');


config.autobop = false;
config.autobot = false;
config.autoDj = false;
config.danceMode = false;
config.followMe = false;
config.debug = false;
config.holdMode = false;

var ttRoom = {
	roomMods	: null,
	history		: [],
	djList		: {},
	recentDjs	: {},
	danceUsers	: [],
	danceCounter: 0,
	botOnDeck	: false
};



var currVotes = { 'up': 0, 'down': 0 };

var Song = function() {
	this.songTitle = '';
	this.artist = '';
	this.djId = '';
	this.djName = '';
	this.votes = { 'up': 0, 'down': 0 };
	this.hearts = 0;
};
	
var currentSong = new Song();	




bot.on('httpRequest', function (request, res) {
	var method = request.method;
	var url    = require('url').parse(request.url).pathname;
	var command = require('url').parse(request.url, true).query.command;
	var param = require('url').parse(request.url, true).query.param;
	
	switch (url) {
		case '/command/': 
			doCommand('sam', command, param, true, true);
			break;
		default:
			var filePath = '.' + request.url;
			if (filePath == './')
				filePath = './public/index.html';
				 
			var extname = path.extname(filePath);
			var contentType = 'text/html';
			switch (extname) {
				case '.js':
					contentType = 'text/javascript';
					break;
				case '.css':
					contentType = 'text/css';
					break;
			}
			 
			path.exists(filePath, function(exists) {
			 
				if (exists) {
					fs.readFile(filePath, function(error, content) {
						if (error) {
							res.writeHead(500);
							res.end();
						}
						else {
							res.writeHead(200, { 'Content-Type': contentType });
							res.end(content, 'utf-8');
						}
					});
				}
				else {
					res.writeHead(404);
					res.end();
				}
			});
			break;
	}
});


var twssResp = 0;

bot.on('speak', function(data){
	// TWSS Functionality - seems like the TWSS module has some bugs for now. 
	/* 
	twss.algo = 'nbc'; //nbc or knn
	twss.threshold = 10000;
	var twssResponses = ["That's what she said!", "Haha that's what she said!"];
	if ( twss.is(data.text) ) {
		console.log(data.text + ' - ' + twssResponses[twssResp]);
		twssResp ^= 1;
	}
	*/
	
	var isOwner = (data.userid === config.botOwner);
	var isModerator = ttRoom.roomMods.indexOf(data.userid) > -1 ? true : false;
	
	//var result = data.text.match(/^bot (.*?)( .*)?$/) || data.text.match(/^bot(.*?)( .*)?$/) || data.text.match(/^sorry (.*?)( .*)?$/) || data.text.match(/^sam (.*?)( .*)?$/);
	
	var greetings = config.botGreetings;
	if (isOwner || isModerator) {
		greetings = greetings.concat(config.botGreetingsGeneric);
	}
	
	for (var i=0, len=greetings.length; i<len; i++) {
		var pattern = new RegExp('(^' + greetings[i] + ')(.*?)( .*)?$');
		var result = data.text.match(pattern);
		if (result) break;
	}
	
	if(result){
		var greeting = result[1].trim().toLowerCase();
		var command = result[2].trim().toLowerCase();
		var param = '';
		if (result.length == 4 && result[3]){
			param = result[3].trim().toLowerCase();
		}

		doCommand(greeting, command, param, isOwner, isModerator, data);
	}
});


var selfCommand = function(command, param) {
	doCommand('sam', command, param, true, true);
};


var doCommand = function(greeting, command, param, isOwner, isModerator, data) {
	switch(command){
		case 'dance':
			if (config.danceMode) {
				if (ttRoom.danceUsers.indexOf(data.userid) === -1) {
					ttRoom.danceUsers.push(data.userid);
					ttRoom.danceCounter++;
				}
				if (ttRoom.danceCounter > 2) bot.vote('up');
			}
			break;
		case 'lame':
			if (isModerator || isOwner) bot.vote('down');
			break;
		case 'vote':
			if (isOwner) bot.vote(param);
			break;
		case 'dancemode':
			if (isOwner) config.danceMode = param;
			break;
		case 'dj':
			if (isModerator || isOwner) {
				bot.addDj();
				ttRoom.botOnDeck = true;
			}
			break;
		case 'hold':
			if (isModerator || isOwner) {
				bot.addDj();
				config.holdMode = true;
				ttRoom.botOnDeck = true;
			}
			break;
		case 'down':
			if (isOwner) {
				bot.remDj();
				config.holdMode = false;
				ttRoom.botOnDeck = false;
			}
			break;
		case 'skip':
			bot.stopSong();
			break;
		case 'snag':
			if (isOwner) bot.snag();
			break;
		case 'goodnight':
			if (isModerator || isOwner) bot.roomDeregister();
			break;
		case 'goodbye':
			if (isModerator || isOwner) bot.roomDeregister();
			break;
		case 'autobop':
			if (isModerator || isOwner) config.autobop = param;
			break;
		case 'autobot':
			if (isModerator || isOwner) config.autobot = param;
			break;
		case 'follow':
			if (isOwner) config.followMe = param;
			break;
		case 'speak':
			if (isOwner) bot.speak(param);
			break;
		case 'homeRoom': 
			homeRoom();
			break;
		case 'findMe':
			findOwner();
			break;
		case 'avatar':
			bot.setAvatar(param);
			break;
		case 'last':
			var string = '';
			if (param > 3) {
				param = 3;
				bot.speak("I don't keep a history that far back. Here's what I know. ");
			}
			var len = param || 1;
			
			for (var i = 0; i < len; i++) {
				if (ttRoom.history[i] === undefined) {
					string = string + 'I don\'t have history for the ' + getGetOrdinal(i+1) + ' song, sorry. ';
					continue;
				}
				string = string + '♫ ' + ttRoom.history[i].djName + ' played "' + ttRoom.history[i].songTitle + '" by ' + ttRoom.history[i].artist + '. Votes: ' + ttRoom.history[i].votes['up'] + '⇑ ' + ttRoom.history[i].votes['down'] + '⇓. ♥s: ' + ttRoom.history[i].hearts + '.  ';
			}
			bot.speak(string);
			break;
		case 'afk':
			if (isModerator || isOwner) printAfkTimes();
			break;
		case 'timers':
			if (isModerator || isOwner) printDjTimes();
			break;
		case 'command':
			// backdoor to run any other ttapi commands that aren't built in to the bot
			if (isOwner) eval(param);
			break;
	}
};



bot.on('ready', function () {
	bot.stalk(config.botOwner, function (data) {
		if (data.success == true) {
			bot.roomRegister(data.roomId);
		} else {
			bot.roomRegister(config.roomid);
		}
   });
});

bot.on('deregistered', function (data) {
	if (data.user[0].userid == config.botOwner && config.followMe) {	
		setTimeout(function () {
			findOwner();
		}, 5000);
	}
});

bot.on('roomChanged', function (data) {
	for (var i=0; i<data.users.length; i++) {
		if (data.users[i].userid == config.botOwner) {
			//console.log(data.users[i]);
			break;
		}
	}
	addCurrentSongToHistory(data);
	
	ttRoom.roomMods = data.room.metadata.moderator_id;
});




// ============= DJ AFK TIMER ==================


// Add everyone in the users list.
bot.on('roomChanged', function (data) {
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
});


// Someone stopped dj'ing, remove them from the dj list
// add them to the recent DJs list
bot.on('rem_dj', function (data) {
	// add the user who is stepping down to the recent DJ list
	ttRoom.recentDjs[data.user[0].userid] = ttRoom.djList[data.user[0].userid];
	ttRoom.recentDjs[data.user[0].userid].steppedDown = new Date();
	delete ttRoom.djList[data.user[0].userid];
});

// Someone starts dj'ing, add them.
bot.on('add_dj', function (data) {
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
	
	// also, if the bot is on deck, check how many users on deck
	// if there are three, bot should step down
	if ( Object.keys(ttRoom.djList).length > 2 ) {
		selfCommand('down');
	}
});

var addUserToDJList = function(user) {
	// if there is 5 or more ppl on djlist, something went wrong
	// let's remove the first one
	if ( Object.keys(ttRoom.djList).length >= 5 ) {
		delete ttRoom.djList[Object.keys(ttRoom.djList)[0]];
	}

	user.lastActivity = new Date();
	user.startedSpinning = new Date();
	ttRoom.djList[user.userid] = user;

}


// Someone talk, update his timestamp.
bot.on('speak', function (data) {
	var userid = data.userid;
	if (ttRoom.djList[data.userid] !== undefined) {
		ttRoom.djList[data.userid].lastActivity = new Date();
	}
});

// Someone vote, update his timestamp.
bot.on('update_votes', function (data) {
	var votelog = data.room.metadata.votelog;
	for (var i=0; i<votelog.length; i++) {
		var userid = votelog[i][0];
		if (ttRoom.djList[userid] !== undefined) {
			ttRoom.djList[userid].lastActivity = new Date();
		}
	}
});

// Someone add the surrent song to his playlist.
bot.on('snagged', function (data) {
	var userid = data.userid;
	if (ttRoom.djList[userid] !== undefined) {
		ttRoom.djList[data.userid].lastActivity = new Date();
	}
});



// ============= end DJ AFK TIMER ==================






bot.on('newsong', function(data){
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
});

bot.on('update_votes', function(data){
	currentSong.votes['up'] = data.room.metadata.upvotes;
	currentSong.votes['down'] = data.room.metadata.downvotes;
});

bot.on('snagged', function(data) {
	currentSong.hearts = currentSong.hearts + 1;
});

bot.on('nosong', function(data) {
	if (config.autoDj) selfCommand('dj');
});


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
	currentSong.songTitle = data.room.metadata.current_song.metadata.song;
	currentSong.artist = data.room.metadata.current_song.metadata.artist;
	currentSong.djId = data.room.metadata.current_song.djid;
	currentSong.djName = data.room.metadata.current_song.djname;
	currentSong.votes.up = data.room.metadata.upvotes;
	currentSong.votes.down = data.room.metadata.downvotes;
	currentSong.hearts = 0;
	
	
};

var findOwner = function() {
	bot.stalk(config.botOwner, function (data) {
		bot.roomRegister(data.roomId);
	});
};

var homeRoom = function() {
	console.log(config.roomid);
	bot.roomRegister(config.roomid);
};


var timeFormat = function(num) {
	return (num < 10) ? "0" + num : num;
};

var printAfkTimes = function() {
	var str = '';
	var now = new Date();
	for (var dj in ttRoom.djList) {
		var djObj = ttRoom.djList[dj];
		var lastActivity = djObj.lastActivity;
		var diffMS = now - lastActivity;
		var diff = new Date(diffMS);
		
		if ( diff.getUTCHours() > 0 ) {
			var idleTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
		} else {
			var idleTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
		}
		
		str = str + djObj.name + ': ' + idleTime + '; ';
		
	}
	bot.speak(str);
};


var printDjTimes = function() {
	var str = '';
	var now = new Date();
	for (var dj in ttRoom.djList) {
		var djObj = ttRoom.djList[dj];
		var startedSpinning = djObj.startedSpinning;
		var diffMS = now - startedSpinning;
		var diff = new Date(diffMS);
		
		if ( diff.getUTCHours() > 0 ) {
			var spinningTime = timeFormat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
		} else {
			var spinningTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
		}
		
		str = str + djObj.name + ': ' + spinningTime + '; ';
		
	}
	bot.speak(str);
};


var getGetOrdinal = function(n) {
   var s=["th","st","nd","rd"],
       v=n%100;
   return n+(s[(v-20)%10]||s[v]||s[0]);
};
