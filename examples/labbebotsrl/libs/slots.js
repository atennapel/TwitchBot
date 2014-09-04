/* Slot machine lib for TwitchBot
 * @author: Albert ten Napel
 * @version: 0.2
 *
 * 	Options: {
 *		coinName: name of the coin,
 *		startingAmount: the amount of coins players start out with,
 *		limit: the time (in milliseconds) a player has to wait before he can play again,
 *  	faces: an array of twitch faces, to use for the slots,
 *		winMultiplier: how much coins the player receives when he wins (gets multiplied with the input coins),
 *		
 *		saveToFile: whether to save and load the player data to file,
 *		file: the file to use,
 *		saveInInterval: whether to save every so often,
 *		saveTime: if saveInInterval is true, how often to save in milliseconds
 *	}
 *
 *	Free commands:
 *		slots [coin amount]: gamble [coin amount] coins.
 *		give [player] [coin amount]: give another [player] [coin amount] of your own coins.
 *		coins: returns the amount of coins the player has.
 *		stats: returns some statistics of the player.
 *		allstats: returns statistics for all players.
 *		ranking: shows a top 3 for a particular statistic.
 *
 *	Mod commands:
 *		turnoffslots: make the free slot commands inactive.
 *		turnonslots: make the free slot commands active.
 *		add [player] [coin amount]: add [coin amount] coins to a [player].
 */
