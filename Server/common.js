
// 通用设置
global.MAX_NUM_PER_CITY = 30; // 一个城市里面容纳的人数。
global.MAX_CHAT_MESSAGE = 50; // 最多保存的聊天条数
global.MAX_TOPLIST_NUM = 50; // 排行榜的个数
global.USER_SAVE_TIME = 5 * 60 * 1000; // 每5分钟保存一次玩家到数据库。
global.PVP_ROUND_TIME = 1 * 1000;  // 每1秒钟刷新一次PVP的轮数。
global.PVP_GAME_TIME = 2 * 60 * 1000; // PVP里面每局的时间为2分钟。
global.PVP_MAX_LEVEL = 30;	// pvp等级最高为30级。
global.UPDATE_TOPLIST_TIME = 5 * 60 * 1000;  // 每5分钟刷新一次排行榜。
global.MAX_STRENGTH = 12; // 最大体力数量为12
global.UPDATE_STRENGTH_TIME = 30 * 60 * 1000; // 每30分钟恢复一点体力。
global.DEFAULT_BACKPACK_PAGE = 2; // 默认背包设计为2页。
global.ITEMS_NUM_PER_PAGE = 16; // 每个背包的物品个数。
global.FREE_REVIVE_TIME = 2; // 每人每天的免费复活次数为2.
global.MAX_SIGNIN_DAY = 30; // 签到天数每30一轮回。目前是根据表格上来算的。
global.GEM_TO_SP = 10; // 钻石兑换SP的比例为【1 : 10】
global.TURN_TABLE_NUM = 12; // 副本转盘的物品个数为12个。

// 这里是服务器发给客户端的消息号
global.USER_ENTER_CITY = 10;
global.USER_LEAVE_CITY = 11;
global.USER_MOVE_IN_CITY = 12;
global.USER_SEND_MSG = 20;
global.SYSTEM_BROADCAST = 21;
global.USER_GET_NEW_MAIL = 22;
global.USER_PVP_BEGIN = 30; // 进入pvp房间
global.USER_PVP_GAME_STARTED = 31; // pvp房间开始游戏
global.USER_PVP_GAME_END = 32; // pvp房间结束游戏

// 聊天频道的定义
global.CHANNEL_WORLD = 0; // 世界频道
global.CHANNEL_PRIVATE = 1; // 私有频道

// 记录统计数值
global.TOTAL_SOCKET_RECEIVED = 0; // 服务器接收到的消息字节
global.TOTAL_SOCKET_SENDED = 0; // 服务器发送的消息字节

// 服务器的一些开关，紧急情况下使用，可以通过GM来【开启/关闭】
global.SWITCHES = {
	MAIL: true, // 邮件
	CHAT: true, // 聊天
	FRIEND: true, // 好友
	FORGE: true, // 强化
	COMBINE: true, // 合成
	USE: true, // 物品使用
	LEVEL: true, // 关卡
	REVIVE: true, // 复活
	SELL: true, // 售出
	BUY: true, // 购买
	PVP: true, // PVP
	QUEST: true, // 任务
	SKILL: true, // 技能
	TOPLIST: true, // 排行榜
	SINGIN: true, // 签到
	RECHARGE: true, // 充值
	EXCHANGE: true, // 兑换
}

// 苹果验证的链接地址。
global.ITUNES_SANDBOX = true;

// 数据库表格的定义。
global.TABLES = {
	USER: 'user',
	PAY: 'pay',
	CONSUME: 'consume',
	LOGIN: 'login',
}

// 角色不能取的名字规则。比较前会转化为小写
global.RESERVED_NAMES = [
	'system',
	'gm',
	'god',
	'gamemaster',
	'gamemanager',
	'系统',
	'系统管理员',
	'游戏gm',
]

// 文字的定义
global.TEXTS = {
	SYSTEM_NAME: "system",
	GM_USER_ONLINE: "UserOnline: ",
	GM_USER_OFFLINE: "UserOffline:",
	ADD_FRIEND_MAIL_TITAL: "Add Friend Notification",
	ADD_FRIEND_MAIL_CONTENT: "I already add you as my friend.",
	RECHARGE_MAIL_TITAL: "Recharge sucess",
	RECHARGE_MAIL_CONTENT: "You already recharge sucess, get [%d] gems",
}

