"use strict"

const WebSocket = require('ws');
//const wsurl = 'ws://localhost:9090/linproxy';
const wsurl = 'ws://www.in8818.dev/LiebHeloise@871115';
//const wsurl = '';
/*
	open:0
	close:1
	data:2
	end:3
*/
const maxWS = 5;

let wsHub = [];

function allocWS() {
	let le = wsHub.length;
	if (le < 1) {
		return undefined;
	}
	
	let i = Math.floor(Math.random() * (le));
	return wsHub[i];
}

function deleteWS(ws) {
	let le = wsHub.length;
	for(let i = 0; i < le; i++) {
		if (wsHub[i] === ws) {
			wsHub = wsHub.slice(i,1);
			return;
		}
	}
}

function allocKey(ws) {
	let tunnelsHub = ws.tunnelsHub;
	let index = ws.tIndex;
	if (index === undefined) {
		index = 0;
		ws.tIndex = index;
	}
	
	for(let i = index; i < 10000; i++) {
		if (tunnelsHub[i] === undefined) {
			ws.tIndex = i + 1;
			return i;
		}
	}
	
	for (let i = 0; i < index; i++) {
		if (tunnelsHub[i] === undefined) {
			ws.tIndex = i + 1;
			return i;
		}
	}
	
	console.log('failed to alloc key');
}

function closeAllMyTunnels(ws) {
	let tunnelsHub = ws.tunnelsHub;
	Object.keys(tunnelsHub).forEach(function (item) {
		let t = tunnelsHub[item];
		t.onClose();
	});

	ws.tunnelsHub = {};
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
	if (t === undefined) {
		console.log('can not found tunnel for key:', key, ', code:', code);
		return;
	}

	if (code == 1) {
		// 如果是close命令字
		delete(ws.tunnelsHub[key])
		t.onClose();
	} else if (code == 2) {
		// 如果是数据命令字
		t.onMessage(buf.slice(3));
	} else if (code == 3) {
		t.onEnd();
	} else {
		console.log('unsupport code:', code);
	}
}

function tunnel(ws, key) {
	let self = this;
	
	self.send = function(data) {
		if (ws.readyState === WebSocket.OPEN) {
			let message = self.formatMsg(2, data);
			ws.send(message);
		}
	}
	
	self.close = function() {
		if (ws.readyState === WebSocket.OPEN) {
			let message = self.formatMsg(1);
			ws.send(message);
		}

		delete(ws.tunnelsHub[key])
	}

	self.end = function() {
		if (ws.readyState === WebSocket.OPEN) {
			let message = self.formatMsg(3);
			ws.send(message);
		}
	}

	self.open = function(initData) {
		if (ws.readyState === WebSocket.OPEN) {
			let message = self.formatMsg(0, initData);
			ws.send(message);
		}
		
		ws.tunnelsHub[key] = self;
	}

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
	}

	return self;
}

let wsCountInNew = 0;
function newWebsocket() {
	if ((wsCountInNew  + wsHub.length )>= maxWS) {
		return;
	}

	console.log('newWebsocket, try to create websocket connection');
	wsCountInNew++;
	const ws = new WebSocket(wsurl);
	ws.tunnelsHub = {};

	ws.on('open', function open() {
		wsCountInNew--;
		console.log('ws connect ok');
		wsHub.push(ws);
		ws.on('message', function incoming(data) {
			processWebsocketMessage(ws, data);
		});
	});

	ws.on('error', function() {
		console.log('ws error');
		//--error之后会触发close
		// deleteWS(ws);
		// closeAllMyTunnels(ws);
	});

	ws.on('close', function() {
		console.log('ws close');
		wsCountInNew--;
		deleteWS(ws);
		closeAllMyTunnels(ws);
	});
}

tunnel.create = function(initData) {
	let ws = allocWS();
	if (ws === undefined) {
		newWebsocket();
		return null;
	}

	let key = allocKey(ws);

	let t = new tunnel(ws, key);
	t.open(initData);
	
	return t;
}

let hasSetup = false;
tunnel.setupWS = function() {
	if (hasSetup) {
		return;
	}
	
	hasSetup = true;

	for(let i = 0; i < maxWS; i++) {
		newWebsocket();
	}
	
	setInterval( function(){
		if (wsHub.length < maxWS) {
			newWebsocket();
		}
	}, 30*1000);
};

module.exports = tunnel;
