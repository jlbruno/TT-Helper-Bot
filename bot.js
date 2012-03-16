var Bot    = require('ttapi');

var config = {
	botGreetings : ['botname '],
	botGreetingsGeneric	: ['bot ', 'bot'],
	botOwner 	: 'XXXXXXXXXXXXXXXXXXXXXXXX',
	auth 		: 'auth+live+XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
	userid 		: 'XXXXXXXXXXXXXXXXXXXXXXXX',
	roomid 		: 'XXXXXXXXXXXXXXXXXXXXXXXX',	
	port		: 1337,
	autobop   : false,
	autobot   : false,
	autoDj    : true,
	danceMode : false,
	followMe  : false,
	debug     : false,
	holdMode  : false,
	watchMode : false,
	queue     : false
};


var botStuff = require('./lib/http.js');


var bot = new Bot(config.auth, config.userid);
bot.listen(config.port, '127.0.0.1');


var botObj = {
	'config' : config,
	'bot' : bot
}


botStuff.init(botObj);