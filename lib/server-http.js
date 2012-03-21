
var fs 		= require('fs');
var path 	= require('path');

var doCommand;

var onHttpRequest = function (request, res) {
	var method = request.method;
	var url    = require('url').parse(request.url).pathname;
	var command = require('url').parse(request.url, true).query.command;
	var param = require('url').parse(request.url, true).query.param;
	var who = {
		isOwner : true,
		isMod : true,
		isDj : false
	};
	
	var commandObj = {
		'command' 	: command,
		'param'		: param,
		'who'		: who
	};
	
	switch (url) {
		case '/command/': 
			doCommand(commandObj);
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
};




// ============= EXPORTED BOT ==================

var httpServer = {
		
	init : function(botObj) {
		bot = botObj.bot;
		config = botObj.config;

		doCommand = botObj.commands;

		bot.on('httpRequest', function (request, res) {
			onHttpRequest(request, res);
		});
	
	}


};


module.exports = httpServer;
