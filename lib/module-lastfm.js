var LastFmNode = require('lastfm').LastFmNode;
var util    = require('util');


var bot = null;
var config = null;
var lastfm = null;


var releasedate = '';


var getMonthName = function(monthAbb) {
	var monthAbbreviations = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	var monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

	var index = monthAbbreviations.indexOf(monthAbb);
	if (index > -1) {
		return monthNames[index];
	} else {
		return monthAbb;
	}

};

var getOrdinal = function(n) {
   var s=["th","st","nd","rd"],
       v=n%100;
   return n+(s[(v-20)%10]||s[v]||s[0]);
};


var getSongInfo = function(data) {
	var songName = data.room.metadata.current_song.metadata.song;
	var artist = data.room.metadata.current_song.metadata.artist;
	
	var request = lastfm.request("track.getInfo", {
		track: songName,
		artist: artist,
		handlers: {
			success: function(data) {
				if (data.track.album !== undefined) {

					var album = data.track.album.title;

					var request = lastfm.request("album.getInfo", {
						album: album,
						artist: artist,
						handlers: {
							success: function(data) {
								releasedate = data.album.releasedate;
								if (releasedate !== undefined) {
									var trimmedDate = releasedate.trim();
									//make sure the string has some stuff in it, or else bail
									if (trimmedDate.length === 0) { return };

									// put the statement together about when the song was released
									var dateParts = trimmedDate.split(' ');
									var releaseDay = dateParts[0];
									var releaseMonth = dateParts[1];
									var releaseYear = dateParts[2];
									releaseYear = releaseYear.replace(",", "");
									var fullReleaseDate = util.format('%s %s %s', getMonthName(releaseMonth), getOrdinal(releaseDay), releaseYear);
									var string = util.format('♫ "%s" by %s is on the album "%s", which was released on %s. ', songName, artist, album, fullReleaseDate);
									bot.speak(string);
									bot.pm(string, config.botOwner);
								}
							},
							error: function(error) {
								console.log("Error: " + error.message);
							}
						}
					});
				}


			},
			error: function(error) {
				console.log("Error: " + error.message);
			}
		}
	});

};


// ============= EXPORTED BOT ==================

var moduleLastFM = {
		
	init : function(botObj) {
		bot = botObj.bot;
		config = botObj.config;

		// LastFM Struct
		lastfm = new LastFmNode({
			api_key: config.lastfm.api_key,
			secret: config.lastfm.secret,
			useragent: config.lastfm.useragent
		});

		bot.on('newsong', function (data) {
			getSongInfo(data);
		});
	
	}


};


module.exports = moduleLastFM;
