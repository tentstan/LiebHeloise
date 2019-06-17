"use strict"

const tunnels = require('./tunnels')

function proxysession(info, sock) {
	this.info = info;
	this.sock = sock;
	let self = this;

	this.proxy = function() {
		const tunnel = tunnels.create(Buffer.from(JSON.stringify(self.info)));
		const sock = self.sock;
		if (tunnel == null) {
			sock.end();
			return;
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
			//console.log('write sock data to ws');
			// pending data
			tunnel.send(data);
		});
	}
}

proxysession.create = function (info, sock) {
	let ps = new proxysession(info, sock);
	ps.proxy();
};

module.exports = proxysession;
