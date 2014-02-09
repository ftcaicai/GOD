
if (global.QuestManager === undefined) global.QuestManager = new function() {

	this.GetList = function(user) {
		var questList = { quests: [] };
		for (var i in user.Quests)
			questList.quests.push(user.Quests[i]);
		return questList;
	}

	// 获取任务的奖励。
	this.FetchReward = function(user, id) {
		var quests = user.Quests;
		if (quests[id] !== undefined)
			return "QuestAlreadyFinished";
		
		var questBase = global.QuestBaseTable.GetItem(id);
		if (questBase === undefined)
			return "QuestNotFoundInTable";
			
		//if (questBase.Items.length > 0 &&
		//	user.PackageManager.IsFull())
		//	return "BackPackageIsFull";
			
		// 判断是否可以领取任务。
		if (user.LevelInfos[questBase.Scene] === undefined)
			return "QuestNotFinished";
		
		// 领取任务的奖励。
		if (questBase.Gold > 0) user.AddGold(questBase.Gold);
		if (questBase.Gem > 0) user.AddGem(questBase.Gem);
		if (questBase.Exp > 0) user.AddExp(questBase.Exp);
		if (questBase.SP > 0) user.AddSP(questBase.SP);
		if (Array.isArray(questBase.Items) && questBase.Items.length >= 2) {
			for (var i = 0; i < questBase.Items.length - 1; i += 2) {
				var itemId = questBase.Items[i];
				var itemNum = questBase.Items[i+1];
				var itemBase = global.ItemBaseTable.GetItem(itemId);
				if (itemBase === undefined) continue; // 所配置的物品不存在。
				if (itemBase.Role > 0 && 
					itemBase.Role !== user.Attrib.Role)
					continue; // 物品不是本职业的东西。
				user.PackageManager.AddItem(itemBase, itemNum);
			}
		}
		
		// 记录到任务列表内。
		quests[id] = id;
		user.Dirty("Quests");
			
		console.LOG("领取任务奖励: 玩家[%s] 任务[%d] 金币[%d] 钻石[%d] 经验[%d] 物品[%s]",
			user.Key(),
			questBase.ID,
			questBase.Gold,
			questBase.Gem,
			questBase.Exp,
			JSON.stringify(questBase.Items));
	}
}

// 获取已完成的任务列表。
exports.GetQuestList = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");
		
	if (!global.SWITCHES.QUEST)
		return response.Error("QuestDisabled");
		
	var questList = global.QuestManager.GetList(user);
	response.Send(questList, "QuestList");
}

// 领取任务奖励。
exports.FetchQuestReward = function(service, params, connection, response) {
	var user = connection.user;
	if (user === undefined)
		return response.Error("UserNotLogin");

	if (!global.SWITCHES.QUEST)
		return response.Error("QuestDisabled");
		
	if (params.id === undefined)
		return response.Error("InvalidParam");
		
	var err = global.QuestManager.FetchReward(user, params.id);
	if (err)
		response.Error(err);
	else
		response.Send("FetchQuestRewardSuccess");
}
