
// 聊天管理器。
if (global.ChatManager == null) global.ChatManager = new function() {
	var mMessages = [];
	
	// 玩家发送聊天信息。
	this.Send = function(user, channel, msg, target, id) {
		// 组合成一个结构。
		var message = {
			user: user,
			channel: channel,
			msg: msg,
			time: (new Date()).getTime(),
		};
		// 转换为数据并且发送给客户端。
		var buff = global.CommandManager.Build(undefined, message, "ChatMessage", id);
		
		// 对应频道的处理。
		switch (channel) {
			// 世界频道的聊天。
			case global.CHANNEL_WORLD: {
				// 添加到消息列表。
				if (id != global.SYSTEM_BROADCAST) {
					mMessages.push(message);
					if (mMessages.length > global.MAX_CHAT_MESSAGE)
						mMessages.shift();
				}
				
				// 由于默认目前为世界频道聊天，当人数过多的时候
				// 世界频道的聊天会导致服务器卡顿，现在临时修改一下
				// 当服务器人数超过一定数量的时候，聊天只在本地城市显示。
				if (global.UserManager.GetUserNum() < 100) {
					global.UserManager.Foreach(function(user) {
						user.SendBuff(buff);
					});
				}
				else if (user.city) {
					user.city.Foreach(function(user) {
						user.SendBuff(buff);
					});
				}
			}
			break;
			// 私聊。
			case global.CHANNEL_PRIVATE: {
				var targetUser = global.UserManager.Find(target);
				if (targetUser === undefined) return "UserNotOnline";
				targetUser.SendBuff(buff);
			}
			break;
		}

		console.LOG("聊天信息: 发送[%s] 频道[%s] 信息[%s] 目标[%s] 类型[%d]",
			user,
			channel,
			msg,
			target,
			id);
	}
	
	// 获取从某个时间段的消息，用户聊天频道第一次加载的时候。
	this.Get = function(since) {
		var ret = { 
			msgs: [], 
			time: (new Date()).getTime() 
		};
		
		for (var i in mMessages) {
			var message = mMessages[i];
			if (message.time > since)
				ret.msgs.push(message);
		}
		return ret;
	}

	// 系统广播消息。
	this.Broadcast = function(msg) {
		this.Send(global.TEXTS.SYSTEM_NAME, global.CHANNEL_WORLD, msg, undefined, global.SYSTEM_BROADCAST);
	}
}

// 处理调试模式下gm的命令。
function ProcessGMCommand(user, command) {
	var args = command.split(' ');
	if (args.length < 3 || args[0] !== "gm")
		return false;
	
	var cmd = args[1];
	var value = parseInt(args[2]);
	if (isNaN(value)) return false;
	
	switch (cmd) {
	case "gem":
		user.AddGem(value);
		break;
	case "gold":
		user.AddGold(value);
		break;
	case "exp":
		user.AddExp(value);
		break;
	case "item":
		if (args.length > 3)
			user.PackageManager.AddItem(value, parseInt(args[3]));
		else
			user.PackageManager.AddItem(value, 1);
		break;
	case "open":
		for (var i in global.LevelSetTable.GetAllItem()) {
			var levelSetup = global.LevelSetTable.GetAllItem()[i];
			var levelId = levelSetup.ID;
			if (levelId > value) break;
			
			if (user.LevelInfos[levelId] !== undefined) continue;
			user.LevelInfos[levelId] = {
				PassCount: 1,
				MaxScore: 0,
				LastScore: 0,
				Time: new Date(),
			};
		}
		user.Attrib.Progress = value;
		user.Dirty("Attrib");
		break;
	case "strength":
		user.AddStrength(value);
		break;
		
	default:
		// 默认修改角色的属性。
		if (user.Attrib[cmd] !== undefined) {
			user.Attrib[cmd] = value;
			user.Dirty("Attrib");
		}
		break;
	}
	
	console.LOG("处理GM指令: 玩家[%s] 命令[%s]",
		user.Key(),
		command);
	return true;
}

// 发送聊天信息。
exports.SendChatMsg = function(service, params, connection, response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
	
	if (!global.SWITCHES.CHAT)
		return response.Error("ChatDisabled");
		
	var user = connection.user;
	var channel = (params.channel || global.CHANNEL_WORLD);

	// 检查参数合法性。
	if (params.msg === undefined || (channel === global.CHANNEL_PRIVATE && params.target === undefined))
		return response.Error("InvalidParam");
	
	// 非发布情况下检查聊天里面的gm消息。
	if (!service.Config.Publish) {
		if (ProcessGMCommand(user, params.msg))
			return response.Done();
	}
	
	var error = global.ChatManager.Send(user.Key(), channel, params.msg, params.target, global.USER_SEND_MSG);
	if (error)
		response.Error(error);
	else {
		var chatResponse = {time: (new Date()).getTime() };
		response.Send(chatResponse, "ChatResponse");
	}
}

exports.GetChatMsg = function(service, params, connection, response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.CHAT)
		return response.Error("ChatDisabled");
		
	var since = (params.since || 0);
	if (since === undefined)
		return response.Error("InvalidParam");

	var ret = global.ChatManager.Get(since);
	response.Send(ret, "ChatMsgs");
}
