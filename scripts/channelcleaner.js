registerPlugin({
    name: 'Channel Cleaner',
    version: '0.12',
	backends: ['ts3'],
    description: 'Automatically removes inactive channels',
    author: 'HarpyWar <harpywar@gmail.com>',
    vars: [
		// 0 = all channels | 1 = specific channels | 2 = all channels with the same parentchannel
		{
			name: 'listenType',
			title: 'Channels to check',
			type: 'select',
			options: [
				"All Channels",
				"Specific Channels",
				"All subchannels with the same parentchannel"
			]
		},
		// channels to ignore
		{
			name: 'ignoreChannels',
			title: 'Ignore channels',
			type: 'array',
			vars: [
				{
					name: 'channel',
					title: 'channel',
					type: 'channel'
				}
			],
			conditions: [
				{
					field: 'listenType',
					value: 0
				}
			]
		},
		// choose channels to check, only shown when listentype is 1 (specific channels)
		{
			name: 'chooseChannels',
			title: 'choose Channels',
			type: 'array',
			vars: [
				{
					name: 'channel',
					title: 'channel',
					type: 'channel'
				}
			],
			conditions: [
				{
					field: 'listenType',
					value: 1
				}
			]
		},
		// parentchannel, only shown when listentype is 2 (all channels with the same parentchannel)
		{
			name: 'parentChannels',
			title: 'Parent Channel',
			type: 'array',
			vars: [
				{
					name: 'channel',
					title: 'channel',
					type: 'channel'
				}
			],
			conditions: [
				{
					field: 'listenType',
					value: 2
				}
			]
		},
		// time, a channel can be unused until it will be deleted.
		{
			name: 'timeTillDeletion',
			title: 'Time, how long a channel can stay unused till it will be deleted (in minutes)',
			type: 'number',
			placeholder: 20160
		},
		// Descriptionsettings
		// check if user want to set a description
		{
			name: 'enableDescription',
			title: 'Do you want to set a list of channels and their time until deletion as description of a channel?',
			type: 'select',
			options: [
				"no",
				"yes"
			]
		},
		// channel, the user want to set the description to
		{
			name: 'descriptionChannel',
			title: 'Set a list of channels and their time until deletion as description of this channel.',
			type: 'channel',
			conditions: [
				{
					field: 'enableDescription',
					value: 1
				}
			]
		},
		// how often the description should be updated
		{
			name: 'descriptionUpdateTime',
			title: 'Update the description every ... minutes',
			type: 'number',
			placeholder: 360,
			conditions: [
				{
					field: 'enableDescription',
					value: 1
				}
			]
		},
		{
			name: 'descriptionRaw',
			title: 'Enter the description. %channels% will be replaced with a list of all channels and their time until deletetion.',
			type: 'multiline',
			placeholder: "[center]CHANNELS TO DELETE[/center][hr]%channels%",
			conditions: [
				{
					field: 'enableDescription',
					value: 1
				}
			]
		},
		{
			name: 'descriptionRawItem',
			title: 'Single row with a channel in description',
			type: 'string',
			placeholder: "- [b]%channel%[/b] in %time%",
			conditions: [
				{
					field: 'enableDescription',
					value: 1
				}
			]
		},
		/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
		{
			name: 'enableWarning',
			title: 'Do you want the bot to warn the users before the channel will be deleted, by adding text to the channelname?',
			type: 'select',
			options: [
			  "no",
			  "yes"
			]
		},
		{
			name: 'minutesBeforeWarning',
			title: 'How many minutes before channel-deletion do you want the bot to edit the channel?',
			type: 'number',
			placeholder: 1440,
			conditions: [
				{
					field: 'enableWarning',
					value: 1
				}
			]
		},
		{
			name: 'warningString',
			title: 'What should the bot add to the channelname?',
			type: 'string',
			placeholder: " (TO BE DELETE)",
			conditions: [
				{
					field: 'enableWarning',
					value: 1
				}
			]
		},	 		  
		/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
		{
			name: 'debug',
			title: 'Enable debug logging?',
			type: 'checkbox'
		},
	],
}, function(_, config) {
	
	const engine = require('engine');
	const event = require('event');
	const backend = require('backend');
	const store = require('store');

	const TS3_MAX_SIZE_CHANNEL_DESCRIPTION = 8192;
	
	// fill "undefined" values with defaults
	config.ignoreChannels = typeof(config.ignoreChannels) !== 'undefined'
		? config.ignoreChannels
		: [];
	config.chooseChannels = typeof(config.chooseChannels) !== 'undefined'
		? config.chooseChannels
		: [];
	config.parentChannels = typeof(config.parentChannels) !== 'undefined'
		? config.parentChannels
		: [];
	if ( !config.timeTillDeletion ) {
		config.timeTillDeletion = 20160; // 14 days
	}
	if ( !config.descriptionUpdateTime ) {
		config.descriptionUpdateTime = 360; // 6 hours
	}
	if ( !config.minutesBeforeWarning ) {
		config.minutesBeforeWarning = 1440; // 1 day
	}
	if ( !config.descriptionRaw ) {
		config.descriptionRaw = "[center]CHANNELS TO DELETE[/center][hr]%channels%";
	}
	if ( !config.descriptionRawItem ) {
		config.descriptionRawItem = "- [b]%channel%[/b] in %time%";
	}
	if ( !config.warningString ) {
		config.warningString = " (TO BE DELETE)";
	}
	
	// print all configurations at start
	logDebug("=== CONFIGURATION START ===");
	
	logDebug("listenType: " + config.listenType);
	logDebug("ignoreChannels:");
	logDebug(config.ignoreChannels);
	logDebug("chooseChannels:");
	logDebug(config.chooseChannels);
	logDebug("parentChannels:");
	logDebug(config.parentChannels);
	
	logDebug("timeTillDeletion: " + config.timeTillDeletion);
	logDebug("enableDescription: " + config.enableDescription);
	logDebug("descriptionChannel: " + config.descriptionChannel);
	logDebug("descriptionUpdateTime: " + config.descriptionUpdateTime);
	logDebug("descriptionRaw: " + config.descriptionRaw);
	logDebug("descriptionRawItem: " + config.descriptionRawItem);
	logDebug("enableWarning: " + config.enableWarning);
	logDebug("minutesBeforeWarning: " + config.minutesBeforeWarning);
	logDebug("warningString: " + config.warningString);
	logDebug("debug: " + config.debug);

	logDebug("=== CONFIGURATION END ===");
	
	

	/* debug area */
	event.on('chat', function(ev) {
		// print channel list in logs
		if (ev.text.indexOf("!cc_list") >= 0) {
			logInfo( printChannelList() );
		}
		// sync channels
		if (ev.text.indexOf("!cc_sync") >= 0) {
			syncChannels();
		}
		// update channel list in description
		if (ev.text.indexOf("!cc_desc") >= 0) {
			updateDescription();
		}
	});
	/* end debug area */
	
	
	// execute sync every minute
	setInterval(function() {
		syncChannels();
	}, 60000); // 1 min
	
	// update description every X minutes defined in config
	if (config.enableDescription == 1) {
		setInterval(function() {
			updateDescription();
		}, config.descriptionUpdateTime * 1000 * 60);
	}

	// synchronize channels in store with TS channel list,
	// delete inactivity channels
	function syncChannels()
	{
		if ( !backend.isConnected() ) {
			logError("not connected to server!");
			return;
		}
		logDebug("sync channels");

		var channels = getChannels();
		var sChannels = getStoreChannels();

		// 1) remove channels from store which does not exist on server
		var toDelete = [];
		for (var i in sChannels) {
			var found = false;
			channels.forEach(function(c) {
				if (c.id() == sChannels[i].id) {
					found = true;
					return;
				}
			});
			if (!found) {
				toDelete.push(i);
			}
		}
		// iterate through reversed array
		// it's required to remove bigger index from sChannels
		toDelete.reverse().forEach(function(idx) {
			logChannelInfo("remove non-exist channel from store", sChannels[idx].name, sChannels[idx].id);
			sChannels.splice(idx, 1);
		});
		
		// 2) update channels from server in store
		for (var i in channels) {
			updateStoreChannel(sChannels, channels[i]);
		}
		
		// save store
		saveStoreChannels(sChannels);
	}
	
	// update channel inactivity time in store,
	// or add channel in store if not exists
	function updateStoreChannel(sc, c) {
		var found = false;
		for (var i in sc) {
			if ( sc[i].id == c.id() ) {
				if ( c.getClientCount() == 0 ) {
					sc[i].inactivity++;
					logChannelInfo("increase inactivity ", sc[i].name, sc[i].id);
				} else if (sc[i].inactivity > 0) {
					sc[i].inactivity = 0;
					logChannelInfo("reset inactivity ", sc[i].name, sc[i].id);
					// set back to normal name
					if ( c.name().endsWith(config.warningString) ) {
						c.setName( c.name().replace(config.warningString, "") );
					}
					// update channel name in store
					sc[i].name = c.name();
				}
				
				if (config.enableWarning == 1) {
					// warn inactivity channel by changing its name
					if (sc[i].inactivity >= config.timeTillDeletion - config.minutesBeforeWarning && !c.name().endsWith(config.warningString) ) {
						logChannelInfo("warn inactivity channel ", sc[i].name, sc[i].id);
						c.setName(c.name() + config.warningString);
					}
				}

				// delete inactivity channel
				if (sc[i].inactivity >= config.timeTillDeletion) {
					logChannelInfo("delete inactivity channel ", sc[i].name, sc[i].id);
					c.delete();
				}
				
				found = true;
			}
		}
		
		// if not found then add new
		if (!found) {
			sc.push({
				id: c.id(), // channel server id
				name: c.name(), // original name, updates each time without "to delete" postfix
				inactivity: 0 // minutes of inactivity, increases +1 each minute when channel is empty, and reset when somebody is on the channel
			});
			logChannelInfo("add new channel in store ", c.name(), c.id());
		}
	}
	
	// return channels from store
	function getStoreChannels() {
		var data = store.get("channels");
		if (data === undefined) {
			logInfo("init store channels");
			store.set("channels", [] );
			return getStoreChannels();
		}
		return data;
	}
	// save channels in store
	function saveStoreChannels(channels) {
		store.set("channels", channels);
	}
	
	// set channelList for delete in a special channel description
	function updateDescription() {
		if ( !backend.isConnected() ) {
			logError("not connected to server!");
			return;
		}
		var c = getChannelById(config.descriptionChannel);
		if (!c) {
			logError("channel for description is not found!");
			return;
		}
		c.setDescription( printChannelList() );
	}

	// return formatted string with channels and it delete time
	function printChannelList() {
		var channels = getStoreChannels();
		// order by inactivity
		channels.sort(function(a, b) {
		  return b.inactivity - a.inactivity;
		});
		
		var channelList = "";
		channels.forEach(function(sc) {
			// print only inactive channels
			if (sc.inactivity > 0) {
				channelList += config.descriptionRawItem
					.replace("%channel%", sc.name.replace(config.warningString, ""))
					.replace("%time%", timeForHumans((config.timeTillDeletion - sc.inactivity) * 60)) + "\n";
			}
		});
		
		var output = config.descriptionRaw;
		output = output.replace("%channels%", channelList);
		// limit description length to max allowed
		if (output.length > TS3_MAX_SIZE_CHANNEL_DESCRIPTION) {
			output = output.substring(0, TS3_MAX_SIZE_CHANNEL_DESCRIPTION - 4) + '...';
		}
		return output;
	}
	
	
	// log message for given channel and name
	function logChannelInfo(text, name, id) {
		logDebug(text + " [" + name + " (" + id + ")]");
	}
	
	// return filtered, depending on rules, channel list from the server
	function getChannels() {
		var filtered = [];
		var channels = backend.getChannels();
		
		for (var i in channels) {
			var c = channels[i];
			// ignore default channel if given
			if (c.isDefault()) {
				continue;
			}
			// ignore temp channels, cause it deletes automatically
			if ( !c.isPermanent() && !c.isSemiPermanent() ) {
				continue;
			}

			// 1) ignore other channels by rules
			// listenType is type of string!
			switch (config.listenType) {
				case "0":
					// do not handle channel in ignoreChannels
					if ( configChannelIncludes(config.ignoreChannels, c.id()) ) {
						logChannelInfo("ignore channel", c.id(), c.name());
						continue;
					}
					break;
				
				case "1":
					// do not handle channel which is not in chooseChannels
					if ( !configChannelIncludes(config.chooseChannels, c.id()) ) {
						logChannelInfo("ignore channel", c.id(), c.name());
						continue;
					}
					break;
					
				case "2":
					// do not handle channel which has not parent, or if parent is not in parentChannels
					if ( c.parent() == null || !configChannelIncludes(config.parentChannels, c.parent().id()) ) {
						logChannelInfo("ignore channel", c.id(), c.name());
						continue;
					}
					break;
			}
			filtered.push(c);
		}
		return filtered;
	}
	
	// return true if configCHannels contain channel id
	// configChannels format by default is the following:
	//	[{"channel":"1"},{"channel":"4"}, {}] // last is "none"
	function configChannelIncludes(configChannels, cid) {
		var found = false;
		configChannels.forEach(function(c) {
			if (c.channel == cid) {
				found = true;
				return;
			}
		});
		return found;
	}
	
	// return TS channel from it's is
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
		
	/**
	 * Translates seconds into human readable format of seconds, minutes, hours, days, and years
	 * 
	 * @param  {number} seconds The number of seconds to be processed
	 * @return {string}         The phrase describing the the amount of time
	 */
	function timeForHumans(seconds) {
		var levels = [
			[Math.floor(seconds / 31536000), 'years'],
			[Math.floor((seconds % 31536000) / 86400), 'days'],
			[Math.floor(((seconds % 31536000) % 86400) / 3600), 'hours'],
			//[Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), 'minutes'],
			//[(((seconds % 31536000) % 86400) % 3600) % 60, 'seconds'],
		];
		var returntext = '';

		for (var i = 0, max = levels.length; i < max; i++) {
			if ( levels[i][0] === 0 ) continue;
			returntext += ' ' + levels[i][0] + ' ' + (levels[i][0] === 1 ? levels[i][1].substr(0, levels[i][1].length-1): levels[i][1]);
		};
		returntext = returntext.trim();
		if (!returntext.length) {
			returntext = "minutes";
		}
		return returntext;
	}
});
