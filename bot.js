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


var botBase = require('./lib/bot-base.js');


var bot = new Bot(config.auth, config.userid);


var botObj = {
	'config' : config,
	'bot' : bot
}

/* ===== REQUIRED MODULES ====== */
// init base bot
botBase.init(botObj);


/* ===== OPTIONAL MODULES ===== */
// init server listening
var httpServer = require('./lib/server-http.js');
botObj.commands = botBase.commands;
httpServer.init(botObj);
bot.listen(config.port, '127.0.0.1');

// bot will speak the release date of the album the song is from
var botLastFM = require('./lib/module-lastfm.js');
botLastFM.init(botObj);
