// 主管理服务器，主要功能是：
// 1：监控所有子服务器的运行状态。
// 2：用来管理所有子服务器的角色信息。
// 3：广播/重定向一些特殊的消息（如喇叭，聊天，邮件，好友等）。

var cluster = require('cluster');
const SERVER_TYPE_NONE = 0;
const SERVER_TYPE_MASTER = 1;
const SERVER_TYPE_GLOBAL = 2;
const SERVER_TYPE_SLAVE = 3;

if (global.MasterServer == undefined) global.MasterServer = new function() {
	if (cluster.isMaster) {
		// 只有在主进程有效。
		this.globalServer = undefined;
		this.serverType = SERVER_TYPE_MASTER;

		// 启动/配置/监听全局服务器。
		this.StartupGlobalServer = function() {
			this.globalServer = cluster.fork();
			
			// 全局服务器发送过来的消息。
			this.globalServer.on('message', function(msg) {
				// 全局广播。
				if (msg.BROADCAST) {
					for (var id in cluster.workers) {
						var worker = cluster.workers[id];
						if (worker == this.globalServer) continue;
						worker.send(msg);
					}
				}
				else if (msg.WORKER_ID) {
					// 指定id的服务器定点发送。
					var worker = cluster.workers[msg.WORKER_ID];
					if (!worker) return console.error("错误：未能找到对应的子服务器：WORKER_ID=" + msg.WORKER_ID);
					worker.send(msg);
				}
				else {
					console.error("错误：未识别的消息=" + JSON.stringify(msg));
				}
			});
			
			this.globalServer.send({ SERVER_TYPE: SERVER_TYPE_GLOBAL });
		}

		// 启动子进程服务器，调用一次启动一个。
		this.StartupSlaveServer = function() {
			var serverWorker = cluster.fork();
			
			// 子进程发送过来的消息。
			serverWorker.on('message', function(msg) {
				// 处理之前做一下服务器的ID标记，便于全局服务器识别。
				msg.WORKER_ID = serverWorker.id;
				// 转发给全局服务器。
				this.globalServer.send(msg);
			});
			
			serverWorker.send({ SERVER_TYPE: SERVER_TYPE_SLAVE });
		}
	}
	else {
		// 只有在子进程有效。
		this.serverType = SERVER_TYPE_NONE; // 现在还不知道我是什么服务器，要等主进程发送【SERVER_TYPE】来告诉我一下。
		
		// 发送给主服务器.
		this.Send = function(msg) {
			process.send(msg);
		}
	}
	
	// 启动相关服务器进程～
	if (cluster.isMaster) {
		// 启动全局服务器。
		StartupGlobalServer();
		
		// 默认启动一个子进程服务器
		StartupSlaveServer();
		
		// 检测到子进程退出
		cluster.on('exit', function(worker, code, signal) {
			// 全局服务器需要重启。
			if (this.globalServer == worker) {
				console.log("检测到全局服务器退出了：pid=" + worker.process.pid);
				console.log("重启全局服务器...");
				StartupGlobalServer();
			}
			else {
				console.log("检测到子服务器退出了：pid=" + worker.process.pid);
				this.globalServer.send({
					cmd: 'SlaveExit',
				});
			}
		}
	}
	else {
		// 父进程转过来的消息。
		process.on('message', function(msg) {
			if (msg.SERVER_TYPE) 
				return this.serverType = msg.SERVER_TYPE;
				
			if (this.serverType == SERVER_TYPE_GLOBAL)
				global.GlobalServer.Handle(msg);
			else if (this.serverType == SERVER_TYPE_SLAVE)
				global.SlaveServer.Handle(msg);
		});
	}
}