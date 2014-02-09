// just like includes.
var Http = require('http');
var Daemon = require('daemon');
var Util = require('util');
var URL = require('url');
var WebSocketServer = require('websocket').server;
var UDPServer = require('./base/udp_server.js');

// constant values.
const USER_CREATE_GAME = 10;
const USER_JOIN_GAME = 11;
const USER_LEAVE_GAME = 12;
const USER_MESSAGES = 13;
const SERVER_RESPONSE = 20;
const SERVER_MASTER_CHANGE = 21;

// server response values.
const RESPONSE_OK = 0;
const RESPONSE_GAME_ALREAY_EXIST = 1;
const RESPONSE_GAME_NOT_EXIST = 2;
const RESPONSE_USER_ALREADY_EXIST = 10;
const RESPONSE_USER_NOT_EXIST = 11;
const RESPONSE_INCORRECT_PASS = 12;
const RESPONSE_USER_NOT_INGAME = 13;
const RESPONSE_UNKOWN_ERROR = 20;

// variables.
var mService = {
	Port: 4069,
    HttpServer: null,
	WSServer: null,
	GameManager: null,
};

function LOG(msg) {
	var now = new Date();
	var fullMsg = Util.format('%d-%d-%d %d:%d:%d: %s',
			now.getFullYear(),
			now.getMonth() + 1,
			now.getDate(),
			now.getHours(),
			now.getMinutes(),
			now.getSeconds(),
			msg);
	console.log(fullMsg);
}

function GameManager() {
	var mGames = {};
	var mValidGameId = 1024;
	var mGMHandlers = [];

	this.CreateGame = function(connection, buff) {
		var gameId = buff.readUInt32LE(1);
		var gamePass = buff.readUInt32LE(5);
		mValidGameId = Math.max(mValidGameId, gameId) + 1;

		LOG('CreateGame with id: ' + gameId + ' gamePass: ' + gamePass);

		if (mGames[gameId] != null) {
			LOG('FAILED because game with id: ' + gameId + ' already exist');
			return RESPONSE_GAME_ALREAY_EXIST;
		}

		var game = new function() {
			var mGameId = gameId;
			var mGamePass = gamePass;
			var mPlayers = [];
			var mSelf = this;
			var mMaster = null;

			this.GameId = function() { return mGameId; }

			this.IndexByConnection = function(connection) {
				for (var i = 0; i < mPlayers.length; i++) {
					if (mPlayers[i].Connection == connection)
						return i;
				}
				return -1;
			}

			this.AddPlayer = function(connection, userId) {
				var player = {
					Connection: connection,
					UserId: userId };
				mPlayers.push(player);
				return player;
			}

			this.Leave = function(connection, buff) {
				var index = mSelf.IndexByConnection(connection);
				if (index == -1)
					return RESPONSE_USER_NOT_EXIST;

				// we need tell the others: some one leaved.
				var player = mPlayers[index];
				LOG('Leave game [' + mGameId + '] player [' + player.UserId + '] manual: ' + (buff != null));
				if (buff != null) {
					// remove the closing listener while manually close.
					connection.removeListener('close', mSelf.OnClose);
				}
				else {
					// build and send leave messages.
					var buff = new Buffer(5);
					buff.writeUInt8(USER_LEAVE_GAME, 0);
					buff.writeUInt32LE(player.UserId, 1);
				}
				mSelf.Broadcast(connection, buff, 100);

				// remove player from the array.
				mPlayers.splice(index, 1);

				// if there is no connection left, destroy the game.
				if (mPlayers.length == 0)
					mService.GameManager.DestroyGame(mGameId);

				return RESPONSE_OK;
			}
			
			// player close auto.
			this.OnClose = function(closeReasonCode, closeDescription) {
				mSelf.Leave(this, null);
			}

			this.Join = function(connection, gamePass, userId, buff) {
				// check the game pass
				if (mGamePass != gamePass)
					return RESPONSE_INCORRECT_PASS;

				// check the connection exist.
				var index = mSelf.IndexByConnection(connection);
				if (index != -1)
					return RESPONSE_USER_ALREADY_EXIST;

				// add player.
				var player = mSelf.AddPlayer(connection, userId);
				LOG('Join game: [' + mGameId + '] palyer: [' + userId + '] num:' + mPlayers.length);

				connection.once('close', mSelf.OnClose);
				
				// broadcast all message, we nedd [ack] and try 10 times.
				mSelf.Broadcast(connection, buff, 100);

				// save the game to connection [for cache fetch]
				connection.Game = mSelf;

				// return success.
				return RESPONSE_OK;
			}

			this.Broadcast = function(connection, buff, ack, order) {
				if (buff === null)
					return RESPONSE_UNKOWN_ERROR;

				mPlayers.forEach(function(player) {
					if (player.Connection != connection)
						player.Connection.sendBytes(buff, ack, order);
				});
				return RESPONSE_OK;
			}
		}

		// master join the game.
		//game.Join(connection, gamePass, buff);

		// destroy the game if already exist.
		this.DestroyGame(gameId);

		// save with the game id.
		mGames[gameId] = game;
		return RESPONSE_OK;
	}

	this.JoinGame = function(connection, buff){
		var gameId = buff.readUInt32LE(1);
		var game = mGames[gameId];
		if (game == null)
			return RESPONSE_GAME_NOT_EXIST;

		var gamePass = buff.readUInt32LE(5);
		var userId = buff.readUInt32LE(9);
		return game.Join(connection, gamePass, userId, buff);
	}

	this.LeaveGame = function(connection, buff){
		if (connection.Game === null)
			return RESPONSE_USER_NOT_INGAME;

		var gameId = connection.Game.GameId();
		var game = mGames[gameId];
		if (game === null)
			return RESPONSE_GAME_NOT_EXIST;

		return game.Leave(connection, buff);
	}

	this.DestroyGame = function(gameId) {
		LOG('DestroyGame: ' + gameId);
		var game = mGames[gameId];
		if (game === null) {
			LOG('gameId: ' + gameId + ' not found');
			return;
		}
		mGames[gameId] = null;
	}

	this.OnMessage = function(connection, buff) {
		if (connection.Game === null)
			return RESPONSE_USER_NOT_INGAME;
		return connection.Game.Broadcast(connection, buff);
	}
	
	this.OnGMRequest = function(request, response) {
		// 设置一个简单的返回值。
		response.simpleJSON = function (obj) {
			response.writeHead(200, { "Content-Type": "text/plain" });
			response.end(JSON.stringify(obj), 'utf8');
		};
		
		var url = URL.parse(request.url, true);
		var func = mGMHandlers[url.pathname];
		if (func == null)
			return response.simpleJSON({ error: "Not found fot path:" + url.pathname });

		try {
			func(url.query, response);
		}
		catch (err) {
			response.simpleJSON({ error: "Exception: " + err });
		}
	}
	
	mGMHandlers['/alloc_id'] = function(params, response) {
		response.simpleJSON({ data: mValidGameId++ });
	}
	
	mGMHandlers['/valid_id'] = function(params, response) {
		response.simpleJSON({ data: mValidGameId });
	}
}

