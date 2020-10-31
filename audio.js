/*
 * Copyright (c) 2020 Ambrose Chua. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

/**
 * Auditory visualization of velocity with WebAudio
 */

var AudioContext = window.AudioContext || window.webkitAudioContext;

(function() {

var self = window.AudioVisualizerContext = function() {
	/**
	 * Prepare WebAudio Context
	 */
	this.ctx = new AudioContext();

	/**
	 * Route a silencer
	 */
	var gainNode = this.ctx.createGain();
	gainNode.connect(this.ctx.destination);

	/**
	 * Route an oscillator
	 */
	var oscNode = this.ctx.createOscillator();
	oscNode.connect(gainNode);
	oscNode.start();

	this.gain = gainNode.gain;
	this.gain.value = 0.0;
	this.frequency = oscNode.frequency;

	this.bezier = null;
	this.duration = null;
	this.lastStartTime = -Infinity;
};

self.prototype = {
	get currentTime() {
		return this.ctx.currentTime;
	},

	get running() {
		return this.currentTime - this.duration < this.lastStartTime;
	},

	get bezierSteps() {
		return 100 * this.duration;
	},

	get fadeTime() {
		return 0.005;
	},

	getGradient(t) {
		// t: [0.0, 1.0]
		// returns (x, y, gradient)
		// P0, P1, P2, P3 are the control points
		// Q0, Q1, Q2 are the intermediate points
		// R0, R1 describe the curve
		// B is a point in the curve
		function tween(t, a, b) {
			return [t * b[0] + (1-t) * a[0], t * b[1] + (1-t) * a[1]];
		}
		var P0 = [0, 0], P1 = this.bezier.P1, P2 = this.bezier.P2, P3 = [1, 1];
		var Q0 = tween(t, P0, P1), Q1 = tween(t, P1, P2), Q2 = tween(t, P2, P3);
		var R0 = tween(t, Q0, Q1), R1 = tween(t, Q1, Q2);
		var B = tween(t, R0, R1);
		var gradient = (R1[1] - R0[1]) / (R1[0] - R0[0]);
		return [B[0], B[1], gradient];
	},

	getParam: function(t) {
		var point = this.getGradient(t);
		var x = point[0], gradient = point[2];
		var frequency = Math.min(150 + Math.abs(gradient) * 200, 6000);
		var time = x * this.duration;
		return [frequency, time];
	},

	reverse: function() {
		var currentTime = this.currentTime;

		// Compute back the progress through time
		// TODO: This is incorrect, it should be based upon position (y value) rather than time 
		var remainingTime = currentTime - this.lastStartTime;

		this.lastStartTime = currentTime - (this.duration - remainingTime);

		// Remove previously scheduled changes
		this.frequency.cancelScheduledValues(currentTime);
		this.gain.cancelScheduledValues(currentTime);

		for (var t = 0; t <= 1; t += 1 / this.bezierSteps) {
			var p = this.getParam(t);
			var frequency = p[0], time = p[1] - (this.duration - remainingTime);
			if (time < 0) {
				continue;
			}
			this.frequency.linearRampToValueAtTime(frequency, currentTime + time);
		}

		this.gain.setValueAtTime(1.0, currentTime + remainingTime - this.fadeTime);
		this.gain.linearRampToValueAtTime(0.0, currentTime + remainingTime);
	},

	start: function() {
		var currentTime = this.currentTime;

		this.lastStartTime = this.currentTime;

		for (var t = 0; t <= 1; t += 1 / this.bezierSteps) {
			var p = this.getParam(t);
			var frequency = p[0], time = p[1];
			this.frequency.linearRampToValueAtTime(frequency, currentTime + time);
		}

		this.gain.setValueAtTime(0.0, currentTime);
		this.gain.linearRampToValueAtTime(1.0, currentTime + this.fadeTime);
		this.gain.setValueAtTime(1.0, currentTime + this.duration - this.fadeTime);
		this.gain.linearRampToValueAtTime(0.0, currentTime + this.duration);
	},
};

})();

var av = null;

function visualizeSound(bezier, duration) {
	if (!av) {
		av = new AudioVisualizerContext();
	}
	av.bezier = bezier;
	av.duration = duration;
	if (av.running) {
		av.reverse();
	} else {
		av.start();
	}
}
