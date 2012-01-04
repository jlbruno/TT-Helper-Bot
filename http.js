var Bot    = require('ttapi');
var config = require('./settings-http.js');
var fs 		= require('fs');
var path 	= require('path');

//var bot = new Bot(config.auth, config.userid, config.roomid);
var bot = new Bot(config.auth, config.userid);
bot.listen(1337, '127.0.0.1');

var myScriptVersion = '0.0.0';

config.autobop = false;
config.debug = false;

var roomMods;


bot.on('httpRequest', function (req, res) {
	var method = req.method;
	var url    = req.url;
	switch (url) {
		case '/':
			
			var filePath = './public/index.html';
				 
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
			
		case '/version/':
		if (method == 'GET') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end('{"version":"'+myScriptVersion+'"}');
		} else {
			res.writeHead(500);
			res.end();
		}
		break;
		case '/dance/':
			bot.vote('up');
			res.end('dancing...');
			break;
		default:
			res.writeHead(500);
			res.end();
			break;
	}
});


var currVotes = { 'up': 0, 'down': 0 };

var Song = function() {
	this.songTitle = '';
	this.artist = '';
	this.djId = '';
	this.djName = '';
	this.votes = { 'up': 0, 'down': 0 };
};
	
var currentSong = new Song();	

var history = [];

bot.on('ready', function () {
   bot.stalk(config.botOwner, function (data) {
      var room = data.roomId;
      bot.roomRegister(room);
   });
});

bot.on('deregistered', function (data) {
   if (data.user[0].userid == config.botOwner) {
      setTimeout(function () {
         bot.stalk(config.botOwner, function (data) {
            var room = data.roomId;
            bot.roomRegister(room);
         });
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


bot.on('speak', function(data){
	//var result = data.text.match(/^\/(.*?)( .*)?$/);
	var result = data.text.match(/^bot (.*?)( .*)?$/) || data.text.match(/^bot(.*?)( .*)?$/) || data.text.match(/^sorry (.*?)( .*)?$/) || data.text.match(/^sam (.*?)( .*)?$/);
	//console.log('result: ' + result);
	
	if(result){
		var command = result[1].trim().toLowerCase();
		//console.log('command: ' + command);
		var param = '';
		if (result.length == 3 && result[2]){
			param = result[2].trim().toLowerCase();
		}
		var isOwner = (data.userid === config.botOwner);
		var isModerator = roomMods.indexOf(data.userid) > -1 ? true : false;

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
			case 'last':
				var string = '';
				if (param > 3) {
					param = 3;
					bot.speak("I don't keep a history that far back. Here's what I know.");
				}
				var i = param || 1;
				while (i--) {
					if (history[i] === undefined) {
						string = string + 'I don\'t have history for the ' + getGetOrdinal(i+1) + ' song, sorry. ';
						continue;
					}
					string = string + history[i].djName + ' played "' + history[i].songTitle + '" by ' + history[i].artist + '. The votes: +' + history[i].votes['up'] + ', -' + history[i].votes['down'] + '. ';
				}
				bot.speak(string);
				break;
			case 'command':
				// backdoor to run any other ttapi commands that aren't built in to the bot
				if (isOwner) eval(param);
				break;
		}
	}
});



bot.on('newsong', function(data){
	//if (config.debug) console.log('new song ===================================================');
	if (config.autobop) {
		var min = 5000;
		var max = 30000;
		var rand = Math.floor(Math.random() * (max - min + 1)) + min;
		//console.log(rand);
		setTimeout(function () {
			bot.speak('bot dance');
			bot.vote('up');
		}, rand);
	}
	
	addCurrentSongToHistory(data);
	
	
});

bot.on('update_votes', function(data){
	currentSong.votes['up'] = data.room.metadata.upvotes;
	currentSong.votes['down'] = data.room.metadata.downvotes;
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

	
	currentSong.songTitle = data.room.metadata.current_song.metadata.song;
	currentSong.artist = data.room.metadata.current_song.metadata.artist;
	currentSong.djId = data.room.metadata.current_dj;
	
	
	bot.getProfile(play.djId, function(data){
		play.djName = data.name;
		history.unshift(play);
		if (history.length > 3) {
			history.pop();
		}
	});	
	
};


var getGetOrdinal = function(n) {
   var s=["th","st","nd","rd"],
       v=n%100;
   return n+(s[(v-20)%10]||s[v]||s[0]);
};
