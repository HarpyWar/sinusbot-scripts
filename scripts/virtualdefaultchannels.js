registerPlugin({
    name: 'Virtual Default Channels',
    version: '0.1',
	backends: ['ts3'],
    description: 'Setup different default channels for different server groups. Add i_client_move_power and b_client_ignore_antiflood privileges for the bot so it can move users.',
    author: 'HarpyWar <harpywar@gmail.com>',
    vars: [
        {
			name: 'groups',
            title: 'Group IDs. Each group corresponds to a defined channel in the next option. Default server channel can be set with ID = 0',
            type: 'array',
			vars: [
				{
					name: 'group',
					title: 'group id',
					type: 'number'
				}
			]
        },
        {
			name: 'channels',
            title: 'Channels. Each channel corresponds to a defined group in the previous option',
			type: 'array',
			vars: [
				{
					name: 'channel',
					title: 'channel',
					type: 'channel'
				}
			]
        },
        {
			name: 'on_join',
            title: 'Allow users join to default server channel? This option allows to use default server channel as a separator, without an ability to join it for the defined groups.',
            type: 'select',
            options: [
                'yes',
				'no'
			]
        },
		/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

		{
			name: 'debug',
			title: 'Enable debug logging?',
			type: 'checkbox'
		},
    ]
}, function(_, config) {
	
	const engine = require('engine');
	const event = require('event');
	const backend = require('backend');
	
	// fill "undefined" config values with defaults
	config.groups = typeof(config.groups) !== 'undefined'
		? configArrayToArray(config.groups, "group")
		: [];

	config.channels = typeof(config.channels) !== 'undefined'
		? configArrayToArray(config.channels, "channel")
		: [];
		
		
	if (config.groups.length != config.channels.length) {
		logError('Not equal amount of groups and channels! Exiting.');
		return false;
	}

		
	// print all configurations at start
	logDebug("=== CONFIGURATION START ===");
	
	logDebug("groups:");
	logDebug(config.groups);
	logDebug("channels:");
	logDebug(config.channels);
	logDebug("on_join: " + config.on_join);

	logDebug("=== CONFIGURATION END ===");



	var firstConnected = true;
	setTimeout(function(){
		firstConnected = false;
	}, 3000);
	
	event.on('clientMove', function(e) {
		var defaultChannel = getDefaultChannel();
		
		// client leave server
		if (!e.toChannel) {
			return false;
		}

		logDebug('Move event ' + e.client.name() + " -> " + e.toChannel.name() + " (" + e.toChannel.id() + ")");
	
		if (config.on_join == 0) {
			// handle on first join to server only
			if (firstConnected || e.fromChannel || e.toChannel.id() != defaultChannel.id()) {
				return false;
			}
		} else {
			// handle default channel only
			if (e.toChannel.id() != defaultChannel.id()) {
				return false;
			}
		}
		
		// get guest server group
		// FIXME: backend.extended().getServerInfo() is bugged and it does not return defaultServerGroup(). So use json object
		var serverInfo = backend.extended().getServerInfo().asObject(); 
		var defaultServerGroupId = serverInfo.defaultServerGroup;
	
		logDebug('Move action ' + e.client.name());
		//return false;
		
		var clientGroups = e.client.getServerGroups();

		var moveChannelId = false;
		for (var i = 0; i < config.groups.length; i++) {
			// guest channel can be defined as 0
			// if user has no groups it will be moved to a defined guest channel
			if (config.groups[i] == 0 && clientGroups.length == 0) {
				moveChannelId = config.channels[i];
				break;
			}			
			for (var grp in clientGroups) {
				logDebug( "iterate " + clientGroups[grp].id() );
				// set guest group
				if (config.groups[i] == 0)
					config.groups[i] = defaultServerGroupId;
				
				// find group in clientgroups
				if (config.groups[i] == clientGroups[grp].id()) {
					moveChannelId = config.channels[i];
					break;
				}
			}
		}
		if (moveChannelId) {
			var moveChannel = getChannelById(moveChannelId);
			e.client.moveTo(moveChannel);
		}
		logDebug('Move channel ' + moveChannelId);
    });
	
	// [{'channel':123},{}] -> [123]
	function configArrayToArray(arrObj, name) {
		var arr = [];
		for (var i in arrObj) {
			var v = arrObj[i][name];
			if (typeof 'v' === 'string') {
				v = Number.parseInt(v);
			}
			if (v >= 0) {
				arr.push( v );
			}
		}
		return arr;
	}
	
	function getChannelById(cid) {
		var channels = backend.getChannels();
		var ch = null;
		channels.forEach(function(c) {
			// handle default channel if given
			if (cid == 0 && c.isDefault())
			{
				ch = c;
				return;
			}
			// find group in clientgroups
			if (c.id() == cid) {
				ch = c;
				return;
			}
		});
		return ch;
	}

	// return default channel
	function getDefaultChannel() {
		var channels = backend.getChannels();
		var ch = null;
		channels.forEach(function(c) {
			if (c.isDefault()) {
				ch = c;
			}
		});
		return ch;
    }
	
	function logInfo(text) {
		engine.log(text);
	}
	function logError(text) {
		logInfo("[ERROR] " + text);
	}
	function logDebug(text) {
		if (config.debug) {
			logInfo("[DEBUG] " + text);
		}
	}
});
