function(bot, twitchbot) {
	var COINNAME = 'labbecoin(s)';
	var STARTINGAMOUNT = 100;
	var LIMIT = 60000; // in milliseconds
	var EMOTICONS = ['Kappa', 'Keepo', 'FrankerZ', 'BibleThump', 'FailFish'];
	var WIN_MULTIPLIER = 2;

	var limits = {};
	var players = twitchbot.loadJSON('slots.json');
	var randNum = function() {return 0|Math.random()*EMOTICONS.length};
	var numToEmoticon = function(n) {return EMOTICONS[n]};
	var saveSlots = function() {twitchbot.saveJSON('slots.json', players, true)};

	bot.addCommand('@slots', function(o) {
		var player = o.from;
		var amount = +o.args[0];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0)
			return player + ': Use the command like: !slots [amount to gamble]';

		if(!limits[player]) limits[player] = 0;
		var time = limits[player];
		var now = Date.now();
		if(now - time < LIMIT)
			return player + ': You have to wait ' + (0|(LIMIT - (now - time))/1000) + ' more seconds before you can play again.';
		limits[player] = now;

		if(typeof players[player] == 'undefined') players[player] = STARTINGAMOUNT;
		var playerAmount = players[player];
		if(playerAmount <= 0 || playerAmount < amount) return player + ": You don't have enough " + COINNAME + ".";
		
		players[player] -= amount;
		
		var r = [1, 2, 3].map(randNum);
		var e = r.map(numToEmoticon).join(' ');
		var s;
		
		if(r[0] == r[1] && r[1] == r[2]) {
			players[player] += amount * WIN_MULTIPLIER;
			s = player + ": " + e + ", you won " + (amount * WIN_MULTIPLIER) + " " + COINNAME + "!";
		} else
			s = player + ": " + e + ", you lost " + amount + " " + COINNAME + "!";
		
		saveSlots();
		return s;
	});

	bot.addCommand('@give', function(o) {
		var player = o.from;
		var to = o.args[0].toLowerCase();
		var amount = +o.args[1];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0 || player == to)
			return player + ': Use the command like: !give [user] [amount]';

		if(typeof players[player] == 'undefined') players[player] = STARTINGAMOUNT;
		var playerAmount = players[player];
		if(playerAmount < amount) return player + ": You don't have enough " + COINNAME + ".";
		
		if(typeof players[to] == 'undefined') players[to] = STARTINGAMOUNT;

		players[player] -= amount;
		players[to] += amount;

		saveSlots();

		return player + ": You gave " + amount + " " + COINNAME + " to " + to + "!";
	});

	bot.addCommand('@coins', function(o) {
		var player = o.from;
		
		if(typeof players[player] == 'undefined') players[player] = STARTINGAMOUNT;

		return player + ": You have " + (players[player]) + " " + COINNAME + ".";
	});

	bot.addCommand('add', function(o) {
		var player = o.from;
		var to = o.args[0].toLowerCase();
		var amount = +o.args[1];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0)
			return player + ': Use the command like: !give [user] [amount]';
		
		if(typeof players[to] == 'undefined') players[to] = STARTINGAMOUNT;

		players[to] += amount;

		saveSlots();

		return player + ": You added " + amount + " " + COINNAME + " to " + to + "!";
	});
}
