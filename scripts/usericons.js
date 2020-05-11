registerPlugin({
    name: 'User !icons',
    version: '0.1',
	backends: ['ts3'],
    description: 'Allow users to set icons on themselves',
    author: 'HarpyWar <harpywar@gmail.com> for CleanVoice <support@cleanvoice.ru>',
    vars: [
        {
			name: 'iconGroups',
            title: 'Groups as icons (group IDs)',
            type: 'strings'
        },
		{
			name: 'accessType',
            title: 'Who can assign icons themselves?',
            type: 'select',
            options: [
                'All groups except defined in "Ignore groups" (default)',
				'Only groups defined in "Access groups"'
			]
        },
        {
			name: 'ignoreGroups',
            title: '(OPTIONAL) Ignore groups (numeric IDs)',
            type: 'array',
            type: 'strings',
			conditions: [
				{
					field: 'accessType',
					value: 0
				}
			]
        },
        {
			name: 'accessGroups',
            title: 'Access groups (numeric IDs)',
            type: 'array',
            type: 'strings',
			conditions: [
				{
					field: 'accessType',
					value: 1
				}
			]
        },
		{
			name: 'iconsLimit',
			title: '(OPTIONAL) Icons limit. How many icons a user can set?',
			type: 'number',
			placeholder: 3
		},
		{
			name: 'cmdText',
			title: '(OPTIONAL) !icons command text',
			type: 'multiline',
			placeholder: '[i]Usage examples to set icons:\n!icons 0 (clear)\n!icons 1\n!icons 1 2 3[/i]\n\n[b]All Icons[/b]\n%ICONS%\n\nYou have set [b]%CURRENT%/%MAX%[/b] icons'
		},
		{
			name: 'cmdRespondText',
			title: '(OPTIONAL) When icons are changed respond with the text',
			type: 'string',
			placeholder: 'Your icons updated'
		},
		{
			name: 'cmdQuota',
			title: '(OPTIONAL) Command use quota. How many seconds should pass after a user can get a new icon set? (to exclude spam in a server chat when group add/del)',
			type: 'number',
			placeholder: 60
		},
		{
			name: 'cmdQuotaText',
			title: '(OPTIONAL) Quota message',
			type: 'string',
			placeholder: 'Quota exceed. Please, wait %WAITTIME% sec'
		},/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

		{
			name: 'debug',
			title: 'Enable debug logging? (disable in production)',
			type: 'checkbox'
		},
    ]
}, function(_, config) {
	
	const cmdName = '!icons'
	const engine = require('engine');
	const event = require('event');
	const backend = require('backend');

	// fill "undefined" config values with defaults
	if ( !config.iconGroups )
	{
		logError("Icon groups are not defined. Exiting.");
		return
	}
	

	if ( !config.accessType )
		config.accessType = '0';

	if ( !config.ignoreGroups )
		config.ignoreGroups = [];

	if ( !config.accessGroups )
		config.accessGroups = 3;
	
	if ( !config.iconsLimit )
		config.iconsLimit = 3;
	
	if ( !config.cmdQuota )
		config.cmdQuota = 60;
		
	if ( !config.cmdQuotaText )
		config.cmdQuotaText = "Quota exceed. Please, wait %WAITTIME% sec";

	if ( !config.cmdText )
		config.cmdText = "[i]Usage examples to set icons:\n!icons 0 (clear)\n!icons 1\n!icons 1 2 3[/i]\n\n[b]All Icons[/b]\n%ICONS%\nYou have set [b]%CURRENT%/%MAX%[/b] icons";

	if ( !config.cmdRespondText )
		config.cmdRespondText = "Your icons updated";

	
		
	// print all configurations at start
	
	logDebug("=== CONFIGURATION START ===");
	
	logDebug("iconGroups:");
	logDebug(config.iconGroups);
	logDebug("accessType:" + config.accessType);
	if (config.accessType == '0')
	{
		logDebug("ignoreGroups:");
		logDebug(config.ignoreGroups);
	}
	else
	{
		logDebug("accessGroups:");
		logDebug(config.accessGroups);
	}
	
	logDebug("iconsLimit: " + config.iconsLimit);
	logDebug("cmdQuota: " + config.cmdQuota);
	logDebug("cmdQuotaText: " + config.cmdQuotaText);
	logDebug("cmdRespondText: " + config.cmdRespondText);

	logDebug("=== CONFIGURATION END ===");

   
	// handle !icons command
	event.on('chat', function(ev) {

		// 1) restrict command usage
		
		if (ev.client.isSelf())
			return;
		
		if ( !ev.text.startsWith(cmdName) )
			return;
		
		var userGroups = getUserGroups(ev.client);
		
		switch (config.accessType)
		{
			// all groups except ignored
			case '0':
				for (var i = 0; i < config.ignoreGroups.length; i++) {
					if ( userHasGroup(userGroups, config.ignoreGroups[i]) ) {
						logDebug("ignore " + ev.client.name() + " because he is in ignore group " + config.ignoreGroups[i]);
						return;
					}
				}
				break;
				
			// only specified groups
			case '1':
				var found = false;
				for (var i = 0; i < config.accessGroups.length; i++) {
					if ( userHasGroup(userGroups, config.accessGroups[i]) )
						found = true;
				}
				if (!found) {
					logDebug("ignore " + ev.client.name() + " because he is not in any of access groups");
					return;
				}
				break;
		}
		
		var serverGroups = getServerGroups();
		var serverGroupIcons = getServerGroupIcons(serverGroups);
		var userGroupIcons = getServerGroupIcons(userGroups);
		
		// 2) get arguments (icons to set)
		var tmpArgs = ev.text.replace(cmdName, '').split(' ');
		var indexes = [];
		var groupids = [];
		for (var i = 0; i < tmpArgs.length; i++)
		{
			var idx = tmpArgs[i].trim();
			if (!isNumeric(idx))
				continue;
			if (!idx && idx != '0')	// support arg = 0 to clear icons
				continue;
			// id is greater than server groups count
			if ( idx > serverGroupIcons.length )
				continue;
			if (indexes.length + 1 > config.iconsLimit)
				continue;
			indexes.push(idx);
			if (idx > 0) 			// support arg = 0 to clear icons
				groupids.push( serverGroupIcons[idx-1].id() );
		}
		

		// 3)
		// with arguments
		if (indexes.length)
		{
			logDebug("got command with " + indexes.length + " filtered args: " + indexes.join(' '));
			var used = false;
			
			// check quota
			var elapsed = quota.get( ev.client.id() );
			if ( elapsed > 0 ) {
				logDebug("quota exceed for " + ev.client.name() + ", wait " + elapsed);
				var msg = config.cmdQuotaText.replace("%WAITTIME%", elapsed);
				ev.client.chat(msg);
				return;
			}
		
			// unset other icons from a user, which are not in command args
			userGroupIcons.forEach((ug) => {
				if ( !groupids.includes(ug.id()) ) {
					logDebug("remove user from group " + ug.name() + " (" + ug.id() + ")");
					ev.client.removeFromServerGroup(ug);
					used = true;
				}
			});
			
			// add new icons
			var iconCount = 0;
			indexes.forEach((idx) => {
				if (idx <= 0)		// support arg = 0 to clear icons
					return;
				
				// check limit
				if (iconCount >= config.iconsLimit)
					return;
				iconCount++;
				
				var ug = serverGroupIcons[idx - 1];
				// if user already has this group then ignore
				if ( serverHasGroup(userGroups, ug.id()) ) {
					return;
				}
				logDebug("add user group " + ug.name() + " (" + ug.id() + ")");
				ev.client.addToServerGroup(ug);
				used = true;
			});
			ev.client.chat(config.cmdRespondText);
			
			if (used) {
				quota.set( ev.client.id() );
			}
				
		}
		// without arguments
		else
		{
			logDebug("got command without args");
		
			var msg = "\n" + config.cmdText;
			var iconList = displayIconList(userGroups);
			msg = msg.replace("%ICONS%", iconList);
			msg = msg.replace("%CURRENT%", userIconsCount(userGroups));
			msg = msg.replace("%MAX%", config.iconsLimit);
			
			ev.client.chat(msg);
		}

	});
	
	
	var quota = {
		lastUsage: [],
		
		set: function(clientId){
			this.lastUsage[clientId] = unixtime();
			logDebug("set quota " + this.lastUsage[clientId]);
		},
		
		get: function(clientId) {
			logDebug("get quota " + this.lastUsage[clientId]);
			if (this.lastUsage[clientId] == undefined)
				return 0;
			var diff = unixtime() - this.lastUsage[clientId];
			logDebug("quota diff " + diff);
			var elapsed = config.cmdQuota - diff;
			if (elapsed <= 0) {
				// remove from array
				this.lastUsage.splice(clientId, 1)
				return 0;
			}
			return elapsed;
		}
	};


	function displayIconList(userGroups) {
		var output = "";
		var serverGroups = getServerGroups();
		var serverGroupIcons = getServerGroupIcons(serverGroups);

		var idx = 0;
		serverGroupIcons.forEach((g) => {
			idx++;
			// highlight group which user have
			if ( serverHasGroup(userGroups, g.id()) )
				output += '[color=green][b]';

			output += idx + ". " + g.name();
			
			if ( serverHasGroup(userGroups, g.id()) )
				output += ' [/b][/color][+]';
			output += "\n";
		});
		
		return output;
	}
	
	function serverHasGroup(groups, findGroupId) {
		var hasGroup = false;
		groups.forEach((ug) => {
			if ( ug.id() == findGroupId )
				hasGroup = true;
		})
		return hasGroup;
	}
	
	
	function userIconsCount(userGroups) {
		var serverGroups = getServerGroups();

		var count = 0;
		serverGroups.forEach((g) => {
			// must be in defined groups
			if ( !config.iconGroups.includes(g.id()) )
				return;
			
			var hasUserGroup = serverHasGroup(userGroups, g.id());
			if (hasUserGroup)
				count++;
		});
		return count;
	}
	
	// filter server groups and return only which are icons
	function getServerGroupIcons(groups) {
		var serverGroupIcons = [];
		groups.forEach((g) => {
			// must be in defined groups
			if ( !config.iconGroups.includes(g.id()) )
				return;
			
			serverGroupIcons.push(g);
		});
		return serverGroupIcons;
	}
	
	function getServerGroups() {
		var serverGroups = backend.getServerGroups();
		serverGroups.sort(groupCompare);
		return serverGroups;
	}
		
	function getUserGroups(client) {
		var userGroups = client.getServerGroups();
		userGroups.sort(groupCompare);
		return userGroups;
	}

	
	function groupCompare( a, b ) {
		if ( a.id() < b.id() ){
			return -1;
		}
		if ( a.id() > b.id() ){
			return 1;
		}
		return 0;
	}
	
	function unixtime() {
		var time = new Date().getTime();
		return Math.floor(time / 1000);
	}
	
	function isNumeric(n) {
		return !isNaN(parseFloat(n)) && isFinite(n);
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
