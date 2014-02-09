
// 邮件管理器。
if (global.MailManager == null) global.MailManager = new function() {

	// Mails: [
	// 	{ 
	// 		title: 'xxxxx', 
	// 		sender: '@@@', 
	// 		content: 'yyyyyyyyyyyy', 
	// 		item: 10003, 
	// 		gold: 0, 
	// 		gem: 0, 
	// 		time: xxx, 
	// 		flag: 0 },
	// ]

	// 列举邮箱中的邮件。
	this.GetMails = function(user, page, size) {
		// 获取所需要的邮件列表。
		var mailBox = user.Mails;
		var mails = mailBox.slice(page * size, (page + 1) * size);
		var ret = {
			total: mailBox.length,
			page: page,
			mails: [],
		}

		// 提取出邮件的简要内容，不包含邮件正文，附件的具体信息
		for (var i in mails) {
			var mail = mails[i];
			ret.mails.push({
				title: mail.title,
				sender: mail.sender,
				time: mail.time,
				attach: (mail.item > 0 || mail.gold > 0 || mail.gem > 0),
				flag: mail.flag,
			});
		}
		return ret;
	}

	// 读取邮件的具体内容，并且标记邮件为已读
	// 参数id为邮件中的索引号。
	this.ReadMail = function(user, id, callback) {
		var mailBox = user.Mails;
		if (mailBox.length <= mail) {
			callback("MailNotFound");
			return;
		}

		var mail = mailBox[id];
		mail.flag = 1;
		callback(undefined, mail);
	}

	// 提取邮件中的附件
	// mail为邮箱中的索引号。
	this.FetchAttachment = function(user, id, callback) {
		var mailBox = user.Mails;
		if (mailBox.length <= mail)
			return callback("MailNotFound");

		var mail = mailBox[id];
		if (mail.item > 0) {
			//if (user.PackageManager.IsFull())
			//	return callback("BackPackageIsFull");
			user.PackageManager.AddItem(mail.item, 1);
		}
		if (mail.gold > 0) user.AddGold(mail.gold);
		if (mail.gem > 0) user.AddGem(mail.gem);

		// 清除附件中的数据。
		mail.item = 0;
		mail.gold = 0;
		mail.gem = 0;

		callback(undefined, "FetchSuccess");

		console.LOG("提取附件: 玩家[%s] 邮件[%d] 物品[%d] 金币[%d] 钻石[%d]",
			user.Key(),
			id,
			mail.item,
			mail.gold,
			mail.gem);
	}

	// 删除指定的邮件。
	this.DeleteMail = function(user, id, callback) {
		var mailBox = user.Mails;
		if (id < 0 || id >= mailBox.length)
			callback("InvalidParam");
		else {
			mailBox.splice(id, 1);
			callback(undefined, "DeleteMailSuccess");

			console.LOG("删除邮件: 玩家[%s] 邮件[%d]",
				user.Key(),
				id);
		}
	}

	// 删除所有的邮件。
	this.DeleteAll = function(user) {
		console.LOG("删除所有邮件: 玩家[%s] 总共[%d]",
			user.Key(),
			user.Mails.length);
		user.Mails.length = 0;
	}
	
	// 简便的发送邮件
	this.SendSimple = function(sender, to, title, content) {
		this.SendTo(sender, to, title, content, 0, 0, 0, function(err, ret) {});
	}
	
	// 发送邮件
	this.SendTo = function(sender, to, title, content, item, gold, gem, callback) {
		var mail = {
			title: title,
			sender: sender,
			content: content,
			item: item,
			gold: gold,
			gem: gem,
			time: (new Date()).getTime(),
			flag: 0,
		}

		// 检查目标是否在线(或者曾经登录过～)
		var receivUser = global.UserManager.Find(to, true);
		if (receivUser != undefined) {
			receivUser.Mails.unshift(mail);
			receivUser.Dirty("Mails");
			callback(undefined, "SendMailSuccess");
			
			// 发送通知给在线玩家。
			if (receivUser.IsOnline)
				receivUser.Send(undefined, undefined, global.USER_GET_NEW_MAIL);

			console.LOG("收到邮件: 发送[%s] 接受[%s] 物品[%d] 金币[%d] 钻石[%d]",
				sender,
				to,
				item,
				gold,
				gem);
			return;
		}
			
		// 玩家不在线，需要插入到数据库里面去。
		global.Service.Database.collection(global.TABLES.USER, function(err, collection) {
			if (err)
				return callback("DatabaseError");

			// 将数据库内的邮件查询出来。
			collection.findOne({user: to}, {Mails: true}, function(err, dbItem) {
				// 玩家不存在。
				if (dbItem == null)
					return callback("UserNotFound");

				// 这里需要检查一下，玩家是不是在这段时间内上线了。
				var receivUser = global.UserManager.Find(to);
				if (receivUser != undefined) {
					receivUser.Mails.unshift(mail);
					receivUser.Dirty("Mails");
					
					console.LOG("收到邮件: 发送[%s] 接受[%s] 物品[%d] 金币[%d] 钻石[%d]",
						sender,
						to,
						item,
						gold,
						gem);
					return callback(undefined, "SendMailSuccess");
				}

				// 添加到邮件数组。
				dbItem.Mails.unshift(mail);

				// 更新到数据库内部去。
				collection.update({_id: dbItem._id}, { $set: {Mails: dbItem.Mails} }, function(err) {
					if (err)
						callback("DatabaseError");
					else {
						callback(undefined, "SendMailSuccess");

						console.LOG("收到邮件: 发送[%s] 接受[%s] 物品[%d] 金币[%d] 钻石[%d]",
							sender,
							to,
							item,
							gold,
							gem);
					}
				});
			});
		});
	}
}

// 获取邮件中的一系列邮件
// 参数【page】页号码
// 参数【size】一页的个数
// 返回值里面包含邮件的总个数。
exports.GetMails = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.MAIL)
		return response.Error("MailDisabled");

	var page = (params.page || 0);
	var size = params.size;
	if (isNaN(page) || isNaN(size))
		return response.Error("InvalidParam");

	var ret = global.MailManager.GetMails(user, page, size);
	response.Send(ret, "GetMailResponse");
}

// 读取某一封邮件的数据。
// 参数【mail】是邮件的索引号
exports.ReadMail = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.MAIL)
		return response.Error("MailDisabled");
		
	var mail = (params.mail || 0);
	global.MailManager.ReadMail(user, mail, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret, "Mail");
	});
}


// 提取邮件中的附件
// 参数【mail】代表邮件的索引。
exports.FetchMailAttachment = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.MAIL)
		return response.Error("MailDisabled");
		
	var mail = (params.mail || 0);
	global.MailManager.FetchAttachment(user, mail, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 删除指定的一封邮件
// 参数【mail】代表邮件的索引号。
exports.DeleteMail = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.MAIL)
		return response.Error("MailDisabled");
		
	var mail = (params.mail || 0);
	global.MailManager.DeleteMail(user, mail, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 发送邮件。
exports.SendMail = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.MAIL)
		return response.Error("MailDisabled");
		
	var to = params.to;
	var title = params.title;
	var content = params.content;
	if (to === undefined || title === undefined || content === undefined)
		return response.Error("InvalidParam");

	global.MailManager.SendTo(user.Key(), to, title, content, 0, 0, 0, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}