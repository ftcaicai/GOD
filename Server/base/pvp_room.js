
const PVP_RESULT_DRAW = 0; // 平局
const PVP_RESULT_WIN = 1; // pvp赢了
const PVP_RESULT_LOSE = 2; // 输了

function PvpRoom(owner, users) {
	this.mOwner = owner;
	this.mUsers = users;
	this.mFinishData = undefined;
}

// 房间初始化
PvpRoom.prototype.Init = function(server, map, game) {
	// 生成发送给客户端的数据包。
	var pvpData = { 
		server: server,
		map: map, //global.Service.Config.PVP.Map[0],
		game: game, //this.mGame,
		pass: Math.floor(Math.random() * 123456),
		timeout: global.PVP_GAME_TIME,
		users: [] };
		
	// 配置玩家的属性，这里需要天平系统的调整。
	// 暂时有玩家的基础属性来替代，待表格配置完成之后再做调整。
	for (var i in this.mUsers) {
		var user = this.mUsers[i];
		var data = {};
		this.ApplyPvpBalance(user, data);
		pvpData.users.push(data);
	}
	
	// 将数据包发送给组里面的每一个人。
	var buff = global.CommandManager.Build(undefined, pvpData, "PvpData", global.USER_PVP_BEGIN);
	for (var i in this.mUsers) {
		var user = this.mUsers[i];
		user.PvpRoom = this;
		user.SendBuff(buff);
	}
}

// 帮组函数，将pvp需要平衡的9个数值进行叠加（判断是否存在）。
function AddAttribute(attrib, data) {
	if (data.Damage) attrib.Damage = (attrib.Damage || 0) + data.Damage;
	if (data.Defense) attrib.Defense = (attrib.Defense || 0) + data.Defense;
	if (data.SpecialDamage) attrib.SpecialDamage = (attrib.SpecialDamage || 0) + data.SpecialDamage;
	if (data.SpecialDefense) attrib.SpecialDefense = (attrib.SpecialDefense || 0) + data.SpecialDefense;
	if (data.HPMax) attrib.HPMax = (attrib.HPMax || 0) + data.HPMax;
	if (data.Hit) attrib.Hit = (attrib.Hit || 0) + data.Hit;
	if (data.Block) attrib.Block = (attrib.Block || 0) + data.Block;
	if (data.Tough) attrib.Tough = (attrib.Tough || 0) + data.Tough;
	if (data.Critical) attrib.Critical = (attrib.Critical || 0) + data.Critical;
	if (data.AbilityMax) attrib.AbilityMax = (attrib.AbilityMax || 0) + data.AbilityMax;
	if (data.AbHitAdd) attrib.AbHitAdd = (attrib.AbHitAdd || 0) + data.AbHitAdd;
	if (data.SoulMax) attrib.SoulMax = (attrib.SoulMax || 0) + data.SoulMax;
}

// 计算pvp的平衡。
PvpRoom.prototype.ApplyPvpBalance = function(user, data) {
	// 填充pvp的装备信息，属性信息需要额外计算。
	user.Fill(data, true, true);
	data.Attrib.Battle = user.Attrib.Battle; // pvp需要战力数据。
	
	// 填充pvp的基础属性。
	var pvpBalance = global.PvpBalanceTable.GetItem(user.Attrib.Role, user.Attrib.Level);
	if (pvpBalance === undefined) {
		console.ERROR("未能在PvpBalance表格里面找到配置：ID=%d, Level=%d", user.Attrib.Role, user.Attrib.Level);
		return;
	}
	
	var playerAttrib = {}; // 角色基础属性
	var equipAttrib = {}; // 装备的基础属性
	var forgeAttrib = {}; // 装备强化的基础属性
	
	// 获取角色的基础属性。
	AddAttribute(playerAttrib, pvpBalance);
	
	// 获取装备信息
	var itemList = user.PackageManager.BackPack().Items;
	for (var i in itemList) {
		var item = itemList[i];
		if (!item.Attrib.Equip)
			continue;
			
		// 获取装备基础属性。
		var equipBase = global.EquipBaseTable.GetItem(item.Base);
		if (equipBase)
			AddAttribute(equipAttrib, equipBase);
		
		// 获取装备的强化属性。
		AddAttribute(forgeAttrib, item.Attrib);
	}
	
	// 计算装备基础属性修正
	for (var key in equipAttrib)
		equipAttrib[key] = Math.floor((equipAttrib[key] || 0) * pvpBalance["EquipCoff" + key] / 10000) + pvpBalance["EquipOffset" + key];
	
	// 计算强化属性修正
	for (var key in forgeAttrib)
		forgeAttrib[key] = Math.floor((forgeAttrib[key] || 0) * pvpBalance["ForgeCoff" + key] / 10000) + pvpBalance["ForgeOffset" + key];
	
	// 计算到主属性里面。
	AddAttribute(data.Attrib, playerAttrib);
	AddAttribute(data.Attrib, equipAttrib);
	AddAttribute(data.Attrib, forgeAttrib);
}

