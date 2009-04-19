/***************************************************************************/
/*                            TimeTrack Server                             */
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

const TIMETRACK_NOTIFIER_ID = "@mozilla.org/consoleservice;1";
const TIMETRACK_NOTIFIER_I =  Components.interfaces.nsIConsoleService;

const TIMETRACK_OBSERVER_ID = "@mozilla.org/observer-service;1";
const TIMETRACK_OBSERVER_I =  Components.interfaces.nsIObserverService;

const TIMETRACK_TIMER_ID = "@mozilla.org/timer;1";
const TIMETRACK_TIMER_I = Components.interfaces.nsITimer;

const TIMETRACK_PREF_ID = "@mozilla.org/preferences-service;1";
const TIMETRACK_PREF_I = Components.interfaces.nsIPrefService;

const TIMETRACK_WINDOW_WATCHER_ID ="@mozilla.org/embedcomp/window-watcher;1";
const TIMETRACK_WINDOW_WATCHER_I = Components.interfaces.nsIWindowWatcher;

var trackTools = {
trackdump: function (msg) {
	trackTools.getService (TIMETRACK_NOTIFIER_ID, TIMETRACK_NOTIFIER_I).logStringMessage("TimetrackService: " + msg);
},

getService: function (id, interface) {
	return Components.classes[id].getService(interface);
},

getInstance: function (id, interface) {
	return Components.classes[id].createInstance(interface);	
},

msToSeconds: function (ms) {
	return Math.round (ms/1000);
},

addLeadingZero: function (x) {
	return ((x<0 || x>9) ?"":"0") + x;
}, 

formatTime: function (s, showSeconds) {
	if (s<0) trackTools.trackdump ("s negative: " + s);
	var seconds = s % 60;
	var minutes = Math.floor(s/60) % 60;
	var hours = Math.floor (s / TIMETRACK_SECONDS_IN_HOUR);
	
	var buf = "";
	
	if ((hours > 0) || (!showSeconds && minutes > 0)) 
		buf += hours + ":" + trackTools.addLeadingZero(minutes);
	else
		buf += minutes;
	
	if (showSeconds) {
		buf += ":" + trackTools.addLeadingZero (seconds);
	}
	
	return buf;
},

/** use iso standard - hard to believe there is no localized short date in javascript */
formatDate: function (date) {
	var s = date.getFullYear() + "-" + trackTools.addLeadingZero (date.getMonth()+1);
	s += "-" + trackTools.addLeadingZero (date.getDate())
	return s;
},

secTimezoneOffset: new Date().getTimezoneOffset() * 60,

getSecDayStart: function(seconds) {
	var offsets = trackTools.secTimezoneOffset + TIMETRACK_SEC_NEW_DAY_OFFSET;
	var day = Math.floor ((seconds - offsets) / TIMETRACK_SECONDS_IN_DAY);
	var start = (day * TIMETRACK_SECONDS_IN_DAY) + offsets;

	//trackTools.trackdump (trackTools.secTimezoneOffset + "Day: " + day + "    DayStart: " + start + "    now: " + seconds + "     dif:" + (seconds-start));
	return start;
}

}; /* track tools ************************************************************************/

/***************************************************************************/

const TIMETRACK_MS_LOST_FOCUS_TOLERANCE = 1000;
const TIMETRACK_SECONDS_IN_HOUR = 60*60;
const TIMETRACK_SECONDS_IN_DAY = TIMETRACK_SECONDS_IN_HOUR*24;
const TIMETRACK_SEC_NEW_DAY_OFFSET = 4 * TIMETRACK_SECONDS_IN_HOUR;  /* start days at 4:00am */

const TIMETRACK_MS_TICTOC_LENGTH = 80;

const TIMETRACK_PREF_BRANCH ="extensions.timetrack.";
const TIMETRACK_PREF_SEC_DAY_TOTAL = "secDayTotal";
const TIMETRACK_PREF_SEC_DAY_START = "secDayStart";
const TIMETRACK_PREF_SEC_TIMEOUT_LENGTH = "secTimeoutLength";
const TIMETRACK_PREF_SEC_SAVE_INTERVAL = "secSaveInterval";
const TIMETRACK_PREF_WORKSITEs = "workSites";
const TIMETRACK_PREF_BIRTHDATE = "birthDate";
const TIMETRACK_PREF_LIFE_TOTAL = "secLifeTotal";
const TIMETRACK_PREF_RESET_DATE = "resetDate";
const TIMETRACK_PREF_RESET_TOTAL = "secResetTotal";
const TIMETRACK_PREF_START_PAUSED = "startPaused";
const TIMETRACK_PREF_ALLOW_PAUSE = "allowPause";
const TIMETRACK_PREF_SHOW_SECONDS = "showSeconds";
const TIMETRACK_PREF_DISPLAY_MODE = "displayMode";

