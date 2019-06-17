"use strict"

const http = require('http');
const WebSocket = require('ws');
const url = require('url')
const server = http.createServer();
const wsserver = new WebSocket.Server({ noServer: true });
const net = require('net');

function closeAllMyTunnels(ws) {
	let tunnelsHub = ws.tunnelsHub;
	Object.keys(tunnelsHub).forEach(function (item) {
		let t = tunnelsHub[item];
		t.onClose();
	});

	ws.tunnelsHub = {};
}

function senddata(t) {
	if (t.fbuffer !== undefined) {
		let buffer = t.fbuffer;
		delete(t.fbuffer);
		t.fsock.write(buffer);
	}
}

function closeTunnel(ws, t, key) {
	if (ws.readyState === WebSocket.OPEN) {
		let message = t.formatMsg(1);
		ws.send(message);
	}
	
	delete(ws.tunnelsHub[key]);
}

function tunnel(ws, key, initData) {
	let self = this;

	let info = JSON.parse(initData);

	let dstAddr = info.dstAddr;
	let dstPort = info.dstPort;
	
	let sock = new net.Socket();

	let wsSendCB = function() {
		sock.wsPending = false
		// 发送完成，继续读取
		sock.resume()
	}

	let sockOnData = function(data) {
		if (ws.readyState === WebSocket.OPEN) {
			let message = self.formatMsg(2, data);
			ws.send(message, null , wsSendCB);

			sock.wsPending = true
			// 先阻塞sock,等ws发送完毕
			sock.pause()
		} else {
			// 通道已经关闭了，需要把sock也关闭
			sockOnData.destroy()
		}
	}

	sock.connect(dstPort, dstAddr, function() {
		self.fsock = sock;
		senddata(self);
		
		if (self.isEndedByPeer) {
			sock.end();
		}
	});

	sock.on('data', sockOnData);

	sock.on('close', function() {
		closeTunnel(ws, self, key);
	});

	sock.on('error', function() {
		closeTunnel(ws, self,  key);
	});

	sock.on('end', function() {
		if (ws.readyState === WebSocket.OPEN) {
			let message = self.formatMsg(3);
			ws.send(message);
		}
	});

	self.onMessage = function(data) {
		const buf = data;
		if (self.fbuffer === undefined) {
			self.fbuffer = buf;
		} else {
			self.fbuffer = Buffer.concat([self.fbuffer, buf]);
		}

		let fsock = self.fsock;
		if (fsock !== undefined) {
			senddata(self);
		}		
	};

	self.onClose = function() {
		sock.destroy();
	};

	self.onEnd = function() {
		if (self.fsock) {
			sock.end();
		} else {
			self.isEndedByPeer = true
		}
	};

	self.formatMsg = function(code, data) {
		// 第一个字节命令字
		// 第二，第三个字节是key
		// 后面是数据
		let size = 3;
		if (data !== undefined) {
			size = size + data.length;
		}
		
		const buf = Buffer.alloc(size);
		buf.writeInt8(code, 0);
		buf.writeInt16LE(key, 1);

		if (data !== undefined) {
			data.copy(buf, 3);
		}

		return buf;
	};
}

function newTunnel(ws, key, initData) {
	let t = new tunnel(ws, key, initData);
	
	ws.tunnelsHub[key] = t;
}

function processWebsocketMessage(ws, buf) {
	// 第一个字节命令字
	// 第二，第三个字节是key
	// 后面是数据

	// 获取code
	let code = buf.readInt8(0);
	// 获取key
	let key = buf.readInt16LE(1);
	
	let t = ws.tunnelsHub[key]

	if (code == 1) {
		if (t === undefined) {
			console.log('can not found tunnel to close for key:', key);
			return;
		}
		// 如果是close命令字
		delete(ws.tunnelsHub[key]);
		t.onClose();
	} else if (code == 2) {
		if (t === undefined) {
			console.log('can not found tunnel to send for key:', key);
			return;
		}
		
		// 如果是数据命令字
		t.onMessage(buf.slice(3));
	} else if (code == 0) {
		if (t !== undefined) {
			console.log('duplicate tunnel for key:', key);
			return;
		}

		newTunnel(ws, key, buf.slice(3));
	} else if (code == 3) {
		if (t === undefined) {
			console.log('can not found tunnel to send for key:', key);
			return;
		}

		t.onEnd();
	} else {
		console.log('unsupport code:', code);
	}
}

wsserver.on('connection', function connection(ws) {
	console.log('got a ws connection')
	ws.tunnelsHub = {};
	ws.on('message', function incoming(message) {
		// console.log('received: %s', message);
		processWebsocketMessage(ws, message);
	});
  
	let to = setInterval(function(){
		if (ws.readyState === WebSocket.OPEN) {
			ws.ping();
		} else {
			clearTimeout(to);
		}
	}, 30*1000);
	
	ws.on('error', function() {
		console.log('ws error');
		//--error之后会触发close
		// clearTimeout(to);
		// closeAllMyTunnels(ws);
	});

	ws.on('close', function() {
		console.log('ws close');
		clearTimeout(to);
		closeAllMyTunnels(ws);
	});
});

server.on('upgrade', function upgrade(request, socket, head) {
  const pathname = url.parse(request.url).pathname;

  if (pathname === '/linproxy') {
    wsserver.handleUpgrade(request, socket, head, function done(ws) {
      wsserver.emit('connection', ws, request);
    });
  } else{
    socket.destroy();
  }
});

server.listen(9090);
