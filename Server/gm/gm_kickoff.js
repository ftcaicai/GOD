
global.GMManager.Register('/kickoff', function(params, response) {
	if (params.account) {
		var connection = global.AccountManager.Find(params.account);
		if (!connection)
			return response.simpleJSON({ error: "AccountNotBind"});
		
		connection.close(1002, 'gm kickoff');
		return response.simpleJSON({ data: "KickOffSendSuccess"});
	}
	else if (params.user) {
		var user = global.UserManager.Find(params.user);
		if (!user)
			return response.simpleJSON({ error: "UserNotOnline"});
		
		var connection = user.connection;
		connection.close(1002, 'gm kickoff');
		return response.simpleJSON({ data: "KickOffSendSuccess"});
	}
	else
		response.simpleJSON({ error: "InvalidParams"});
});