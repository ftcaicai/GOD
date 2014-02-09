
var URL = require('url');

// GM管理器。
if (global.GMManager == null) global.GMManager = new function() {
	var mCollection = "gm_user";
	var mGMFunctions = [];

	this.Register = function(path, func) {
		if (mGMFunctions[path] !== undefined)
			console.ERROR('警告！！！已经被注册掉了：' + path);
		mGMFunctions[path] = func;
	}

	// 在服务器的入口那里检测
	this.OnGMRequest = function(request, response) {
		// 设置一个简单的返回值。
		response.simpleJSON = function (obj) {
			response.writeHead(200, { "Content-Type": "text/plain" });
			response.end(JSON.stringify(obj), 'utf8');
		};
		
		// 判断IP规则
		if (global.Service.Config.GM.AllowIp.indexOf(request.socket.remoteAddress) < 0) {
			response.simpleJSON({ error: 'Forbidden!!!' });
			console.LOG("拒绝GM请求：%s, 来自: %s", request.url, request.socket.remoteAddress);
			return;
		}
		console.LOG("获得GM请求：%s, 来自: %s", request.url, request.socket.remoteAddress);

        // 解析URL
		var url = URL.parse(request.url, true);
		var func = mGMFunctions[url.pathname];
		if (func != undefined) {
			try {
				func(url.query, response);
			} 
			catch (err) {
				response.simpleJSON({ error: err });
			}
		}
		else
			response.simpleJSON({ error: 'path:' + url.pathname + 'not found.' });
	}
}

// 这里加载gm的模块。
require('./gm/gm_broadcast');
require('./gm/gm_chat');
require('./gm/gm_getset');
require('./gm/gm_gm');
require('./gm/gm_mail');
require('./gm/gm_permission');
require('./gm/gm_status');
require('./gm/gm_user');
require('./gm/gm_record');
require('./gm/gm_shutdown');
require('./gm/gm_kickoff');
require('./gm/gm_time');
