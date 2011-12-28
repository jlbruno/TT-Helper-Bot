var Bot    = require('ttapi');
var config = require('./settings-http.js');

//var bot = new Bot(config.auth, config.userid, config.roomid);
var bot = new Bot(config.auth, config.userid);
bot.listen(1337, '127.0.0.1');

var myScriptVersion = '0.0.0';

config.autobop = false;


bot.on('httpRequest', function (req, res) {
   var method = req.method;
   var url    = req.url;
   switch (url) {
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

var currSong = '';
var lastSong = '';
var currArtist = '';
var lastArtist = '';
var currDjId = '';
var lastDjId = '';
var lastDjName = '';
var currVotes = { 'up': 0, 'down': 0 };
var lastVotes = {};

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
});


bot.on('speak', function(data){
	//var result = data.text.match(/^\/(.*?)( .*)?$/);
	var result = data.text.match(/^bot (.*?)( .*)?$/) || data.text.match(/^sorry (.*?)( .*)?$/);
	//console.log('result: ' + result);
	if(result){
		var command = result[1].trim().toLowerCase();
		//console.log('command: ' + command);
		var param = '';
		if (result.length == 3 && result[2]){
			param = result[2].trim().toLowerCase();
		}
		var isOwner = (data.userid === config.botOwner);
		switch(command){
			case 'dance':
				bot.vote('up');
				//bot.speak('I love this song!');
				break;
			case 'lame':
				bot.vote('down');
				break;
			case 'dj':
				if (isOwner) bot.addDj();
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
				bot.roomDeregister();
				break;
			case 'goodbye':
				bot.roomDeregister();
				break;
			case 'last':
				bot.speak(lastDjName + ' played "' + lastSong + '" by ' + lastArtist + '. The votes: +' + lastVotes['up'] + ', -' + lastVotes['down']);
				break;
		}
	}
});



bot.on('newsong', function(data){
	if (config.autobop) {
		var min = 5000;
		var max = 30000;
		var rand = Math.floor(Math.random() * (max - min + 1)) + min;
		//console.log(rand);
		setTimeout(function () {
			 bot.vote('up');
		}, rand);
	}
	  
	lastSong = currSong;
	lastArtist = currArtist;
	lastDjId = currDjId;
	bot.getProfile(currDjId, function(data){
		lastDjName = data.name;
	});
	currSong = data.room.metadata.current_song.metadata.song;
	currArtist = data.room.metadata.current_song.metadata.artist;
	currDjId = data.room.metadata.current_dj;
	lastVotes = currVotes;
});

bot.on('update_votes', function(data){
	currVotes['up'] = data.room.metadata.upvotes;
	currVotes['down'] = data.room.metadata.downvotes;
});
