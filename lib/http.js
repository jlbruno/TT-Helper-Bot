/*global config:true */

var fs 		= require('fs');
var path 	= require('path');
var extend  = require('./node.extend');




var ttRoom = {
	roomMods	: null,
	history		: [],
	djList		: {},
	recentDjs	: {},
	danceUsers	: [],
	danceCounter: 0,  // how many ppl have told the bot to dance this song
	botOnDeck	: false,  // true when the bot is on deck
	djHelper 	: false,  // set true when bot is dj'ing in 'help' mode
	queue		: [] // array of users in queue
};


var Song = function() {
	this.songTitle = '';
	this.artist = '';
	this.djId = '';
	this.djName = '';
	this.votes = { 'up': 0, 'down': 0 };
	this.hearts = 0;
};
	
var currentSong = new Song();


var addCurrentSongToHistory = function(data) {
	if (data.room.metadata.current_song === null) {
		return;
	}

	// create a new 'play' object with the last played song
	// this is what we'll add to the history
	var play = new Song();
	play.songTitle = currentSong.songTitle;
	play.artist = currentSong.artist;
	play.djId = currentSong.djId;
	play.djName = currentSong.djName;
	play.votes.up = currentSong.votes['up'];
	play.votes.down = currentSong.votes['down'];
	play.hearts = currentSong.hearts;
	
	// add the 'play' object to history
	if (play.djId !== '') {
		ttRoom.history.unshift(play);
		if (ttRoom.history.length > 3) {
			ttRoom.history.pop();
		}
	}

	// reset the properties of the 'currentSong' object to what is currently playing
	currentSong.songTitle = data.room.metadata.current_song.metadata.song;
	currentSong.artist = data.room.metadata.current_song.metadata.artist;
	currentSong.djId = data.room.metadata.current_song.djid;
	currentSong.djName = data.room.metadata.current_song.djname;
	currentSong.votes.up = data.room.metadata.upvotes;
	currentSong.votes.down = data.room.metadata.downvotes;
	currentSong.hearts = 0;
	
	
};




var myBot = {
	

	currVotes : { 'up': 0, 'down': 0 },

		


	onReady : function(botObj) {
		botObj.bot.stalk(botObj.config.botOwner, function (data) {
			if (data.success == true) {
				botObj.bot.roomRegister(data.roomId);
			} else {
				botObj.bot.roomRegister(config.roomid);
			}
	   });
	},

	onDeregistered : function (botObj) {
		if (botObj.eventData.user[0].userid == botObj.config.botOwner && botObj.config.followMe) {
			setTimeout(function () {
				findOwner();
			}, 5000);
		}
	},

	onRoomChanged : function (botObj) {
		for (var i=0; i < botObj.eventData.users.length; i++) {
			if (botObj.eventData.users[i].userid == botObj.config.botOwner) {
				break;
			}
		}
		addCurrentSongToHistory(botObj.eventData);
		
		ttRoom.roomMods = botObj.eventData.room.metadata.moderator_id;
	},

	onBootedUser : function (botObj) {
		var reason = botObj.eventData.reason;
		if (botObj.eventData.userid === config.userid) {
			botObj.bot.getProfile(botObj.eventData.modid, function(data) {
				console.log('I was booted by ' + data.name + ' because: ' + reason);
			});
		}
	}

	




};


module.exports = myBot;

