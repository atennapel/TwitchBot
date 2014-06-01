function(bot) {
	bot.addCommands(
		'startpoll', function(o) {
			var name = o.args[0];
			config.polls = config.polls || {};
			config.polls[name] = {};
			config.curpoll = name;
			return 'Started poll ' + name + '. Everybody can vote with !vote';
		},
		'stoppoll', function(o) {
			var name = o.args[0];
			config.curpoll = null;
			return 'Stopped poll ' + name + '.';
		},
		'showpoll', function(o) {
			var name = o.args[0], t = config.polls[name];
			var x = {};
			for(var k in t) {
				var v = t[k];
				if(typeof x[v] != 'number') x[v] = 0;
				x[v] += 1;
			}
			var a = Object.keys(x).map(function(k) {return [k, x[k]]}).sort(function(a, b) {return b[1] - a[1]}).slice(0, 3);
			return a.map(function(x, i) {return (i+1) + ': ' + x[0] + ' - ' + x[1]}).join(', ');
		},
		'@vote', function(o) {config.polls[config.curpoll][o.from] = o.rest.toLowerCase()}
	);
}
