
if (global.FriendManager === undefined) global.FriendManager = new function() {

	this.GetFriends = function(user, callback) {
		var friends = user.Friends;
		var friendList = { friends: [] };
		for (var i in friends) {
			var info = friends[i];
			friendList.friends.push({
				name: i,
				role: info.role,
				online: (global.UserManager.Find(i) !== undefined),
			});
		}
		return friendList;
	}
	
	this.AddFriend = function(user, friend, callback) {
		var friends = user.Friends;
		if (friends[friend] !== undefined)
			return callback("FriendAlreadyExist");
			
		// 检查好友是否存在
		global.Service.Database.collection(global.TABLES.USER, function(err, collection){
			if (err)
				return callback("DatabaseError");
				
			collection.findOne({user: friend, deleted: {$exists: false}}, {_id: true, "Attrib.Role": true}, function(err, item) {
				if (err || item == null)
					return callback("FriendNotExist");
					
				// 创建一个好友。
				friends[friend] = {
					add_time: new Date(),
					role: item.Attrib.Role,
				};
				
				user.Dirty("Friends");
				
				// 给好友发送邮件提醒。
				global.MailManager.SendSimple(
					user.Key(), // sender
					friend, // to
					global.TEXTS.ADD_FRIEND_MAIL_TITAL, // title
					global.TEXTS.ADD_FRIEND_MAIL_CONTENT); // content
				
				callback(undefined, "AddFriendSuccess");
				
				console.LOG("添加好友: 玩家[%s] 好友[%s]",
					user.Key(),
					friend);
			});
		});
	}
	
	this.DeleteFriend = function(user, friend, callback) {
		var friends = user.Friends;
		if (friends[friend] === undefined)
			return callback("FriendNotFound");
			
		// 删除好友
		delete friends[friend];
		
		user.Dirty("Friends");
		
		callback(undefined, "DeleteFriendSuccess");
		
		console.LOG("删除好友: 玩家[%s] 好友[%s]",
			user.Key(),
			friend);
	}
}

// 获取到好友列表
exports.GetFriends = function(service, params, connection,  response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.FRIEND)
		return response.Error("FriendDisabled");
	
	var friendList = global.FriendManager.GetFriends(connection.user);
	response.Send(friendList, "FriendList");
}

// 添加好友
exports.AddFriend = function(service, params, connection,  response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.FRIEND)
		return response.Error("FriendDisabled");
		
	if (params.friend === undefined)
		return response.Error("InvalidParam");
		
	global.FriendManager.AddFriend(connection.user, params.friend, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

// 删除好友
exports.DeleteFriend = function(service, params, connection,  response) {
	if (connection.user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.FRIEND)
		return response.Error("FriendDisabled");
		
	if (params.friend === undefined)
		return response.Error("InvalidParam");
		
	global.FriendManager.DeleteFriend(connection.user, params.friend, function(err, ret) {
		if (err)
			response.Error(err);
		else
			response.Send(ret);
	});
}

