

var mHandles = [];

// 登录&帐号
mHandles['LoginCmd'] = require('./login_mgr').Login;
mHandles['ReLoginCmd'] = require('./login_mgr').ReLogin;
mHandles['CreateUserCmd'] = require('./login_mgr').CreateUser;
mHandles['DeleteUserCmd'] = require('./login_mgr').DeleteUser;
mHandles['GetLoginInfoCmd'] = require('./login_mgr').GetLoginInfo;
mHandles['SignInCmd'] = require('./login_mgr').SignIn;
mHandles['FinishNewGuideCmd'] = require('./login_mgr').FinishNewGuide;

// 角色
mHandles['EnterGameCmd'] = require('./user_mgr').EnterGame;
mHandles['LeaveGameCmd'] = require('./user_mgr').LeaveGame;

// 副本
mHandles['EnterLevelCmd'] = require('./level_mgr').EnterLevel;
mHandles['OpenCellCmd'] = require('./level_mgr').OpenCell;
mHandles['LeaveLevelCmd'] = require('./level_mgr').LeaveLevel;
mHandles['FinishLevelCmd'] = require('./level_mgr').FinishLevel;
mHandles['ReviveInfoCmd'] = require('./level_mgr').GetReviveInfo;
mHandles['ReviveCmd'] = require('./level_mgr').Revive;
mHandles['GetPveInfoCmd'] = require('./level_mgr').GetPveInfo;
mHandles['GetTurntableDataCmd'] = require('./level_mgr').GetTurntableData;
mHandles['FetchTurntableRewardCmd'] = require('./level_mgr').FetchTurntableReward;

// 属性
mHandles['GetUserAttribCmd'] = require('./user_mgr').GetUserAttrib;
mHandles['GetUserDataCmd'] = require('./user_mgr').GetUserData;

// 体力
mHandles['GetStrengthCmd'] = require('./user_mgr').GetUserStrength;
mHandles['BuyStrengthCmd'] = require('./user_mgr').BuyUserStrength;

// 主城
mHandles['GetCityUsersCmd'] = require('./city_mgr').GetCityActiveUsers;
mHandles['MoveCmd'] = require('./city_mgr').MoveInCity;

// 背包
mHandles['GetBackPackCmd'] = require('./package_mgr').GetUserBackPack;
mHandles['GetSkillPackCmd'] = require('./package_mgr').GetUserSkillPack;
mHandles['BuyPackagePageCmd'] = require('./package_mgr').BuyPackagePage;

// 技能
mHandles['SkillLearnCmd'] = require('./skill_mgr').SkillLearn;
mHandles['SkillUpgradeCmd'] = require('./skill_mgr').SkillUpgrade;
mHandles['SkillEquipCmd'] = require('./skill_mgr').SkillEquip;
mHandles['SkillBuySlotCmd'] = require('./skill_mgr').SkillBuySlot;
mHandles['SkillAddRuneCmd'] = require('./skill_mgr').SkillAddRune;

// 商店
mHandles['BuyCmd'] = require('./shop_mgr').Buy;
mHandles['SellCmd'] = require('./shop_mgr').Sell;
mHandles['BatchSellCmd'] = require('./shop_mgr').BatchSell;
mHandles['RechargeCmd'] = require('./shop_mgr').Recharge;
mHandles['ExchangeCmd'] = require('./shop_mgr').Exchange;

// 装备
mHandles['EquipCmd'] = require('./item_mgr').Equip;
mHandles['UnEquipCmd'] = require('./item_mgr').UnEquip;
mHandles['CombineCmd'] = require('./item_mgr').Combine;
mHandles['StrengthenCmd'] = require('./item_mgr').Strengthen;
mHandles['UseItemCmd'] = require('./item_mgr').UseItem;
mHandles['EquipPropsCmd'] = require('./item_mgr').EquipProps;

// 聊天
mHandles['SendChatCmd'] = require('./chat_mgr').SendChatMsg;
mHandles['GetChatCmd'] = require('./chat_mgr').GetChatMsg;

// 邮件
mHandles['GetMailsCmd'] = require('./mail_mgr').GetMails;
mHandles['ReadMailCmd'] = require('./mail_mgr').ReadMail;
mHandles['FetchAttachCmd']  = require('./mail_mgr').FetchMailAttachment;
mHandles['DeleteMailCmd'] = require('./mail_mgr').DeleteMail;
mHandles['SendMailCmd'] = require('./mail_mgr').SendMail;

// 排行榜
mHandles['GetTopListCmd'] = require('./toplist_mgr').GetTopList;

// 好友
mHandles['GetFriendsCmd'] = require('./friend_mgr').GetFriends;
mHandles['AddFriendCmd'] = require('./friend_mgr').AddFriend;
mHandles['DeleteFriendCmd'] = require('./friend_mgr').DeleteFriend;

// 任务
mHandles['GetQuestListCmd'] = require('./quest_mgr').GetQuestList;
mHandles['FetchQuestRewardCmd'] = require('./quest_mgr').FetchQuestReward;

// 实时PVP
mHandles['JoinPvpCmd'] = require('./pvp_mgr').JoinPvp;
mHandles['LeavePvpCmd'] = require('./pvp_mgr').LeavePvp;
mHandles['FinishPvpCmd'] = require('./pvp_mgr').FinishPvp;
mHandles['GetPvpInfoCmd'] = require('./pvp_mgr').GetPvpInfo;

// 服务器压力测试响应
mHandles['ServerTestRequest'] = function(service, params, connection, response) {
	response.Send({Data: params.Data}, "ServerTestRequest");
}

exports.Load = function() {
    return mHandles;
}