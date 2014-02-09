
// 注册一个GM消息。
global.GMManager.Register('/broadcast', function(params, response) {
	var sender = params.sender || global.SYSTEM_NAME;
	var to = params.to;
	var msg = params.msg;
	var channel = parseInt(params.channel) || 0;
	if (msg === undefined)
		return response.simpleJSON({ error: "InvalidParam" });

	var error = global.ChatManager.Send(sender, channel, msg, to, global.USER_SEND_MSG);
	if (error)
		response.simpleJSON({ error: error });
	else
		response.simpleJSON({ data: "SendSuccess" });
});
