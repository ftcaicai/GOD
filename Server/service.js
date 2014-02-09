// system build-in & plugins
var Http = require('http');
var MongoDb = require('mongodb');
var URL = require('url');
var Crypto = require('crypto');
var WebSocketServer = require('ws').Server;
var Util = require('util');
var FS = require('fs');

// custom moduals.
require('./common');
require('./gm_mgr');
require('./city_mgr');
require('./account_mgr');
require('./user_mgr');
require('./skill_mgr');
require('./command_mgr');
require('./friend_mgr');
require('./pvp_mgr');
require('./quest_mgr');
require('./record_manager');

var mService = {
    UrlServer: null,
    HttpServer: null,
	WSServer: null,
    Database: null,
	Config: null
};
global.Service = mService;
global.Status = {
	StartTime: new Date(),
}; // 服务器的一些状态。

function StartDatabase(callback) {
	var url = Util.format("mongodb://%s:%s@%s:%d/%s",
		mService.Config.Database.User,
		mService.Config.Database.Password, 
		mService.Config.Database.IP, 
		mService.Config.Database.Port, 
		mService.Config.Database.DB);	
	console.LOG("Connect: " + url);
	MongoDb.MongoClient.connect(url, mService.Config.Database.Param, function(err, db) {
		if (err) {
			console.LOG('Fail to connect database:' + err);
			throw err;
		}

		mService.Database = db;		
		console.LOG('Connect to database sucess!!!');
		callback(err, db);
    });
}

function StartHttp(handlers) {
	// start http.
	mService.HttpServer = Http.createServer(function (request, response) {
		global.GMManager.OnGMRequest(request, response);
	});
	mService.HttpServer.listen(mService.Config.Http.Port);
	
	// the websocket server startup
	mService.WSServer = new WebSocketServer({server: mService.HttpServer});
	mService.WSServer.on('connection', function (connection) {
		connection.on('message', function (message) {
			global.CommandManager.Process(connection, message, handlers);
		});
    });

	mService.WSServer.on('close', function(connection) {
	});
}

// log日志的一些操作。
function HookLog() {
	var gLastHour = undefined;
	var gLogFileStream = undefined;
	var gLogToFile = (require('os').platform() === 'linux');
	var gLogFile = mService.Config.LogFile || 'log/node.log';
	
	console.LOG = function() {
	    var now = new Date();
	    var msg = Util.format('%d-%d-%d %d:%d:%d: %s',
			now.getFullYear(),
			now.getMonth() + 1,
			now.getDate(),
			now.getHours(),
			now.getMinutes(),
			now.getSeconds(),
			Util.format.apply(this, arguments));
		if (gLogToFile) {
			if (!gLogFileStream || now.getHours() != gLastHour) {
				gLastHour = now.getHours();
				if (gLogFileStream) gLogFileStream.end();
				var logFileName = Util.format('%s.%d-%d-%d-%d',
					gLogFile,
					now.getFullYear(),
					now.getMonth() + 1,
					now.getDate(),
					now.getHours());
				gLogFileStream = FS.createWriteStream(logFileName);
				var watchFileName = logFileName.replace(/^.*[\\\/]/, '');
				FS.unlinkSync(gLogFile);
				FS.symlinkSync(watchFileName, gLogFile);
			}
			gLogFileStream.write(msg + '\n');
		}
		else
			console.log(msg);
	}

	console.ERROR = function() {
		var msg = 'ERROR: ' + Util.format.apply(this, arguments);
		console.LOG(msg);
	}
}

// hook进程的一些事件。
function HookProcessEvents(publish) {
	// 服务器退出的时候。
	process.on('exit', function() {
		global.UserManager.OnExit();
	    console.LOG('About to exit.');
	});

	// 仅在发布版本的时候才会处理。
	if (publish) {
		process.on('uncaughtException', function(err) {
			console.ERROR("uncaughtException: " + err);
		});
	}
}

exports.Start = function(handlers, configs) {
	mService.Config = configs;
	mService.Handlers = handlers;
	
	// hook logs.
	HookLog();

	HookProcessEvents(configs.Publish);

    // start the database.
    StartDatabase(function (err, db) {
		if (err) return;

		// load the toplist.
		global.TopListManager.LoadFromDb();
		global.CommandManager.Init();
		global.RecordManager.Init(db);
		
		// start the http server.
		StartHttp(handlers);
	});
}

