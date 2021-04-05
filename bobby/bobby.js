if (process.env.NODE_ENV !== 'production') {
	require('dotenv').config();
}

var Bot    = require('ttapi');


/* 
Use this config to over ride any of the default config settings from bot-base.js
*/
var config = {
	botGreetings : ["bobby ", "@BobbyO'Toole "], // note: greetings need the space after to match properly
	botGreetingsMod	: ['bott ', 'bott'],
	botOwner 	: process.env.TTFM_CONFIG_OWNER,
	auth 		: process.env.TTFM_CONFIG_AUTH,
	userid 		: process.env.TTFM_CONFIG_USERID,
	roomid 		: process.env.TTFM_CONFIG_ROOMID,	
	server_port	: process.env.HTTP_PORT,
	server_host : process.env.HTTP_HOST || '0.0.0.0',
	autoDj    : false, // whether bot should get on deck automatically if down to 1 DJ
	danceMode : true, // whether bot is allowed to dance at all
	danceVotesReq: 1, // votes needed to dance when requested
	debug     : false, 
	queue     : false, // TODO turn queue on or off
	welcomeMods : false,  // TODO true if you want the bot to PM mods when they join
	welcomeAll  : false,  // TODO true if you want the bot to PM 
	songLimit : 3 // either null or an integer
};

var botBase = require('../lib/bot-base.js');
var bot = new Bot(config.auth, config.userid);
bot.debug = false; /* this can be set to true to put ttapi into debug mode */



var botObj = {
	'config' : config,
	'bot' : bot
}

/* ===== REQUIRED MODULES ====== */
// init base bot
botBase.init(botObj);

console.log(botObj);

/* ===== OPTIONAL MODULES ===== */
// init server listening
/*
var httpServer = require('../lib/server-http.js');
botObj.commands = botBase.commands;
httpServer.init(botObj);
bot.listen(config.server_port, config.server_host);
*/


// bot will speak the release date of the album the song is from
/*
var botLastFM = require('./lib/module-lastfm.js');
botLastFM.init(botObj);
*/
