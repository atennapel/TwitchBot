/* Slot machine plugin for TwitchBot
 * @author: Albert ten Napel
 * @version: 0.6
 *
 * Adds a simple slots machine to the bots. User can gamble coins and three random TwitchFaces will be shown.
 * If all the faces are equal the user wins more coins.
 *
 * 	Options: {
 *		coinName: name of the coin,
 *		limit: the time (in milliseconds) a player has to wait before he can play again,
 *  	faces: an array of twitch faces, to use for the slots,
 *		winMultiplier: how much coins the player receives when he wins (gets multiplied with the input coins),
 *		whisper: use whispers when responding to users (except on winning)
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
	var LIMIT = typeof config.limit == 'number'? config.limit: 60000;
	var EMOTICONS = config.faces || ['Kappa', 'Keepo', 'FrankerZ', 'BibleThump', 'FailFish'];
	var WIN_MULTIPLIER = config.winMultiplier || 10;
	var WHISPER = config.whisper || false;

	var randNum = function() {return 0|Math.random()*EMOTICONS.length};
	var numToEmoticon = function(n) {return EMOTICONS[n]};
	var working = true;

	function checkPlayer(p) {
		return bot.getData(p, {
			limit: 0,
			coins: 100,
			coinsspent: 0,
			games: 0,
			wins: 0,
			coinswon: 0,
			coinslost: 0,
			coinsgiven: 0,
			coinsreceived: 0
		});
	}

	function whisper(player, msg) {
		if(WHISPER) bot.whisper(player, msg);
		else return player + ': ' + msg;
	}

	bot.addCommand('@slots', function(o) {
		if(!working) return;

		var player = o.from;
		var data = checkPlayer(player);
		var amount = +o.args[0];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0)
			return whisper(player, 'Use the command like: !slots [amount to gamble, positive number]');

		var time = data.limit;
		var now = Date.now();
		if(now - time < LIMIT)
			return whisper(player, 'You have to wait ' + (0|(LIMIT - (now - time))/1000) + ' more seconds before you can play again.');
		data.limit = now;

		var playerAmount = data.coins;
		if(playerAmount <= 0 || playerAmount < amount) return whisper(player, "You don't have enough " + COINNAME + ".");
		
		data.coins -= amount;
		data.coinsspent += amount;
		data.games++;
		
		var r = [1, 2, 3].map(randNum);
		var e = r.map(numToEmoticon).join(' ');
		var s;
		
		if(r[0] == r[1] && r[1] == r[2]) {
			var winamount = amount * WIN_MULTIPLIER;
			data.coins += winamount;
			data.wins++;
			data.coinswon += winamount;
			return player + ": " + e + " , you won " + winamount + " " + COINNAME + "!";
		} else {
			data.coinslost += amount;
			return whisper(player, e + " , you lost " + amount + " " + COINNAME + "!");
		}
	});

	bot.addCommand('@give', function(o) {
		var player = o.from;
		var data = checkPlayer(player);
		var to = o.args[0];
		var dataTo = checkPlayer(to);

		var amount = +o.args[1];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0 || player == to)
			return whisper(player, 'Use the command like: !give [user] [amount, positive number]');

		var playerAmount = data.coins;
		if(playerAmount < amount) return whisper(player, "You don't have enough " + COINNAME + ".");
		
		data.coins -= amount;
		data.coinsgiven += amount;
		dataTo.coins += amount;
		dataTo.coinsreceived += amount;

		return player + ": You gave " + amount + " " + COINNAME + " to " + to + "!";
	});

	bot.addCommand('@coins', function(o) {
		var player = o.from;
		var data = checkPlayer(player);
		return whisper(player, "You have " + (data.coins) + " " + COINNAME + ".");
	});

	bot.addCommand('@stats', function(o) {
		var player = o.from;
		var po = checkPlayer(player);

		var rest = o.rest.trim();

		if(rest)
			return whisper(player, rest.split(/\s+/g).map(function(x) {return po[x] + ' ' + x}).join(', '));

		return whisper(player, 
			po.wins + '/' + po.games + ' wins (' + (0|(po.wins/po.games)*100) + '%), ' +
			po.coinsspent + ' coins spent, ' + 
			po.coinswon + ' coins won, ' + 
			po.coinslost + ' coins lost, ' + 
			po.coinsgiven + ' coins given, ' + 
			po.coinsreceived + ' coins received.');
	});
	bot.addCommand('@allstats', function(o) {
		var po;
		var rest = o.rest.trim();
		if(rest) {
			po = {};
			for(var i = 0, t = rest.split(/\s+/g), l = t.length; i < l; i++)
				po[rest[i]] = 0;
		} else po = {
			coins: 0,
			wins: 0,
			games: 0,
			coinsspent: 0,
			coinswon: 0,
			coinslost: 0,
			coinsgiven: 0,
			coinsreceived: 0
		};

		var players = bot.getAllData();

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
		var players = bot.getAllData();
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
		var player = o.from;
		var to = o.args[0];
		var data = checkPlayer(to);
		var amount = +o.args[1];
		if(!isNaN(amount)) amount |= 0;	
		if(!amount || isNaN(amount) || amount <= 0)
			return whisper(player, 'Use the command like: !give [user] [amount, positive number]');
		
		data.coins += amount;

		return whisper(player, "You added " + amount + " " + COINNAME + " to " + to + "!");
	});

	bot.addCommand('turnoffslots', function() {working = false});
	bot.addCommand('turnonslots', function() {working = true});
}
