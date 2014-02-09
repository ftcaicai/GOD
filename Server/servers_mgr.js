
var HTTP = require('http');
var URL = require('url');
var UTIL = require('util');
var QUERYSTRING = require('querystring');

const PATH_GET_USER_INFO = "/get_user_info";

// 包装的HttpGet函数，参数为完整的http字串
// callback(error, ret);
function HttpGet(options, callback) {
	if ('string' === typeof options)
		options = URL.parse(options);
	HTTP.get(options, function(response) {
		response.on('data', function(chuck) {
			callback(undefined, toString(chuck));
		});
	}).on('error', function(e) {
		callback(e.message);
	});
}

// 服务器间的管理
// 若存在多个服务器的情况下，服务器和服务器之间需要一些交互
// 比如离线pvp里面需要获取到其他服务器上的玩家数据。
// 服务器的配置如下：
// {
//	'1': { host: 'mobile.frozenpeak.net', port: 3069 }
//	'2': { host: 'mobile.frozenpeak.net', port: 3070 }
// }
if (global.ServersManager === undefined) global.ServersManager = new function() {
	var mServerList = {};

	// 从配置表里面加载服务器的列表信息。
	this.Load = function(callback) {
		var serverInfoUrl = global.Service.Config.Servers;
		HttpGet(serverInfoUrl, function(err, ret) {
			if (err) {
				callback(err);
				return;
			}
			mServerList = JSON.parse(ret);
			callback(undefined, "LoadSuccess");
		});
	}
	
	// 跨服请求数据。
	this.RequestFromServer = function(id, pathname, query, callback) {
		var server = mServerList[server];
		if (server === undefined) {
			callback('ServerNotFound');
			return;
		}
		
		if ('object' === typeof query) query = QUERYSTRING.stringify(query);
		var options = {
			host: server.host,
			port: server.port,
			path: pathname + "?" + query,
		};
		
		// 通过http的get请求去获取其他服务器的返回值。
		HttpGet(options, function(error, ret) {
			// http请求包含错误。
			if (error) {
				callback(error);
				return;
			}
			
			// 正常情况下会返回其他服务器的信息，是字符格式的json代码。
			var retObj = JSON.parse(ret);
			if (retObj === undefined || 
				(retObj.error === undefined && retObj.data === undefined)) {
				console.LOG("跨服返回信息错误，不是合法的结构：" + ret);
				response.simpleJSON(200, {error: "InvalidResponse"});
				return;
			}
			
			callback(retObj.error, retObj.data);
		});
	}
	
	// 跨服获取玩家的信息。
	// id为服务器的id号
	// user为key
	this.GetUserInfo = function(id, user, callback) {
		RequestFromServer(id, PATH_GET_USER_INFO, { user: user }, callback);
	}
	
	// 注册一个GM消息[用于服务器之间的通讯]。
	// 目前不支持查找数据库，只能获取到在线玩家的信息。
	global.GMManager.Register(PATH_GET_USER_INFO, function(params, response) {
		var user = params.user;
		if (params.user === undefined) {
			response.simpleJSON({error: "InvalidParam"});
			return;
		}
		
		var userObj = global.UserManager.Find(user);
		if (userObj === undefined) {
			response.simpleJSON({error: "UserNotOnline"});
			return;
		}
		
		var data = {};
		userObj.Fill(data, true, true); // onlyInfo, onlyEquip
		response.simpleJSON({data: data}); // 服务器交互，不需将data转string
	});
}