const TIMETRACK_DISPLAY_TODAY = 0;
const TIMETRACK_DISPLAY_RESET = 1;
const TIMETRACK_DISPLAY_LIFE = 2;


function TimetrackService() {
	this.init();
}
TimetrackService.prototype = {

	secSessionStart: 0,
	secDayStart: 0,
	secLastInteraction: 0,
	msLastLostFocus: 0,
	secTimeoutLength: 0,
	secNextTimeout: 0,
	secLastSecond: 0,
	secDayTotal: 0,
	secNextSave: 0,
	secSaveInterval: 0,
	secNextAlarm: 0,
	windowActive: null,
	strActiveLocation: null,
	boolActive: false,
	boolInWorkSite: false,
	boolPaused: false,
	boolShowSeconds: true,
	displayMode: TIMETRACK_DISPLAY_TODAY, 
	strDayTotal: "",
	secLifeTotal: 0,
	strBirthDate : "",
	secResetTotal: 0,
	strResetDate : "",
	timer: null,
	timerObserver: null,
	quitObserver: null,
	propertyChangeObserver: null,
	workSites: [],
	branch: null,

	/** nsISupports */
	QueryInterface: function (iid) {
		if (!iid.equals(Components.interfaces.nsITimetrackService) && !iid.equals(Components.interfaces.nsISupports)) {
			throw Components.results.NS_ERROR_NO_INTERFACE;
		}
		return this;
	},
	
	/** startup */
	init: function () {
		this.timerObserver = new TimetrackTimerObserver(this);
		
		this.quitObserver = new TimetrackQuitObserver (this);
		trackTools.getService(TIMETRACK_OBSERVER_ID, TIMETRACK_OBSERVER_I).addObserver(this.quitObserver,"quit-application-requested",false);
		
		this.timer = trackTools.getInstance (TIMETRACK_TIMER_ID, TIMETRACK_TIMER_I);
		this.timer.init(this.timerObserver, TIMETRACK_MS_TICTOC_LENGTH, this.timer.TYPE_REPEATING_SLACK);
	},
	
	initValues: function () {
		var now = trackTools.msToSeconds(Date.now());
		
		/* preferences */
		var prefs = trackTools.getService (TIMETRACK_PREF_ID, TIMETRACK_PREF_I);
		this.branch = prefs.getBranch(TIMETRACK_PREF_BRANCH);
		this.branch.QueryInterface(Components.interfaces.nsIPrefBranch2);
		var prefSecDayStart = this.branch.getIntPref(TIMETRACK_PREF_SEC_DAY_START);
		
		this.propertyChangeObserver = new TimetrackPropertyChangeObserver();
		this.branch.addObserver ("", this.propertyChangeObserver, false);
		
		this.secDayStart = trackTools.getSecDayStart (now);
		if (this.secDayStart == prefSecDayStart) { /* same day - keep saved day total */
			this.secDayTotal = this.branch.getIntPref(TIMETRACK_PREF_SEC_DAY_TOTAL);
			//trackTools.trackdump ("Using saved total: " + this.secDayTotal);
		}
		else { /* new day */
			this.secDayTotal = 0;
			//trackTools.trackdump ("New day");
		}
		
		this.strBirthDate = this.branch.getCharPref(TIMETRACK_PREF_BIRTHDATE);
		if (this.strBirthDate == "") {
			var date = trackTools.formatDate (new Date());
			this.strBirthDate = date;
			this.branch.setCharPref(TIMETRACK_PREF_BIRTHDATE, date);
			trackTools.trackdump ("Saved birthday: " + date); 
		}
		
		this.secLifeTotal = this.branch.getIntPref(TIMETRACK_PREF_LIFE_TOTAL);
		this.secSaveInterval = this.branch.getIntPref(TIMETRACK_PREF_SEC_SAVE_INTERVAL);
		this.secResetTotal = this.branch.getIntPref(TIMETRACK_PREF_RESET_TOTAL);
		this.strResetDate = this.branch.getCharPref(TIMETRACK_PREF_RESET_DATE);
		
		this.loadDynamicProperties();
		
		this.secSessionStart = now;
		this.secNextSave = now + this.secSaveInterval;
		this.secLastInteraction = this.secSessionStart;
		this.secLastSecond = this.secSessionStart;
		
		this.saveTime();
	},
	
	/** event broadcasting */
	broadcast: function (desc) {
		var observerService = trackTools.getService (TIMETRACK_OBSERVER_ID, TIMETRACK_OBSERVER_I);
		observerService.notifyObservers(this,"timetrack-event",desc);
	},
	
	/** Called by timer or client refresh */
	tic: function (refresh) {
		
		if (this.secLastSecond == 0) this.initValues();
		
		var s = trackTools.msToSeconds(Date.now());
		if (!refresh && (s == this.secLastSecond)) return;
		if (s < this.secLastSecond) this.secLastSecond = s;
		
		/** work list */
		var windowWatcher = trackTools.getService(TIMETRACK_WINDOW_WATCHER_ID, TIMETRACK_WINDOW_WATCHER_I);
		var activeWindow = windowWatcher.activeWindow;
		var location = null;
		if (activeWindow && activeWindow.content)  {
			location = String (activeWindow.content.location);
		}
		if (location != this.strActiveLocation) {
			this.strActiveLocation = location;
			this.boolInWorkSite = false;
			if (location == "") {
				this.boolInWorkSite = true;
			}
			else if (location) {
				for (var i=0; i<this.workSites.length; i++) {
					var workSite = this.workSites[i];
					if ((workSite != "") && (location.indexOf(workSite) >= 0)) {
						this.boolInWorkSite = true;
						break;
					}
				}
			}
		}
		
		this.boolPaused = false;
		if (activeWindow && activeWindow.timetrackPaused) {
			this.boolPaused = true;
		}
		
		/** Handle time */
		if (this.boolActive && !this.boolInWorkSite && !this.boolPaused) {
			var secSinceLastTic = s - this.secLastSecond;
			this.secDayTotal += secSinceLastTic;
			this.secLifeTotal += secSinceLastTic;
			
			if (this.hasBeenReset()) {
				this.secResetTotal  += secSinceLastTic;
			}
			
			if (this.secDayTotal < 0) trackTools.trackdump ("Sec negative: " + this.secDayTotal + " " + this.secLastSecond + " " + this.s);
			
			/** check if user has been idle */
			if ((s - this.secLastInteraction) > this.secTimeoutLength) {
				this.boolActive = false;
				this.secLastInteraction++;
				this.secDayTotal -= this.secTimeoutLength;
				if (this.secDayTotal < 0) trackTools.trackdump ("Idle negative: " + this.secDayTotal + " " + this.secLastInteraction + " " + this.secTimeoutLength);
			}
		}
		
		if (this.secSaveInterval > 0) {
			if (s > this.secNextSave) { /* time to save */
				this.saveTime();
				this.secNextSave += this.secSaveInterval;
			}
		}
		
		if ((s > (this.secDayStart + TIMETRACK_SECONDS_IN_DAY)) || (s < this.secDayStart)) { /* new day */
			this.secDayTotal = 0;
			this.secDayStart = trackTools.getSecDayStart (s);
		}
		
		/* display time string */ 
		var timeToDisplay = this.secDayTotal;
		var resetToday = (this.hasBeenReset() && (this.secDayTotal > this.secResetTotal));
		if ((this.displayMode == TIMETRACK_DISPLAY_TODAY) && resetToday)
			timeToDisplay = this.secResetTotal;
		else if (this.displayMode == TIMETRACK_DISPLAY_RESET) 
			timeToDisplay = this.secResetTotal;
		else if (this.displayMode == TIMETRACK_DISPLAY_LIFE) 
			timeToDisplay = this.secLifeTotal;

		this.strDayTotal = trackTools.formatTime (timeToDisplay, this.boolShowSeconds);
		
		this.secLastSecond = s;
		
		this.broadcast ("tic toc"); /** let the clients know */
	},
	
	hasBeenReset: function () {
		return (this.resetDate != "");
	},
	
	/** save preferences changed by the service */
	saveTime: function () {	
		if (this.secLastSecond == 0)  return; // avoid overwriting stats if there was an error.
		
		this.propertyChangeObserver.enabled = false;
		var prefs = trackTools.getService (TIMETRACK_PREF_ID, TIMETRACK_PREF_I);
		var branch = prefs.getBranch(TIMETRACK_PREF_BRANCH);
		branch.setIntPref(TIMETRACK_PREF_SEC_DAY_START, this.secDayStart);
		branch.setIntPref(TIMETRACK_PREF_SEC_DAY_TOTAL, this.secDayTotal);
		branch.setIntPref(TIMETRACK_PREF_LIFE_TOTAL, this.secLifeTotal);
		branch.setIntPref(TIMETRACK_PREF_RESET_TOTAL, this.secResetTotal);
		
		/* save the file */
		prefs.savePrefFile(null);
		
		this.propertyChangeObserver.enabled = true;
	},
	
	/** load preferences that may be changed by the user */
	loadDynamicProperties: function () {
		this.secTimeoutLength = this.branch.getIntPref(TIMETRACK_PREF_SEC_TIMEOUT_LENGTH);
		var prefSites = this.branch.getCharPref (TIMETRACK_PREF_WORKSITEs) +" about:blank";
		this.workSites = prefSites.split(" ");
		this.boolShowSeconds = this.branch.getBoolPref(TIMETRACK_PREF_SHOW_SECONDS);
		this.displayMode = this.branch.getIntPref(TIMETRACK_PREF_DISPLAY_MODE);
		this.broadcast ("tic toc");
	},
	
/************************* XPCOM interface ****************************/

	handleLostFocus:  function () {
		this.boolActive = false;
		this.msLastLostFocus = Date.now();
	},
	
	handleGotFocus:  function () {
		this.boolActive = true;
		this.secLastInteraction = trackTools.msToSeconds(Date.now());
	},

	/** called when the user does something */
	handleUserActive: function () {
		/* must ignore mouseout events that are raised just after the window loses focus */
		if ((Date.now()-this.msLastLostFocus) < TIMETRACK_MS_LOST_FOCUS_TOLERANCE) return;
		
		this.secLastInteraction = trackTools.msToSeconds(Date.now());
		this.boolActive = true;
	},
	
	refresh: function () {
		this.tic(true);
	},
	
	reset: function () {
		this.secResetTotal = 0; 
		var date = trackTools.formatDate (new Date());
		this.strResetDate = date;
		this.branch.setCharPref(TIMETRACK_PREF_RESET_DATE, date);
		this.refresh();
	},
	
	snooze: function (msSnoozeTime) {
	},
	
	get active() { return this.boolActive }, 
	get workSite() { return this.boolInWorkSite; }, 
	get paused() { return this.boolPaused; }, 
	get dayTotal() { return this.strDayTotal; },
	get secdayTotal() { return this.secDayTotal; },
	get extensionStartDate() { return this.strBirthDate; },
	get secExtensionTotal() { return this.secLifeTotal; },
	get resetDate() { return this.strResetDate; },
	get secresetTotal () { return this.secResetTotal; } 
	
} /** end of TimetrackService */


