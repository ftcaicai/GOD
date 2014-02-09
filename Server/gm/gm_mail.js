
// 注册一个GM消息。
global.GMManager.Register('/send_mail', function(params, response) {
	var sender = params.sender || global.SYSTEM_NAME;
	var to = params.to;
	var title = params.title || params.content;
	var content = params.content;
	var item = parseInt(params.item) || 0;
	var gold = parseInt(params.gold) || 0;
	var gem = parseInt(params.gem) || 0;
	if (to === undefined || content === undefined)
		return response.simpleJSON({ error: "InvalidParam" });

	global.MailManager.SendTo(sender, to, title, content, item, gold, gem, function(err, ret) {
		if (err)
			response.simpleJSON({ error: err });
		else
			response.simpleJSON({ data: ret });
	});
});