// ParseClientData
function ParseClientData(connection, buff) {
	if (buff.length <= 0) {
		LOG('we got an empty data request.');
		return false;
	}

	try	{
		var response = RESPONSE_OK;
		switch (buff[0]) {
		case USER_CREATE_GAME:
			response = mService.GameManager.CreateGame(connection, buff);
			break;
		case USER_JOIN_GAME:
			response = mService.GameManager.JoinGame(connection, buff);
			break;
		case USER_LEAVE_GAME:
			response = mService.GameManager.LeaveGame(connection, buff);
			break;
		case USER_MESSAGES:
			response = mService.GameManager.OnMessage(connection, buff);
			return true; // the message forward desnot need response.
		default:
			LOG('unkown op code for buffer.');
			return false;
		}

		// send the response bytes.
		var data = new Buffer([SERVER_RESPONSE, response]);
		connection.sendBytes(data);
	}
	catch (err) {
		LOG('process buff failed: ' + err);
		return false;
	}

	return true;
}


// 启动HTTP服务器。
function StartHttp() {
	// the http server startup
    mService.HttpServer = Http.createServer(function (request, response) {
		mService.GameManager.OnGMRequest(request, response);
	});
	mService.HttpServer.listen(mService.Port);
	
	// the websocket server startup
	mService.WSServer = new WebSocketServer({httpServer: mService.HttpServer});
	mService.WSServer.on('request', function (request) {
		// accept this connection and process messages.
		var connection = request.accept(null, request.origin);
		connection.on('message', function (message) {
			if (message.type == 'binary')
				ParseClientData(connection, message.binaryData);
		});
    });
}

// 创建并且启动UDP服务器。
function StartUdp() {
	mService.UDPServer = UDPServer.createServer();
	mService.UDPServer.listen(mService.Port);

	// 挂一些函数到UDP的连接上。
	mService.UDPServer.on('request', function(data, remote) {
		// welcome this connection.
		var connection = mService.UDPServer.accept(data, remote);
		console.log('接受连接：' + remote.address + ":" + remote.port);
		
		connection.on('message', function (data) {
			ParseClientData(connection, data);
		});
		
		connection.on('close', function(reason) {
			console.log('关闭连接: ' + connection.remote.address + ":" + connection.remote.port);
		});
	});
}

function StartService() {
	// build the game manager.
	mService.GameManager = new GameManager();
	StartHttp();
	StartUdp();
}

// 在linux模式下以后台运行。
if (true) {
	var fs = require('fs');
	require('daemon')( {
		stdout: fs.openSync('./log/pvp.log', 'a'),
		stderr: fs.openSync('./log/pvp_err.log', 'a'),
	});
}

StartService();
