registerPlugin({
    name: 'Play Idle Agent',
    version: '0.1',
    engine: '>= 1.0.14',
	backends: ['ts3', 'discord'],
    description: 'Watch for a bot music status and resume play if it is not',
    author: 'HarpyWar <harpywar@gmail.com> for CleanVoice <support@cleanvoice.ru>',
    vars: [
		{
			name: 'playType',
            title: 'Resume play for',
            type: 'select',
            options: [
                'Track / Radio',
				'Playlist'
			]
        },
		{
			name: 'track',
			title: 'Select a track',
			type: 'track',
			conditions: [
				{
					field: 'playType',
					value: 0
				}
			]
		},
		{
			name: 'playlist',
			title: 'Playlist name',
			type: 'string',
			conditions: [
				{
					field: 'playType',
					value: 1
				}
			]
		},
		/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

		{
			name: 'debug',
			title: 'Enable debug logging? (disable in production)',
			type: 'checkbox'
		},
    ]
}, function(_, config) {
	
	const engine = require('engine');
	const media = require('media');
	const audio = require('audio');
	const helpers = require('helpers');
	const checkInterval = 10; // every 10 sec

	// fill "undefined" config values with defaults
	if ( config.playType == "0" && !config.track )
	{
		logError("Track is not defined. Exiting.");
		return;
	}
	if ( config.playType == "1" && !config.playlist )
	{
		logError("Playlist is not defined. Exiting.");
		return;
	}


	// print all configurations at start
	
	logDebug("=== CONFIGURATION START ===");
	
	logDebug("playType:" + config.playType);
	if (config.playType == '0')
	{
		logDebug("track " + config.track.url);
	}
	else
	{
		logDebug("playlist " + config.playlist);
				
		var playlist = findPlaylist(config.playlist);
		if (playlist) {
			var trackCount = playlist.getTracks().length;
			logInfo("playlist contains " + trackCount + " tracks");
		} else {
			logError("playlist " + config.playlist + "does not exist");
			return;
		}
	}
	
	logDebug("=== CONFIGURATION END ===");



	setInterval(function() {
		checkPlayIdle();
	}, checkInterval * 1000);
	
	
	// keep last check data
	var prevTrackPos = null;
	var prevTrackId = null;

	function checkPlayIdle() {
		var curTrackPos = audio.getTrackPosition();
		var curTrackId = (media.getCurrentTrack())
			? media.getCurrentTrack().id()
			: null;
		
		if ( !audio.isPlaying() || (prevTrackPos == curTrackPos && curTrackId == prevTrackId) )
		{
			// track
			if (config.playType == "0") {
				logInfo("music is not playing! play " + config.track.title);
				media.playURL(config.track.url);
			}
			// playlist
			else 
			{
				// play next track
				var playlist = findPlaylist(config.playlist);
				if (playlist) {
					logInfo("music is not playing! play random track from " + playlist.name());
					var tracks = playlist.getTracks();
					var count = tracks.length - 1;
					var rnd = helpers.getRandom(count);
					playlist.setActive();
					media.stop();
					media.playlistPlayByID(playlist, rnd);
				} else {
					logError("playlist " + config.playlist + " does not exist");
					return;
				}
			}

		}
		prevTrackPos = curTrackPos;
		prevTrackId = curTrackId;
		
		//logDebug("isplaying " + audio.isPlaying() );
		//logDebug("track pos " + audio.getTrackPosition() );
		//logDebug("track id " + media.getCurrentTrack().id() );
	}

	function findPlaylist(name) {
		var found = null;
		media.getPlaylists().forEach(function(p){
			if (p.name() == name.trim())
				found = p;
		});
		return found;
	}

   
	function logInfo(text) {
		if (typeof(text) == 'object')
		{
			text.forEach(function(v){
				logInfo(v);
			});
		}
		else
			engine.log(text);
	}
	function logError(text) {
		logInfo("[ERROR] " + text);
	}
	function logDebug(text) {
		if (config.debug) {
			if (typeof(text) == 'object')
			{
				logInfo(text);
			}
			else
				logInfo("[DEBUG] " + text);
		}
	}
});
