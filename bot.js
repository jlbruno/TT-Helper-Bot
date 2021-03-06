var Bot    = require('ttapi');

var baseConfig = {
	botGreetings : ['botname'],
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
	queue     : false,
	lastfm    : {
		api_key: "LASTFM_KEY",
		secret: "LASTFM_SECRET",
		useragent: "APP_STRING"
	}
};

var botConfig = require('./config.js');
var config = {...baseConfig, ...botConfig};


var botBase = require('./lib/bot-base.js');
var bot = new Bot(config.auth, config.userid);
bot.debug = false; /* this can be set to true to put ttapi into debug mode */


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
/*
var botLastFM = require('./lib/module-lastfm.js');
botLastFM.init(botObj);
*/
