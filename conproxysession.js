"use strict"

const tunnels = require('./tunnels')

function proxysession(info, sock, head) {
	this.info = info;
	this.sock = sock;
	this.head = head
	let self = this;

	this.proxy = function() {
		const tunnel = tunnels.create(Buffer.from(JSON.stringify(self.info)));
		const sock = self.sock
		
		if (tunnel == null) {
			sock.end();
			return;
		}

		// 回复connection请求
		sock.write('HTTP/1.1 200 Connection Established\r\n' +
                    'Proxy-agent: linproxy\r\n' +
                    '\r\n');

		// write head
		if (head && head.length > 0) {
			tunnel.send(self.head);
		}
		
		tunnel.onMessage = function incoming(data) {
			sock.write(data);
		};

		tunnel.onError = function() {
			sock.destroy();
		};

		tunnel.onClose = function() {
			sock.destroy();
		};

		tunnel.onEnd = function() {
			sock.end();
		}

		sock.on('end', function() {
			tunnel.end();
		});

		sock.on('close', function() {
			tunnel.close();
		});
		
		sock.on('error', function() {
			tunnel.close();
		});
		
		sock.on('data', function(data) {
			// console.log('write sock data to ws');
			// pending data
			tunnel.send(data);
		});
	}
}

proxysession.create = function (info, sock, head) {
	let ps = new proxysession(info, sock, head);
	ps.proxy();
};

module.exports = proxysession;
