
// 全局服务器～
if (global.GlobalServer == undefined) global.GlobalServer = new function() {
	this.Accounts = {};
	this.Users = {};
	
	// 在线切换的状态～。
	this.Online = function(params, response, worker_id) {
		if (!params || !params.account || !params.user)
			return response.Error("InvalidParams");
		
		var accountInfo = this.Accounts[params.account];
		if (accountInfo && accountInfo.online)
			return response.Error("AccountAlreadyOnline");

		var userInfo = this.Users[params.user];
		if (userInfo && userInfo.online)
			return response.Error("UserAlreadyOnline");
		
		if (!accountInfo) accountInfo = this.Accounts[params.account] = {};
		accountInfo.online = true;
		accountInfo.worker_id = worker_id;
		
		if (!userInfo) userInfo = this.Users[params.user] = {};
		userInfo.online = true;
		userInfo.worker_id = worker_id;
	}
	
	this.IsOnline = function(params) {
	}
	
	this.SlaveExit = function(params, response, worker_id) {
		
	}
	
	this.Handle = function(msg) {
		var func = this[msg.cmd];
		if (!func) return console.error("未能识别的命令：" + msg.cmd);
		
		msg.Error = function(err) {
			global.MasterServer.Send({
				WORKER_ID: msg.WORKER_ID,
				REQUEST_ID: msg.REQUEST_ID,
				ret: { err: err }
			});
		}
		
		msg.Data = function(data) {
			global.MasterServer.Send({
				WORKER_ID: msg.WORKER_ID,
				REQUEST_ID: msg.REQUEST_ID,
				ret: { data: data }
			});
		}
		
		func(msg.params, msg, msg.WORKER_ID);
	}
}
