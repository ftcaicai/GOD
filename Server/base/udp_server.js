
var Dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;
var Util = require('util');
var UDPConnection = require('./udp_connection').UDPConnection;

// UDP server flag.
const UDP_ACK_FLAG = 0x80;
const UDP_ORDER_FLAG = 0x40;
const UDP_HEADER_MASK = 0x3f;
const UDP_HEADER_SIZE = 0x03;
const UDP_INIT_CODE = (UDP_ACK_FLAG | UDP_ORDER_FLAG | UDP_HEADER_SIZE);
const UDP_ACK_CODE = (UDP_HEADER_SIZE);

/////////////////////////////////////////////////////////////////////////////////////
// UDPServer服务器相关代码。
/////////////////////////////////////////////////////////////////////////////////////
function UDPServer() {
	this.Dgram = undefined;
	this.Connections = {};
}
Util.inherits(UDPServer, EventEmitter);

// UDP服务器初始化。
UDPServer.prototype.init = function(ver) {
	var self = this;
	self.Dgram = Dgram.createSocket(ver || 'udp4');
	self.Dgram.on('message', function (message, remote) {
		self.onData(message, remote);
	});
}

// 开始监听。
UDPServer.prototype.listen = function(port) {
	this.Dgram.bind(port);
}

// 掉线了～～～
UDPServer.prototype.dropConnection = function(reason, connection) {
	var remote = connection.remote;
	var key = remote.address + ":" + remote.port;
	var connection = this.Connections[key];
	if (connection !== undefined)
		delete this.Connections[key];
}

// 服务器接收到数据，有可能是任意地方过来的。
// 这里需要验证是否为咱们可靠的链接。
UDPServer.prototype.onData = function(data, remote) {
	var self = this;
	var key = remote.address + ":" + remote.port;
	var connection = self.Connections[key];
	if (connection === undefined) {
		// the first frame should be [UDP_INIT_CODE][CLIENT_SEQ]
		if (data.length !== UDP_HEADER_SIZE || data[0] !== UDP_INIT_CODE)
			return console.log("收到不明UDP消息，不符合条件所以拒绝！！！"); //;//
		
		return self.emit('request', data, remote);
	}
	
	// 数据长度太小～
	if (data.length < UDP_HEADER_SIZE)
		return console.log("数据包太小！！！"); //;//
	
	// 处理数据包的问题，简单检查一下数据包的内容。
	if ((data.length & UDP_HEADER_MASK) !== (data[0] & UDP_HEADER_MASK))
		return console.log("数据包校验出错！！！" + data.length); //;//
	
	// 这个包消息是需要回答的。
	var code = data[0];
	var ack = ((code & UDP_ACK_FLAG) == UDP_ACK_FLAG);
	var order = ((code & UDP_ORDER_FLAG) == UDP_ORDER_FLAG);
	var sequence = data.readUInt16LE(1);
	
	// 此数据包需要回应。
	if (ack) this.sendBytes(new Buffer([UDP_ACK_CODE, data[1], data[2]]), remote);
	
	// 应答，或者keepAlive消息。
	if (code === UDP_ACK_CODE)
		return connection.onAckSequence(sequence);
	
	// 调用消息处理
	if (data.length > UDP_HEADER_SIZE)
		connection.onMessage(data.slice(UDP_HEADER_SIZE), sequence, ack, order);
}

// 接受该ip为链接～。
UDPServer.prototype.accept = function(data, remote) {
	var self = this;
	var key = remote.address + ":" + remote.port;
	
	var sequence = data.readUInt16LE(1);
	var connection = new UDPConnection(self, remote, sequence);
	
	// 初始的链接包需要回答～
	this.sendBytes(new Buffer([UDP_ACK_CODE, data[1], data[2]]), remote);
	
	connection.on('close', function(reason) {
		self.dropConnection(reason, connection);
	});
	self.Connections[key] = connection;
	return connection;
}

// 给链接用于编译包的。
UDPServer.prototype.buildPackage = function(buff, sequence, ack, order) {
	var data = new Buffer(buff.length + UDP_HEADER_SIZE);
	var code = data.length & UDP_HEADER_MASK;
	if (ack) code |= UDP_ACK_FLAG;
	if (order) code |= UDP_ORDER_FLAG;
	data[0] = code;
	data.writeUInt16LE(sequence, 1);
	buff.copy(data, UDP_HEADER_SIZE);
	return data;
}

// 发送消息。
UDPServer.prototype.sendBytes = function(data, remote) {
	if (data.length == 0) return;
	this.Dgram.send(
		data, 
		0, 
		data.length,
		remote.port,
		remote.address);
}

// 导出给人家用。
exports.createServer = function(ver) {
	var server = new UDPServer();
	server.init(ver);
	return server;
}