/******************* Timer *************************/
function TimetrackTimerObserver(service) {
	this.service = service;
}
	
TimetrackTimerObserver.prototype = {
	service: null,
	observe: function(aSubject, aTopic, aData) {
		this.service.tic(false);
	},

	QueryInterface : function(iid) {
		if	(iid.equals(Components.interfaces.nsIObserver) || 
			 iid.equals(Components.interfaces.nsISupportsWeakReference) || 
			 iid.equals(Components.interfaces.nsISupports) )
		return this;
		throw Components.results.NS_NOINTERFACE;
	 }
}; /* end of timer */

/******************* Property Change Observer *************************/
function TimetrackPropertyChangeObserver() {
}
TimetrackPropertyChangeObserver.prototype = {
	enabled: true,
	observe: function(subject,topic,data) {
		if (this.enabled) {
			timetrackSingletonService.loadDynamicProperties();
		}
	}
};

/******************* Quit Observer *************************/
function TimetrackQuitObserver(service) {
	this.service = service;
}
TimetrackQuitObserver.prototype = {
	service: null,
	observe: function(subject,topic,data) {
		this.service.saveTime();
		this.service.branch = null;
	}
};

/*********** XPCOM Service *****************/

var timetrackSingletonService = new TimetrackService();

var TimetrackModule = {
	registerSelf: function (compMgr, fileSpec, location, type) {
		compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
		compMgr.registerFactoryLocation(this.CID,
										"nsITimetrackService",
										this.ProgID,
										fileSpec,
										location,
										type);
	},

	getClassObject : function (compMgr, cid, iid) {
	
		if (!cid.equals(this.CID))
			throw Components.results.NS_ERROR_NO_INTERFACE
		if (!iid.equals(Components.interfaces.nsIFactory))
			throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
			
		return this.Factory;
	},

	CID: Components.ID("{01BB9060-7C13-11DA-8BDE-F66BAD1E3F3A}"),
	ProgID: "@usablehack.com/TimetrackService;1",

	Factory: {
		createInstance: function (outer, iid) {		
			if (outer != null)
				throw Components.results.NS_ERROR_NO_AGGREGATION;
			
			if (!iid.equals(Components.interfaces.nsITimetrackService) && !iid.equals(Components.interfaces.nsISupports))
				throw Components.results.NS_ERROR_NO_INTERFACE;
			
			return timetrackSingletonService.QueryInterface(iid);
		}
	},

	canUnload: function(compMgr) {
		return true;
	}
	
}; /* end of module */

function NSGetModule(compMgr, fileSpec) { return TimetrackModule; }

