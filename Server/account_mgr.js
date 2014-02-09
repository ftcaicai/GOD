
// 帐号管理器。
if (global.AccountManager === undefined) global.AccountManager = new function() {
	this.mAccounts = {};
	
	// 查找。
	this.Find = function(key) { return this.mAccounts[key]; }
	
	// 将已经在线的玩家踢掉。
	this.KickOff = function(id, reason) {
		var connection = this.mAccounts[id];
		if (!connection) return;
		
		// 玩家踢下线。
		if (connection.user)
			global.UserManager.LeaveGame(connection.user);
			
		// 帐号踢下线。
		if (connection.account)
			global.AccountManager.Logout(connection, connection.account);
			
		// 断开连接。
		connection.close(1002, reason);
	}
	
	// 登录
	this.Login = function(connection, id) {
		if (connection.account !== undefined)
			return "AccountAlreadyBind";
			
		// 将已经在线的玩家踢掉。
		if (this.mAccounts[id] !== undefined)
			this.KickOff(id, 'DuplicateLogin');

		// 注册上来。
		this.mAccounts[id] = connection;
		connection.account = id;
		
		// 绑定一个断线的回调。
		connection.once('close', function() {
			if (connection.account !== undefined)
				global.AccountManager.Logout(connection, connection.account);
		});
		
		return undefined;
	}
	
	// 重连
	this.ReLogin = function(connection, id) {
		return this.Login(connection, id);
	}
	
	// 注销
	this.Logout = function(connection, id) {
		if (connection.account === undefined)
			return "AccountNotBind";
			
		if (connection.account !== id)
			return "AccountNotMatch";
			
		if (this.mAccounts[id] !== connection)
			return "ConnectionNotMatch";

		delete this.mAccounts[id];
		delete connection.account;
		
		return undefined;
	}
}
