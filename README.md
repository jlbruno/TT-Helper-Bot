A basic helper bot for turntable.fm built on ttapi.


# Configuration
Rename `config-example.js` to `config.js` and update the configuration object. 

These are the config values you need to get from Turntable.
```
	botOwner 	: 'XXXXXXXXXXXXXXXXXXXXXXXX',
	auth 		: 'XXXXXXXXXXXXXXXXXXXXXXXX',
	userid 		: 'XXXXXXXXXXXXXXXXXXXXXXXX',
	roomid 		: 'XXXXXXXXXXXXXXXXXXXXXXXX',	
```

Open your browser, log into TT using the account you'll use for the bot, and join the room you want your bot to be in. 

Open you developer console, find the values for the configs above by typing the following commands into the console. 

### auth
`turntable.user.auth` when logged in as the bot user account.

### userid
Bot user ID. `turntable.user.id` when logged into TT as the bot.

### roomid
The ID of the room you want the bot to join when it starts up. `TURNTABLE_ROOM.roomid`


### botOwner
This would be your user id. This is used to limit certain commands to the bot owner. This is  `turntable.user.id` when logged in as yourself, not as the bot.
