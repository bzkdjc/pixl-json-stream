// JSON Buffer Stream
// Handles buffering JSON records over standard streams (pipes or sockets)
//
// Assumes one entire JSON document per line, delimited by Unix EOL (\n).
// Emits 'json' event for each JSON document received.
// write() method accepts object to be JSON-stringified and written to stream.
// Passes errors thru on 'error' event (with addition of JSON parse errors).
//
// Copyright (c) 2014 Joseph Huckaby
// Released under the MIT License

var Class = require("pixl-class");

module.exports = Class.create({
	
	streamIn: null,
	streamOut: null,
	buffer: '',
	perf: null,
	recordRegExp: /^\s*\{/,
	eoj: "\n",   // end-of-json as opposed to EOL
	
	__construct: function(stream_in, stream_out) {
		// class constructor
		if (!stream_out) stream_out = stream_in;
		
		this.streamIn = stream_in;
		this.streamOut = stream_out;

		this.init();
	},
	
	setPerf: function(perf) { this.perf = perf; },

	setEoJ: function(eoj) { this.eoj = eoj; },
	
	init: function() {
		// hook stream read
		var self = this;
		
		this.streamIn.setEncoding('utf8');
		this.streamIn.on('data', function(data) {
			if (self.buffer) {
				data = self.buffer + data;
				self.buffer = '';
			}
			
			var records = data.split(new RegExp(self.eoj));
			
			// see if data ends on EOL -- if not, we have a partial block
			// fill buffer for next read
			if (data.substring(data.length - self.eoj.length) != self.eoj) {
				self.buffer = records.pop();
			}
			
			var record = '';
			var json = null;
			
			for (var idx = 0, len = records.length; idx < len; idx++) {
				record = records[idx];
				if (record.match(self.recordRegExp)) {
					json = null;
					
					if (self.perf) self.perf.begin('json_parse');
					try { json = JSON.parse(record); }
					catch (e) {
						self.emit('error', new Error("JSON Parse Error: " + e.message), record);
					}
					if (self.perf) self.perf.end('json_parse');
					
					if (json) {
						self.emit('json', json);
					}
				} // record has json
				else if (record.length && record.match(/\S/)) {
					// non-json garbage, emit just in case app cares
					self.emit('text', record + self.eoj);
				}
			} // foreach record
			
		} );
		
		// passthrough errors, other events
		this.streamIn.on('error', function(e) {
			self.emit('error', e);
		} );
		this.streamIn.on('end', function() {
			self.emit('end');
		} );
	},
	
	write: function(json, callback) {
		// write json data to stream plus EOL
		if (this.perf) this.perf.begin('json_compose');
		var data = JSON.stringify(json);
		if (this.perf) this.perf.end('json_compose');
		
		this.streamOut.write( data + this.eoj, callback );
	}
	
});
