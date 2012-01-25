var fs = require('fs');

var config = {
	botGreetings : ['botname '],
	botGreetingsGeneric	: ['bot ', 'bot'],
	botOwner 	: 'XXXXXXXXXXXXXXXXXXXXXXXX',
	auth 		: 'auth+live+XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
	userid 		: 'XXXXXXXXXXXXXXXXXXXXXXXX',
	roomid 		: 'XXXXXXXXXXXXXXXXXXXXXXXX',	
	port		: 1337


};

eval(fs.readFileSync('./lib/http.js')+'');