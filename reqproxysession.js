"use strict"

const tunnels = require('./tunnels')

function proxysession(info, req, res, path) {
	this.info = info;
	this.req = req;
	this.res = res
	let self = this;

	this.proxy = function() {
		const tunnel = tunnels.create(Buffer.from(JSON.stringify(self.info)));
		const res = self.res;
		const req = self.req;
		
		if (tunnel == null) {
			res.end();
			req.destroy();
			return;
		}

		// write head
		let strHead = `${req.method} ${path} HTTP/${req.httpVersion}\r\n`;
		const headers = self.req.rawHeaders;
		const count = headers.length/2;
		for(var i = 0; i < count; i++) {
			let line = `${headers[2*i]}:${headers[2*i + 1]}\r\n`;
			strHead = strHead + line
		}
		strHead = strHead + "\r\n";

		//console.log(strHead);
		tunnel.send(Buffer.from(strHead));

		tunnel.onMessage = function incoming(data) {
			// console.log('tunnel write data to req.socket');
			if (req.socket) {
				req.socket.write(data);
			}
		};

		tunnel.onError = function() {
			//console.log('tunnel.onError ');
			req.destroy();
			res.destroy();
		};
		
		tunnel.onClose = function() {
			//console.log('tunnel.onClose ');
			req.destroy();
			res.destroy();
		};

		tunnel.onEnd = function() {
			if (req.socket) {
				req.socket.end();
			}
		}

		req.on('aborted', function() {
			console.log('res close');
			tunnel.close();
		});

		req.socket.on('end', function() {
			//console.log('req socket end');
			tunnel.end();
		});

		req.on('close', function() {
			//console.log('req close');
			// tunnel.close();
		});

		req.on('data', function(data) {
			// console.log('write req data to ws');
			// pending data
			tunnel.send(data);
		});
	}
}

proxysession.create = function (info, req, res, path) {
	let ps = new proxysession(info, req, res, path);
	ps.proxy();
};

module.exports = proxysession;
