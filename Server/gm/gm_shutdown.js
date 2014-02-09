
// 服务器关闭的一些变量。
var gShutdownTimeId = undefined;
var gShutdownTime = undefined;
var gShutdownArray = [
	30 * 1000, // 30秒提醒
	1 * 60 * 1000,
	2 * 60 * 1000,
	5 * 60 * 1000,
	10 * 60 * 1000,
	20 * 60 * 1000,
	30 * 60 * 1000,
	45 * 60 * 1000,
	60 * 60 * 1000,
];
function shutdownHandler() {
	var now = new Date();
	if (now >= gShutdownTime) {
		console.LOG('游戏即将退出！！！');
		// 退出游戏前先强制保存一下玩家信息。
		global.UserManager.Foreach(
			function(user) { user.Save(); }, 
			true);
		// 退出主程序。
		process.exit(0);
		return;
	}
	
	// 计算时间剩余值～～
	var nextEnqueueTime = gShutdownArray[gShutdownArray.length - 1];
	var totalLeftTime = gShutdownTime - now;
	for (var i = 0; i < gShutdownArray.length; i++) {
		var stamp = gShutdownArray[i];
		if (totalLeftTime < stamp) {
			nextEnqueueTime = totalLeftTime - ((i > 0) ? gShutdownArray[i - 1] : 0);
			break;
		}
	}
	
	// 广播消息给广大玩家用户～～
	var msg = "Server is going to shutdown in ";
	var hours = Math.floor(totalLeftTime / (60 * 60 * 1000));
	var minus = Math.floor((totalLeftTime % (60 * 60 * 1000)) / (60 * 1000));
	var seconds = Math.floor((totalLeftTime % (60 * 1000)) / 1000);
	if (hours > 0) msg += hours + " hours";
	else if (minus > 0) msg += (minus + 1) + " minus";
	else msg += (seconds + 1) + " seconds";
	global.ChatManager.Broadcast(msg);
	
	// 安排下次调用的时间。
	gShutdownTimeId = setTimeout(shutdownHandler, nextEnqueueTime);
}

// gm工具来关闭服务器（能够尽量保证数据不丢失）。
global.GMManager.Register('/shutdown', function(params, response) {
	// 用户取消之前的服务器关闭命令。
	if (params.cancel == 'true') {
		if (!gShutdownTimeId)
			return response.simpleJSON({ error: 'NotShutdownFound'});
		
		clearTimeout(gShutdownTimeId);
		gShutdownTimeId = undefined;
		console.LOG('游戏退出被成功取消！！！');
		return response.simpleJSON({ data: 'CancelSuccess'});
	}
	
	// 用户查询之前的服务器关闭时间
	if (params.query == 'true') {
		if (!gShutdownTimeId)
			return response.simpleJSON({ error: 'NotShutdownFound'});
		return response.simpleJSON({ data: gShutdownTime.getTime() });
	}

	if (params.time === undefined)
		return response.simpleJSON({ error: 'InvalidParams'});
		
	var now = new Date();
	var time = new Date(parseInt(params.time));
	if (time < now)
		return response.simpleJSON({ error: 'InvalidParams'});
	
	// 已经有shutdown命令安排着。
	if (gShutdownTimeId)
		return response.simpleJSON({ error: 'AlreadyEnqueue'});

	// 设置定时器。
	gShutdownTime = time;
	shutdownHandler();
	
	// 返回值。
	response.simpleJSON({ data: 'EnqueueSucess'});
});