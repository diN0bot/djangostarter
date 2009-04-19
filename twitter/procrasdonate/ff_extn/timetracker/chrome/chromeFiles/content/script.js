/***************************************************************************/
/*                            TimeTrack Client                             */
/*                         (c) Juan Casares 2006                           */
/***************************************************************************/
/*
	Copyright 2006 Juan Casares
	
	This file is part of TimeTracker.

	TimeTracker is free software; you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation; either version 3 of the License, or
	(at your option) any later version.

	TimeTracker is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with TimeTracker; if not, write to the Free Software
	Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
/***************************************************************************/

var timetrackService = null;
var timetrackHasFocus = false;

var timetrackPaused = false;

function timetrackUpdateTime() {
	var label = document.getElementById("timetrack-label");
	if (label) {
		
		var statusbarpanel = document.getElementById("timetrack-panel");
		if (timetrackService.active && !timetrackService.paused && !timetrackService.workSite) {
			statusbarpanel.className = "active";
		}
		else {
			statusbarpanel.className = "inactive";
		}
		
		label.value = timetrackService.dayTotal;
		timetrackDrawClock(timetrackService.secDayTotal, 18, timetrackService.active, timetrackService.workSite);
	}
}

function timetrackInit () {
    /* TODO: Double check load works in FF3 */
	window.addEventListener ("load", timetrackLoad, false);
	window.addEventListener ("unload", timetrackUnload, false);

	window.addEventListener ("mousedown", timetrackHandleUserActive, true);
	window.addEventListener ("mouseout", timetrackHandleUserActive, true);
	window.addEventListener ("DOMMouseScroll", timetrackHandleUserActive, true);
	window.addEventListener ("keydown", timetrackHandleUserActive, true);
	
	window.addEventListener ("focus", timetrackHandleGotFocus, true);
	window.addEventListener ("blur", timetrackHandleLostFocus, true);

	//trackdump ("Trying to get Service");
	timetrackService = Components.classes["@usablehack.com/TimetrackService;1"]
		.getService(Components.interfaces.nsITimetrackService);
	//trackdump ("Init!");
}

function timetrackToolTipShowing () {
	//trackdump ("toolTipShowing!");
	var tooltip = document.getElementById("timetrack-tooltip");
	
	var icon = document.getElementById ("timetrack-tooltip-icon");
	var resetHours = document.getElementById ("timetrack-popup-resetHours");
	var resetDate = document.getElementById ("timetrack-popup-resetDate");
	var noResetYetLabel = document.getElementById ("timetrack-popup-noResetYet");
	var todayHours = document.getElementById ("timetrack-popup-todayHours");
	var totalHours = document.getElementById ("timetrack-popup-totalHours");
	var startDate = document.getElementById ("timetrack-popup-startDate");
	
	var noResetYet = (timetrackService.resetDate == "");
	if (noResetYet) {
		noResetYetLabel.style.display ="inherit";
		resetDate.style.display = "none";
	}
	else {
		noResetYetLabel.style.display ="none";
		resetDate.style.display = "inherit";
	}
	

	resetHours.value=timetrackFormatTime (timetrackService.secResetTotal, false);
	resetDate.value=timetrackService.resetDate;
	todayHours.value=timetrackFormatTime (timetrackService.secDayTotal, false);
	totalHours.value=Math.floor(timetrackService.secExtensionTotal / 60 / 60);
	startDate.value=timetrackService.extensionStartDate;
}

function timetrackLoad (event) {
	if (timetrackObserver == null) {
		timetrackObserver = new TimetrackObserver();
	}
	timetrackObserver.register();
	
	var tooltip = document.getElementById("timetrack-tooltip");
	tooltip.addEventListener("popupshowing", timetrackToolTipShowing, false);

	/* Get default pause value */
	timetrackPaused = branch.getBoolPref(TIMETRACK_PREF_START_PAUSED);
}

function timetrackUnload (event) {
	if (timetrackObserver) timetrackObserver.unregister();
}

function timetrackHandleUserActive (event) {
	/* ignore mousemoves if the window is not focused */
	if (!timetrackHasFocus && event.type == "mouseout") return; 
	
	timetrackService.handleUserActive();
}

function timetrackHandleGotFocus (event) {
	timetrackService.handleGotFocus();
	timetrackHasFocus = true;
}

function timetrackHandleLostFocus (event) {
	timetrackService.handleLostFocus();
	timetrackHasFocus = false;
}


function timetrackTogglePaused (event) {
	// on windows, right click calls this method
	if (event && (event.button == 2)) return;
	
	const TIMETRACK_PREF_ALLOW_PAUSE = "allowPause";
	var allowPause = branch.getBoolPref(TIMETRACK_PREF_ALLOW_PAUSE)
	if (!allowPause) return;
	
	timetrackPaused = !timetrackPaused;
	timetrackService.refresh();
}

function timetrackOpenOptions (event) {
	window.openDialog("chrome://timetrack/content/prefs.xul", "_blank", "centerscreen,chrome,resizable=yes,dependent=yes")
}

function timetrackReset (event) {
	timetrackService.reset();
}
/******************** Canvas *********************/


