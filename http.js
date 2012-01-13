var Bot    = require('ttapi');
var config = require('./settings-http.js');
var fs 		= require('fs');
var path 	= require('path');

//var bot = new Bot(config.auth, config.userid, config.roomid);
var bot = new Bot(config.auth, config.userid);
bot.listen(1337, '127.0.0.1');

var myScriptVersion = '0.0.0';

config.autobop = false;
config.autobot = false;
config.followMe = false;
config.debug = false;

var roomMods;


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

var history = [];

var djList = { };



bot.on('httpRequest', function (request, res) {
	var method = request.method;
	var url    = require('url').parse(request.url).pathname;
	var command = require('url').parse(request.url, true).query.command;
	var param = require('url').parse(request.url, true).query.param;
	
	switch (url) {
		case '/command/': 
			doCommand(command, param, true, true);
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




bot.on('speak', function(data){

	var isOwner = (data.userid === config.botOwner);
	var isModerator = roomMods.indexOf(data.userid) > -1 ? true : false;
	
	//var result = data.text.match(/^bot (.*?)( .*)?$/) || data.text.match(/^bot(.*?)( .*)?$/) || data.text.match(/^sorry (.*?)( .*)?$/) || data.text.match(/^sam (.*?)( .*)?$/);
	
	var greetings = ['sam ', 'sorry '];
	if (isOwner || isModerator) {
		greetings = greetings.concat(['bot ', 'bot']);
	}
	
	for (var i=0, len=greetings.length; i<len; i++) {
		var pattern = new RegExp('^' + greetings[i] + '(.*?)( .*)?$');
		var result = data.text.match(pattern);
		if (result) break;
	}
	
	
	if(result){
		var command = result[1].trim().toLowerCase();
		//console.log('command: ' + command);
		var param = '';
		if (result.length == 3 && result[2]){
			param = result[2].trim().toLowerCase();
		}

		doCommand(command, param, isOwner, isModerator);
	}
});



var doCommand = function(command, param, isOwner, isModerator) {
	switch(command){
		case 'dance':
			bot.vote('up');
			//bot.speak('I love this song!');
			break;
		case 'lame':
			bot.vote('down');
			break;
		case 'dj':
		case 'hold':
			if (isModerator || isOwner) bot.addDj();
			break;
		case 'down':
			if (isOwner) bot.remDj();
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
			var i = param || 1;
			while (i--) {
				if (history[i] === undefined) {
					string = string + 'I don\'t have history for the ' + getGetOrdinal(i+1) + ' song, sorry. ';
					continue;
				}
				string = string + history[i].djName + ' played "' + history[i].songTitle + '" by ' + history[i].artist + '. The votes: +' + history[i].votes['up'] + ', -' + history[i].votes['down'] + '. The <3s: ' + history[i].hearts + '.  ';
			}
			bot.speak(string);
			break;
		case 'afk':
			if (isModerator || isOwner) printAfkTimes();
			break;
		case 'command':
			// backdoor to run any other ttapi commands that aren't built in to the bot
			if (isOwner) eval(param);
			break;
	}
}



bot.on('ready', function () {
	bot.stalk(config.botOwner, function (data) {
		if (data.success === "true") {
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
	
	roomMods = data.room.metadata.moderator_id;
});




// ============= DJ AFK TIMER ==================


// Add everyone in the users list.
bot.on('roomChanged', function (data) {
	var djs = data.room.metadata.djs;
	djList = { };
	var len = djs.length;
	for (var i=0; i<len; i++) {  
		bot.getProfile(djs[i], function(data) {
			var user = {};
			user.userid = data.userid;
			user.name = data.name;
			user.lastActivity = new Date();
			djList[user.userid] = user;
		});
	}
});


// Someone stopped dj'ing, remove them from the dj list.
bot.on('rem_dj', function (data) {
	delete djList[data.user[0].userid];
});

// Someone starts dj'ing, add them.
bot.on('add_dj', function (data) {
	var user = data.user[0];
	user.lastActivity = new Date();
	djList[user.userid] = user;
});


// Someone talk, update his timestamp.
bot.on('speak', function (data) {
	var userid = data.userid;
	if (djList[data.userid] !== undefined) {
		djList[data.userid].lastActivity = new Date();
	}
});

// Someone vote, update his timestamp.
bot.on('update_votes', function (data) {
	var votelog = data.room.metadata.votelog;
	for (var i=0; i<votelog.length; i++) {
		var userid = votelog[i][0];
		if (djList[userid] !== undefined) {
			djList[userid].lastActivity = new Date();
		}
	}
});

// Someone add the surrent song to his playlist.
bot.on('snagged', function (data) {
	var userid = data.userid;
	if (djList[userid] !== undefined) {
		djList[data.userid].lastActivity = new Date();
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
	
	addCurrentSongToHistory(data);
});

bot.on('update_votes', function(data){
	currentSong.votes['up'] = data.room.metadata.upvotes;
	currentSong.votes['down'] = data.room.metadata.downvotes;
});

bot.on('snagged', function(data) {
	currentSong.hearts = currentSong.hearts + 1;
});


var addCurrentSongToHistory = function(data) {
	if (data.room.metadata.current_song === null) {
		return;
	}

	var play = new Song();
	play.songTitle = currentSong.songTitle;
	play.artist = currentSong.artist;
	play.djId = currentSong.djId;
	play.votes.up = currentSong.votes['up'];
	play.votes.down = currentSong.votes['down'];
	play.hearts = currentSong.hearts;

	
	currentSong.songTitle = data.room.metadata.current_song.metadata.song;
	currentSong.artist = data.room.metadata.current_song.metadata.artist;
	currentSong.djId = data.room.metadata.current_dj;
	currentSong.votes.up = data.room.metadata.upvotes;
	currentSong.votes.down = data.room.metadata.downvotes;
	currentSong.hearts = 0;
	
	
	bot.getProfile(play.djId, function(data){
		play.djName = data.name;
		history.unshift(play);
		if (history.length > 3) {
			history.pop();
		}
	});	
	
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

var printAfkTimes = function() {
	var str = '';
	var now = new Date();
	for (var dj in djList) {
		var djObj = djList[dj];
		var lastActivity = djObj.lastActivity;
		var diffMS = now - lastActivity;
		var diff = new Date(diffMS);
		
		if ( diff.getUTCHours() > 0 ) {
			var idleTime = timeFomat(diff.getUTCHours()) + ":" + timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
		} else {
			var idleTime = timeFormat(diff.getUTCMinutes()) + ":" + timeFormat(diff.getUTCSeconds());
		}
		
		str = str + djObj.name + ': ' + idleTime + '; ';
		
	}
	bot.speak(str);
};

var timeFormat = function(num) {
	return (num < 10) ? "0" + num : num;
};

var getGetOrdinal = function(n) {
   var s=["th","st","nd","rd"],
       v=n%100;
   return n+(s[(v-20)%10]||s[v]||s[0]);
};
