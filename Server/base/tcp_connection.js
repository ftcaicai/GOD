
var EventEmitter = require('events').EventEmitter;
var Util = require('util');

function TcpConnection(server, socket, send_size) {
	this.server = server;
	this.socket = socket;
	this.recvBuffer = new Buffer(send_size || 64 * 1024);
	this.sendBuffer = new Buffer(send_size || 64 * 1024);
	this.sendSequence = 1;
	this.sendSize = 0;
	this.outputPaused = false;
	
    this.socket.on('error', this.handleSocketError.bind(this));
    this.socket.on('data', this.handleSocketData.bind(this));
    this.socket.on('end', this.handleSocketEnd.bind(this));
    this.socket.on('close', this.handleSocketClose.bind(this));
    this.socket.on('drain', this.handleSocketDrain.bind(this));
}

Util.inherits(TcpConnection, EventEmitter);

TcpConnection.prototype.handleSocketError = function() {
	// Emitted when an error occurs. The 'close' event will be called directly following this event.
}

TcpConnection.prototype.handleSocketData = function(data) {
	if (!Buffer.isBuffer(data)) return;
	
	var ptr = 0;
	this.recvBuffer
}

TcpConnection.prototype.handleSocketEnd = function() {
	this.socket.end();
}

TcpConnection.prototype.handleSocketClose = function(had_error) {
    if (!this.closeEventEmitted) {
        this.closeEventEmitted = true;
        this.emit('close', this);
    }
}

TcpConnection.prototype.handleSocketDrain = function() {
	this.outputPaused = false;
}

TcpConnection.prototype.processOutgoing = function() {
    if (this.outputPaused) return;
	if (this.sendSize == 0) return;
	
	var flushed = true;
	try {
		var sendSize = this.sendSize;
		this.sendSize = 0;
		
		flushed = this.socket.write(this.sendBuffer.slice(0, sendSize));
	}
	catch (e) {
		this.socket.destroy();
		return;
	}
	
	if (!flushed)
		this.outputPaused = true;
	else
		process.nextTick(this.processOutgoing);
}

TcpConnection.prototype.sendBytes = function(data) {
	var packageSize = 3 + data.length;
	if (this.sendSize + packageSize >= this.sendBuffer.length) {
		this.emit('error', 'send buffer is overflow!!!');
		this.socket.destroy();
	}
	
	this.sendBuffer.writeUInt8(packageSize & 0xff, this.sendSize);
	this.sendBuffer.writeUInt16LE(this.sendSequence, this.sendSize + 1);
	data.copy(this.sendBuffer, this.sendSize + 3);
	this.sendSequence++;
	this.sendSize += packageSize;
	this.processOutgoing();
}

exports.TcpConnection = TcpConnection;