// 通过pvpbase表格配置来获取pvp的奖励。
function GetPvpReward(reward, user, target, result, pvpBase) {
	var targetPvpLevel = target.Attrib.PvpLevel;
	if (result === PVP_RESULT_WIN) {
		reward.sp += pvpBase.WinGetSP;
		reward.exp += (pvpBase["WinGetExp" + targetPvpLevel] || 0);
	}
	else if (result === PVP_RESULT_LOSE) {
		reward.sp += pvpBase.LoseGetSP;
		reward.exp += (pvpBase["LoseGetExp" + targetPvpLevel] || 0);
	}
	else {
		reward.sp += pvpBase.DrawGetSP;
		reward.exp += pvpBase.DrawGetEXP;
	}
}

// 计算pvp的结果，提取pvp的奖励。清空pvp房间。
PvpRoom.prototype.BuildFinishData = function(teamResult) {
	// 开始计算奖励。
	var finishData = { datas: [] };
	for (var i = 0; i < this.mUsers.length; i++) {
		var user = this.mUsers[i];
		var teamIdx = (i % 2);
		var result = teamResult[teamIdx];
		var pvpFinishData = {
			user: user.Key(),
			result: result,
			team: teamIdx,
			sp: 0,
			exp: 0 };
		// 跟队伍里面的其他人比较，用来计算奖励值。
		var pvpBase = global.PvpBaseTable.GetItem(user.Attrib.PvpLevel);
		if (pvpBase != undefined) {
			for (var j = 1 - teamIdx; j < this.mUsers.length; j += 2)
				GetPvpReward(pvpFinishData, user, this.mUsers[j], pvpFinishData.result, pvpBase);

			// 每天获得的SP具有最大值的。
			var now = new Date();
			if (user.PvpInfo.Time == undefined ||
				user.PvpInfo.Time.getMonth() != now.getMonth() ||
				user.PvpInfo.Time.getDate() != now.getDate())
				user.PvpInfo.TodaySP = 0;
			if (pvpFinishData.sp > 0) {
				if (user.PvpInfo.TodaySP >= pvpBase.GetSPMax)
					pvpFinishData.sp = 0;
				else if (user.PvpInfo.TodaySP + pvpFinishData.sp > pvpBase.GetSPMax)
					pvpFinishData.sp = pvpBase.GetSPMax - user.PvpInfo.TodaySP;
				user.PvpInfo.TodaySP += pvpFinishData.sp;
			}
			user.PvpInfo.Time = now;
		}

		// pvp经验。
		if (pvpFinishData.exp !== 0) user.AddPvpExp(pvpFinishData.exp);
		if (pvpFinishData.sp > 0) user.AddSP(pvpFinishData.sp);
		
		// 胜率 连胜数 和挑战次数
		user.PvpInfo.TotalCount = (user.PvpInfo.TotalCount || 0) + 1;
		if (result == PVP_RESULT_WIN) {
			user.PvpInfo.WinCount = (user.PvpInfo.WinCount || 0) + 1;
			user.PvpInfo.KeepWin = (user.PvpInfo.KeepWin || 0) + 1;
		}
		else {
			// 失败或者平局，清除连胜的标志。
			user.PvpInfo.KeepWin = 0;
		}
		user.Dirty("PvpInfo");
		
		finishData.datas.push(pvpFinishData);
	}
	return finishData;
}

PvpRoom.prototype.CheckFinish = function(user, result) {
	var idx = this.mUsers.indexOf(user);
	if (idx < 0)
		return console.ERROR("错误：不可能的情况，玩家不在pvp房间内！！！");
	
	if (this.mFinishData === undefined) {
		var teamResult = [PVP_RESULT_DRAW, PVP_RESULT_DRAW];
		var teamIdx = (idx % 2);
		if (result == PVP_RESULT_WIN) {
			teamResult[teamIdx] = PVP_RESULT_WIN;
			teamResult[1 - teamIdx] = PVP_RESULT_LOSE;
		}
		else if (result == PVP_RESULT_LOSE) {
			teamResult[teamIdx] = PVP_RESULT_LOSE;
			teamResult[1 - teamIdx] = PVP_RESULT_WIN;
		}
		this.mFinishData = this.BuildFinishData(teamResult);
	}
	this.mUsers.splice(idx, 1);
	return this.mFinishData;
}

// 玩家离开房间。
PvpRoom.prototype.Leave = function(user) {
	var idx = this.mUsers.indexOf(user);
	if (idx < 0)
		return console.ERROR("错误：不可能的情况，玩家不在pvp房间内！！！");
		
	// 提前离开算输。
	this.CheckFinish(user, PVP_RESULT_LOSE);
}

exports.PvpRoom = PvpRoom;
