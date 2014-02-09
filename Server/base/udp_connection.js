
var EventEmitter = require('events').EventEmitter;
var Util = require('util');

/////////////////////////////////////////////////////////////////////////////////////
// UDPConnection服务器相关代码。
/////////////////////////////////////////////////////////////////////////////////////
function UDPConnection(server, remote, clientSequence) {
	this.server = server;
	this.remote = remote;
	this.clientSequence = clientSequence;
	this.serverSequence = 10;
	this.orderclientSequence = clientSequence;
	this.keepaliveInterval = 30 * 1000;
	this.resendTimeout = 200;
	this.requestQueue = [];
	this.pendingRequest = null;
	this._keepaliveTimerHandler = this.handleKeepaliveTimer.bind(this);
	this._resendPackage = this.resendPackage.bind(this);
	this.setKeepaliveTimer();
}
Util.inherits(UDPConnection, EventEmitter);

// 超时调用到了。
UDPConnection.prototype.handleKeepaliveTimer = function() {
	this._keepaliveTimeoutID = null;
	var now = (new Date()).getTime();
	var inActiveTime = now - this._lastAliveTime;
	if (inActiveTime < this.keepaliveInterval)
		this._keepaliveTimeoutID = setTimeout(this._keepaliveTimerHandler, this.keepaliveInterval - inActiveTime);
	else
		this.close('TimeOut');
}

// 当数据收到的时候开始设置超时计时器。
UDPConnection.prototype.setKeepaliveTimer = function() {
	this._lastAliveTime = (new Date()).getTime();
    if (!this._keepaliveTimeoutID)
		this._keepaliveTimeoutID = setTimeout(this._keepaliveTimerHandler, this.keepaliveInterval);
};

// 收到数据消息。
UDPConnection.prototype.onMessage = function(message, sequence, ack, order) {
	this.setKeepaliveTimer();
	
	// 检查消息的序列。需要保证次序的包，丢弃序列号小的。
	if (order) {
		// 次数据包需要保证次序。
		if (sequence <= this.orderclientSequence)
			return console.log("收到按序数据报，但是由于序列号不同过滤：" + sequence + " <= " + this.orderclientSequence);
		this.orderclientSequence = sequence;
	}
	
	// 忽略相同序号的数据包
	if (this.clientSequence === sequence) return; 
	
	// 记录最大的包序号～
	if (sequence > this.clientSequence) this.clientSequence = sequence;
	
	this.emit('message', message);
}

// 收到应答消息。
UDPConnection.prototype.onAckSequence = function(sequence) {
	this.setKeepaliveTimer();
	
	// 这个消息只是一个单纯的Keepalive消息。
	if (sequence == 0) return;
	
	// 客户端请求关闭的消息。
	if (sequence == 1) return this.close('ClientRequest');
	
	if (this.pendingRequest && this.pendingRequest.sequence === sequence) {
		// 成功获取应答消息。
		var callback = this.pendingRequest.cb;
		this.pendingRequest = null;
		if (callback) callback(0);
		// 清除之前的定时器。
		if (this._resendPackageTimer)
			clearTimeout(this._resendPackageTimer);
		this._resendPackageTimer = null;
		// 尝试重新发送消息。
		this.trySend();
	}
}

// 发送消息。
UDPConnection.prototype.sendBytes = function(buff, ack, order, cb) {
	var sequence = this.serverSequence++;
	var data = this.server.buildPackage(buff, sequence, ack, order);
	this.requestQueue.push({data: data, ack: ack, sequence: sequence, cb: cb});
	this.trySend();
}

// 重新发送数据包。
UDPConnection.prototype.resendPackage = function() {
	if (this.pendingRequest) {
		this.server.sendBytes(this.pendingRequest.data, this.remote);
		this.pendingRequest.ack--;
		// 安排下次发送的时间
		if (this.pendingRequest.ack > 0)
			this._resendPackageTimer = setTimeout(this._resendPackage, this.resendTimeout);
		else {
			// 发送超时了。悲剧～～～
			//var callback = this.pendingRequest.cb;
			//this.pendingRequest = null;
			//if (callback) callback(-1);
			close('time out');
		}
	}
}

// 尝试发送信息。
UDPConnection.prototype.trySend = function() {
	// 如果还有等待应答的消息，则一直等待。
	if (this.pendingRequest) return;
	
	// 处理队列中的消息。
	while (this.requestQueue.length > 0) {
		var pkg = this.requestQueue.shift();
		this.server.sendBytes(pkg.data, this.remote);
		if (pkg.ack) {
			this.pendingRequest = pkg;
			if (!this._resendPackageTimer)
				this._resendPackageTimer = setTimeout(this._resendPackage, this.resendTimeout);
			break;
		}
	}
}

// 关闭当前连接。
UDPConnection.prototype.close = function(reason) {
    if (this._keepaliveTimeoutID)
        clearTimeout(this._keepaliveTimeoutID);
	this._keepaliveTimeoutID = null;
	this.emit('close', reason, this);
}

exports.UDPConnection = UDPConnection;