function(bot, twitchbot) {
	var config = bot.config.slots || {};

	var COINNAME = config.coinName || 'coin(s)';
	var STARTINGAMOUNT = typeof config.startingAmount == 'number'? config.startingAmount: 100;
	var LIMIT = typeof config.limit == 'number'? config.limit: 60000;
	var EMOTICONS = config.faces || ['Kappa', 'Keepo', 'FrankerZ', 'BibleThump', 'FailFish'];
	var WIN_MULTIPLIER = config.winMultiplier || 10;

	var FILE = config.file || 'slots.json';
	var SAVE_TO_FILE = config.saveToFile || false;
	var SAVE_IN_INTERVAL = config.saveInInterval || false;
	var SAVE_TIME = config.saveTime || 60*1000;

	var props = {
		wins: true,
		games: true,
		coinsspent: true,
		coinswon: true,
		coinslost: true,
		coinsgiven: true,
		coinsreceived: true
	};
	var limits = {};
	var players = {};
	if(SAVE_TO_FILE) players = twitchbot.loadJSON(FILE);
	var randNum = function() {return 0|Math.random()*EMOTICONS.length};
	var numToEmoticon = function(n) {return EMOTICONS[n]};
	var checkPlayer = function(player) {
		if(typeof players[player] == 'undefined')
			players[player] = {
				coins: STARTINGAMOUNT,
				wins: 0,
				games: 0,
				coinsspent: 0,
				coinswon: 0,
				coinslost: 0,
				coinsgiven: 0,
				coinsreceived: 0
			};
	};
	var working = true;

	if(SAVE_TO_FILE) {
		bot.onExit(function() {twitchbot.saveJSON(FILE, players)});
		if(SAVE_IN_INTERVAL)
			setInterval(function() {twitchbot.saveJSON(FILE, players)}, SAVE_TIME);
	}

	bot.addCommand('@slots', function(o) {
		if(!working) return;

		var player = o.from.toLowerCase();
		var amount = +o.args[0];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0)
			return player + ': Use the command like: !slots [amount to gamble, positive number]';

		if(!limits[player]) limits[player] = 0;
		var time = limits[player];
		var now = Date.now();
		if(now - time < LIMIT)
			return player + ': You have to wait ' + (0|(LIMIT - (now - time))/1000) + ' more seconds before you can play again.';
		limits[player] = now;

		checkPlayer(player);
		var playerAmount = players[player].coins;
		if(playerAmount <= 0 || playerAmount < amount) return player + ": You don't have enough " + COINNAME + ".";
		
		players[player].coins -= amount;
		players[player].coinsspent += amount;
		players[player].games++;
		
		var r = [1, 2, 3].map(randNum);
		var e = r.map(numToEmoticon).join(' ');
		var s;
		
		if(r[0] == r[1] && r[1] == r[2]) {
			var winamount = amount * WIN_MULTIPLIER;
			players[player].coins += winamount;
			players[player].wins++;
			players[player].coinswon += winamount;
			return player + ": " + e + ", you won " + winamount + " " + COINNAME + "!";
		} else {
			players[player].coinslost += amount;
			return player + ": " + e + ", you lost " + amount + " " + COINNAME + "!";
		}
	});

	bot.addCommand('@give', function(o) {
		var player = o.from.toLowerCase();
		var to = o.args[0].toLowerCase();
		var amount = +o.args[1];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0 || player == to)
			return player + ': Use the command like: !give [user] [amount, positive number]';

		checkPlayer(player);
		var playerAmount = players[player].coins;
		if(playerAmount < amount) return player + ": You don't have enough " + COINNAME + ".";
		
		checkPlayer(to);

		players[player].coins -= amount;
		players[player].coinsgiven += amount;
		players[to].coins += amount;
		players[to].coinsreceived += amount;

		return player + ": You gave " + amount + " " + COINNAME + " to " + to + "!";
	});

	bot.addCommand('@coins', function(o) {
		var player = o.from.toLowerCase();
		checkPlayer(player);

		return player + ": You have " + (players[player].coins) + " " + COINNAME + ".";
	});

	bot.addCommand('@stats', function(o) {
		var player = o.from.toLowerCase();
		checkPlayer(player);
		var po = players[player];
		
		return player + ": " +
			po.wins + '/' + po.games + ' wins (' + (0|(po.wins/po.games)*100) + '%), ' +
			po.coinsspent + ' coins spent, ' + 
			po.coinswon + ' coins won, ' + 
			po.coinslost + ' coins lost, ' + 
			po.coinsgiven + ' coins given, ' + 
			po.coinsreceived + ' coins received.';
	});
	bot.addCommand('@allstats', function() {
		var po = {
			wins: 0,
			games: 0,
			coinsspent: 0,
			coinswon: 0,
			coinslost: 0,
			coinsgiven: 0,
			coinsreceived: 0
		};

		for(var pl in players)
			for(var k in po)
				po[k] += (players[pl][k] || 0)
		
		return po.wins + '/' + po.games + ' wins (' + (0|(po.wins/po.games)*100) + '%), ' +
			po.coinsspent + ' coins spent, ' + 
			po.coinswon + ' coins won, ' + 
			po.coinslost + ' coins lost, ' + 
			po.coinsgiven + ' coins given, ' + 
			po.coinsreceived + ' coins received.';
	});

	bot.addCommand('@ranking', function(o) {
		var type = o.args[0] || 'coins';
		if(!props[type])
			return 'The arguments for ranking must be one of: ' + Object.keys(props).join(', ');
		var a = Object.keys(players)
				.map(function(name) {return {name: name, val: players[name][type]}})
				.sort(function(a, b) {return b.val - a.val})
				.slice(0, 3);
		var v = {name: '*nobody*', val: 0};
		return 		'1. ' + (a[0] || v).name + ': ' + (a[0] || v).val +
						', 2. ' + (a[1] || v).name + ': ' + (a[1] || v).val +
						', 3. ' + (a[2] || v).name + ': ' + (a[2] || v).val;
	});

	bot.addCommand('add', function(o) {
		var player = o.from.toLowerCase();
		var to = o.args[0].toLowerCase();
		var amount = +o.args[1];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0)
			return player + ': Use the command like: !give [user] [amount, positive number]';
		
		checkPlayer(player);
		checkPlayer(to);

		players[to].coins += amount;

		return player + ": You added " + amount + " " + COINNAME + " to " + to + "!";
	});

	bot.addCommand('turnoffslots', function() {working = false});
	bot.addCommand('turnonslots', function() {working = true});
}
