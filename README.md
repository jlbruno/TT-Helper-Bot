A basic helper bot for turntable.fm built on ttapi.

# Requirements
Node version 14 LTS (tested with 14.16.1)

# Configuration
Rename `.env.example` to `.env` and update the configuration values.

These are the config values you need to get from Turntable.
```
CONFIG_OWNER = 'XXXXXXXXXXXXXXXXXXXXXXXX';
CONFIG_AUTH = 'XXXXXXXXXXXXXXXXXXXXXXXX';
CONFIG_USERID = 'XXXXXXXXXXXXXXXXXXXXXXXX';
CONFIG_ROOMID = 'XXXXXXXXXXXXXXXXXXXXXXXX';
```

Open your browser, log into TT using the account you'll use for the bot, and join the room you want your bot to be in.

Open you developer console, find the values for the configs above by typing the following commands into the console.

### CONFIG_AUTH
`turntable.user.auth` when logged in as the bot user account.

### CONFIG_USERID
Bot user ID. `turntable.user.id` when logged into TT as the bot.

### CONFIG_ROOMID
The ID of the room you want the bot to join when it starts up. `TURNTABLE_ROOM.roomid`

### CONFIG_OWNER
This would be your user id. This is used to limit certain commands to the bot owner. This is  `turntable.user.id` when logged in as yourself, not as the bot.


# Deployment
To run the bot, run `node bot.js` to run the bot configured in `bot.js`. If you have other configured bots, run their script instead.
