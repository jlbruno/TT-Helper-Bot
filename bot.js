var Bot    = require('ttapi');

var config = {
	botGreetings : ['botname '],
	botGreetingsGeneric	: ['bot ', 'bot'],
	botOwner 	: 'XXXXXXXXXXXXXXXXXXXXXXXX',
	auth 		: 'auth+live+XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
	userid 		: 'XXXXXXXXXXXXXXXXXXXXXXXX',
	roomid 		: 'XXXXXXXXXXXXXXXXXXXXXXXX',	
	port		: 1337
};

config.autobop = false;
config.autobot = false;
config.autoDj = true;
config.danceMode = false;
config.followMe = false;
config.debug = false;
config.holdMode = false;
config.watchMode = false;
config.queue = false;

var botStuff = require('./lib/http.js');


var bot = new Bot(config.auth, config.userid);
bot.listen(config.port, '127.0.0.1');


var botObj = {
	'eventData' : null,
	'config' : config,
	'bot' : bot
}


bot.on('ready', function (data) {
	botObj.eventData = data;
	botStuff.onReady(botObj);
});

bot.on('deregistered', function (data) {
	botObj.eventData = data;
	botStuff.onDeregistered(botObj);
});

bot.on('roomChanged', function (data) {
	botObj.eventData = data;
	botStuff.onRoomChanged(botObj);
});

bot.on('booted_user', function (data) {
	botObj.eventData = data;
	botStuff.onBootedUser(botObj);
});