function timetrackDrawClock (seconds, size, active, inworksite) {
	var canvas = document.getElementById("timetrack-canvas");
	
	/** get background color */
	var backgroundColor = "";
	var backgroundElement = canvas;
	do {
		if (backgroundElement == null) {
			backgroundColor = "rgb(200,200,200)";
			break;
		}
		backgroundColor = document.defaultView.getComputedStyle(backgroundElement,"").backgroundColor;
		backgroundElement = backgroundElement.parentNode;
	}
	while (backgroundColor == "transparent");
	

	if (!canvas.getContext) return;
	
	canvas = canvas.getContext("2d");
	
	var clockEdgeLight, clockEdgeDark, faceLight, faceDark;
	
	if (inworksite) {
		clockEdgeLight = "rgb(81,81, 255)";
		clockEdgeDark = "rgb(0,0,204)";
		faceLight = "rgb(255,255,255)";
		faceDark = "rgb(200,200,220)";
	}
	else if (active) {
		clockEdgeLight = "rgb(255,81,81)";
		clockEdgeDark = "rgb(204,0,0)";
		faceLight = "rgb(255,255,255)";
		faceDark = "rgb(200,200,220)";
	}
	else {
		clockEdgeLight = "rgb(160,160,160)";
		clockEdgeDark = "rgb(140,140,140)";
		faceLight = "rgb(220,220,220)";
		faceDark = "rgb(185,185,185)";
	}
	
	var handColor = "rgba(30,30,30,0.5)";
	
	var center = size/2;
	
	/* draw background circle */
	canvas.fillStyle = backgroundColor;
	canvas.beginPath();
	canvas.arc (center, center, size/2-0.5, 0 * Math.PI, 2 * Math.PI, true);
	canvas.fill();
	
	/* draw edge */
	var clockEdgeGradient = canvas.createRadialGradient(center,center,size/2,center-2,center-2,size/2-3);
	clockEdgeGradient.addColorStop(0, clockEdgeDark);
	clockEdgeGradient.addColorStop(1, clockEdgeLight);
	
	canvas.fillStyle = clockEdgeGradient;
	canvas.beginPath();
	canvas.arc (center, center, size/2-1, 0 * Math.PI, 2 * Math.PI, true);
	canvas.fill();
	
	/* draw face */ 
	var faceGradient = canvas.createRadialGradient(center+4,center+4,size/2-4,center,center,size/2+1);
	faceGradient.addColorStop(0, faceDark);
	faceGradient.addColorStop(0.5, faceLight);
			
	canvas.fillStyle = faceGradient;
	canvas.beginPath();
	canvas.arc (center, center, size/2-1-2, 0 * Math.PI, 2 * Math.PI, true);
	canvas.fill();
	
	/* draw hand */
	const secondsInFullTurn = 30;
	seconds = (seconds + secondsInFullTurn/2) % secondsInFullTurn;
	canvas.save();
	canvas.translate (center, center);
	canvas.rotate (seconds / secondsInFullTurn * 2 * Math.PI);
	canvas.strokeStyle = handColor;
	canvas.linewidth = 1.5;
	
	canvas.beginPath();
	canvas.moveTo (0.8, -2.0);
	canvas.lineTo (0, size/2-6);
	canvas.lineTo (-0.8, -2.0);
	canvas.stroke();
	canvas.restore();
	
	/* draw pause */
	if (timetrackPaused) {
		var pauseBorder = "rgb(0,0,50)";
		var pauseBackground = "rgb(255, 233, 16)";
		canvas.save();
		canvas.translate (center, center);
		canvas.fillStyle = pauseBackground;
		canvas.strokeStyle = pauseBorder;
		canvas.lineWidth = 0.25;
		const pauseHeight = size*0.5;
		const pauseWidth = size * 0.25;
		const halfGap = 0.75;
		canvas.fillRect (-pauseWidth-halfGap, -pauseHeight*0.5, pauseWidth, pauseHeight);
		canvas.fillRect ( halfGap, -pauseHeight*0.5, pauseWidth, pauseHeight);
		
		canvas.strokeRect (-pauseWidth-halfGap, -pauseHeight*0.5, pauseWidth, pauseHeight);
		canvas.strokeRect ( halfGap, -pauseHeight*0.5, pauseWidth, pauseHeight);
		canvas.restore();
	}
}

/*********** Timetrack Service Observer *****************/

var timetrackObserver = null;

function TimetrackObserver() {
}
TimetrackObserver.prototype = {
	observe: function(subject, topic, data) {
		timetrackUpdateTime();
	},

	register: function() {
		var observerService = Components.classes["@mozilla.org/observer-service;1"]
							  .getService(Components.interfaces.nsIObserverService);
		this.unregister(); 
		observerService.addObserver(this, "timetrack-event", false);
	},
	
	unregister: function() {
		var observerService = Components.classes["@mozilla.org/observer-service;1"]
							.getService(Components.interfaces.nsIObserverService);
		try { 
			observerService.removeObserver(this, "timetrack-event");
		}
		catch (e) { /* ignore */ }
	}
};
/***************************************************/


function trackdump (msg) {
	var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);

	consoleService.logStringMessage("Timetrack: " + msg);
}

function timetrackFormatTime (s, showSeconds) { /* taken from tracktools */
	var seconds = s % 60;
	var minutes = Math.floor(s/60) % 60;
	var hours = Math.floor (s / 60 / 60);
	
	var buf = "";
	
	if ((hours > 0) || (!showSeconds && minutes > 0)) 
		buf += hours + ":" + addLeadingZero(minutes);
	else
		buf += minutes;
	
	if (showSeconds) {
		buf += ":" + addLeadingZero (seconds);
	}
	
	return buf;
}

function addLeadingZero(x) { /* taken from tracktools */
	return ((x<0 || x>9) ?"":"0") + x;
}


const TIMETRACK_PREF_ID = "@mozilla.org/preferences-service;1";
const TIMETRACK_PREF_I = Components.interfaces.nsIPrefService;
const TIMETRACK_PREF_BRANCH ="extensions.timetrack.";
const TIMETRACK_PREF_START_PAUSED = "startPaused";
var prefs = Components.classes[TIMETRACK_PREF_ID].getService(TIMETRACK_PREF_I);
var branch = prefs.getBranch(TIMETRACK_PREF_BRANCH);

timetrackInit();