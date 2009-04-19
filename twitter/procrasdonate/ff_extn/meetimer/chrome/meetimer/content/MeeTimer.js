var MEETIMERDEBUGMODE = true;

function MeeTimer(){

try{
	this.TIMINGS = {inactive_period:60000, pulseperiod:1000};
	var browser_appcontent = window.document.getElementById("appcontent");
	this.db = new DB();
	this.options = new FFOptions();
	//this.options.setOption("char", "MeeTimer.lastVersion", "0.12");
	this.install();

	// Context Events

	
	
	document.getElementById("meetimer-popup-context").addEventListener("mousedown", MTCOMMON.bindAsEventListener(this, this.clickTrayMenu), true);
	

	
	//document.getElementById("meetimer-panel").addEventListener( "mouseover", MTCOMMON.bindAsEventListener(this, function(event){
	document.getElementById("meetimer-panel-tooltip").addEventListener( "popupshowing", MTCOMMON.bindAsEventListener(this, function(event){
			// Show the style
			if( this.selectedMtp.mtp && !(this.settings.currentMode && this.settings.currentMode=="free") ){
				document.getElementById("meetimer-panel-tooltip").style.display = "";
				this.selectedMtp.mtp.renderToolTip();
			}else{
				document.getElementById("meetimer-panel-tooltip").style.display = "none";
			}
		}), true );
	
	
	this.sp = new StoredProcedures(this.db);
	
	this.groups = new MeeGroups(this);
	this.ignored = new WebsitesIgnored(this);
	this.deterrents = new Deterrents(this);
	this.deterLinks = new DeterLinks(this);
	this.urlMaps = new UrlMaps(this);
	
	this.urls = {};
	this.domains = {};
	this.meeTimerPages = [];
	this.selectedMtp = {};	// the MeeTimerPage that renders to status
	
	
	// Load options
	this.checkOptions();
	

	
	// Setup event handlers
	var fNewPage = this.createFNewPage();
	browser_appcontent.addEventListener("DOMContentLoaded", fNewPage, false);
	
	
	window.addEventListener("focus", MTCOMMON.bind(this, this.fireEvent), true);
	window.addEventListener("blur", MTCOMMON.bind(this, this.setInactive), true);
	
	var fClose = function(event){
			// For every open item; remove it
			this.fireEvent();
			for( var i = this.meeTimerPages.length - 1; i >= 0; i-- ){
				this.removeMeeTimerPage( this.meeTimerPages[i] );
			}
		};
	window.addEventListener("unload", MTCOMMON.bind(this, fClose), false);
	
	// Tab events:
	var tabContainer = gBrowser.tabContainer;
	var fTabSelect = function(event){
			this.fireEvent();
			this.updateSelectedMtp();
			this.setDisplay();
		};
	tabContainer.addEventListener("TabSelect", MTCOMMON.bind(this, fTabSelect), false);
		
	var fTabClose = function(event){
			//this.fireEvent(); -> tab close is not indicitive of attention being paid
			var currentBrowser = event.target.linkedBrowser;
			if( currentBrowser ){	// useful to block iframes
				var tabMtp = currentBrowser.meeTimerPage;
				if( tabMtp ){
					this.removeMeeTimerPage( tabMtp );
				}
				this.updateSelectedMtp();
			}
		};
	tabContainer.addEventListener("TabClose", MTCOMMON.bind(this, fTabClose), false);
	
	// Add additional inactive events
	var boundFireEvent = MTCOMMON.bind(this, this.fireEvent);
	window.addEventListener( "mousedown", boundFireEvent, false );
	window.addEventListener( "keydown", boundFireEvent, false );
	window.addEventListener( "DOMMouseScroll", boundFireEvent, false );
	this.fireEvent();	// ensure last event
	
	var fPulse = this.createFPulse();
	this.pulser = setInterval( fPulse, this.TIMINGS.pulseperiod );
	
}catch(e){
	if( MEETIMERDEBUGMODE ) alert("MeeGroups construct\n" + e.toString());
}
}

MeeTimer.prototype.saveSettings = function(){
	var s = json.stringify( this.settings );
	this.options.setOption( "char", "meetimer.settings", s );
}
MeeTimer.prototype.checkOptions = function(){
	this.settings = json.parse( this.options.getOption("char", "meetimer.settings", "{}") );
	if( !this.settings ) this.settings = {};
	if( !this.settings.statInfo ) this.settings.statInfo = {};
	if( !this.settings.statInfo.workingWeek || isNaN(this.settings.statInfo.workingWeek) || this.settings.statInfo.workingWeek < 0 ){
		this.settings.statInfo.workingWeek = 40;	// reset
		this.saveSettings();
	}
	
	
	// Choose right mode:
	var fSetMode = function(){
			var el = document.getElementById("meetimer-popup-mode-" + this.settings.currentMode);
			if( el ) this.modeChange( el);
		}
	fSetMode = MTCOMMON.bind(this, fSetMode);
	
	this.setDisplay();
	
	// First call?
	if( !this.lastOptionId ){	// First call, just init it
		if( this.settings.currentMode ){	// Embolden the right mode
			fSetMode();
		}
		this.lastOptionId = this.options.getOption("char", "meetimer.lastOptionId");
		if( !this.lastOptionId ){	// set initial value
			this.lastOptionId = (new Date()).valueOf();
			this.options.setOption("char", "meetimer.lastOptionId", this.lastOptionId );
		}
		if( this.settings.startup.switchToDeterrent ){
			this.settings.currentMode = "deterrent";
			fSetMode();
			this.saveSettings();
		}
		return;
	}
	
	if( this.lastOptionId!=this.options.getOption("char", "meetimer.lastOptionId") ){	// reload		
		this.lastOptionId = this.options.getOption("char", "meetimer.lastOptionId");
		this.groups.initialise();
		this.ignored.initialise();
		this.urlMaps.initialise();
		this.deterrents.initialise();
		this.deterLinks.initialise( this.selectedMtp );
		if( this.selectedMtp.url ){
			this.groups.setMenu( this.selectedMtp.url );
			this.ignored.setMenu( this.selectedMtp.url );
			if( this.selectedMtp.mtp ) this.urlMaps.setMenu( this.selectedMtp.mtp.fullUrl );
		}
		// Now test each mtp
		var found = false;
		for( var i = this.meeTimerPages.length - 1; i >= 0; i-- ){
			var url = this.meeTimerPages[i].url;
			var url2 = this.urlMaps.lookup(url);
			if( url2 && url2!=url ){	// Changed the url
				this.meeTimerPages[i].url = url2;	// update the mtp
				if( this.urls[url] ){	// changed the shared one
					if( !this.urls[url2] || this.urls[url2].startTime > this.urls[url].startTime ) this.urls[url2] = this.urls[url];
					if( !this.getPagesWithUrl(url) ) delete this.urls[url];
				}
				found = true;
			}
		}
		if( found ) this.updateSelectedMtp(true);
	}
};
MeeTimer.prototype.setDisplay = function(){
	// Set the visibility of system tray based on the mode and options
	if( !this.settings.display ) this.settings.display = {};
	
	if( !this.settings.display.trayIcon && !this.settings.display.trayTimer ){	// Hide everything
		document.getElementById("meetimer-panel").style.display = "none";
	}else{
		document.getElementById("meetimer-panel").style.display = "";
		
		if( this.settings.display.trayIcon ){
			document.getElementById("meetimer-image").style.display = "";
		}else{
			document.getElementById("meetimer-image").style.display = "none";
		}
		if( this.settings.display.trayTimer ){
			if( this.selectedMtp.mtp && !this.ignored.test(this.selectedMtp.url) ) document.getElementById("meetimer-label").style.display = "";
		}else{
			document.getElementById("meetimer-label").style.display = "none";
		}
				
		if( this.settings.currentMode=="free" || !this.selectedMtp.mtp || this.ignored.test(this.selectedMtp.url) ){	// grey icon, hide timer
			document.getElementById("meetimer-image").src = "chrome://meetimer/content/logo16g.png";
			document.getElementById("meetimer-label").style.display = "none"
		}else{
			document.getElementById("meetimer-image").src = "chrome://meetimer/content/logo16a.png";
			if( this.settings.display.trayTimer && (this.selectedMtp.mtp && !this.ignored.test(this.selectedMtp.url)) ) document.getElementById("meetimer-label").style.display = "";
		}
	}
};

MeeTimer.prototype.createFPulse = function(){
	// This struggles with performance. Make it efficient as possible. Load variables within it.
	var TIMINGS = this.TIMINGS;
	var selectedMtp = this.selectedMtp;
	var fPulse = function(){
		if( selectedMtp.mtp && ((new Date()).valueOf()-TIMINGS.lastEvent)<TIMINGS.inactive_period ){	// active
			selectedMtp.sharedUrl.duration+=TIMINGS.pulseperiod;
			selectedMtp.sharedDomain.duration+=TIMINGS.pulseperiod;
			selectedMtp.mtp.renderStatus();			
		}
	};
	return fPulse;
	
}
MeeTimer.prototype.createFNewPage = function(){
	var meeTimer = this;
	var fNewPage = function(event){
		try{
			var currentBrowser = gBrowser.getBrowserForDocument(event.originalTarget);
			if( currentBrowser ){	// useful to block iframes
				var tabMtp = currentBrowser.meeTimerPage;
				var loc = event.originalTarget.location;
				var newUrl = meeTimer.urlMaps.lookup( loc.href, ((loc!="about:blank")? loc.hostname : null) );	// try to convert it
				var mtp = null;
				if( !(tabMtp && tabMtp.url && tabMtp.url==newUrl) ){	// page refresh
					if( tabMtp ) meeTimer.removeMeeTimerPage( tabMtp );			// handle old one on this tab:
					mtp = new MeeTimerPage(meeTimer, event.originalTarget);	// create new one:
					if( mtp.url ){
						document.getElementById("meetimer-popup-site").setAttribute("label", mtp.url + " (" + (meeTimer.groups.getGroupNamesForUrlAsString(mtp.url) || "Ungrouped") + ")" );
						meeTimer.groups.setMenu(mtp.url);	// set popup menu
						meeTimer.ignored.setMenu(mtp.url);	// set popup menu
						meeTimer.addMeeTimerPage( mtp );
						meeTimer.urlMaps.setMenu(mtp.fullUrl);
					}
				}else{	// Page refresh; update doc
					mtp = tabMtp;
					mtp.refreshDoc(event.originalTarget);
				}
				meeTimer.updateSelectedMtp();
				meeTimer.checkOptions();	// TODO DITCH THIS
				if( mtp.url && meeTimer.settings.currentMode=="deterrent" ){	// show deterrent

					meeTimer.deterLinks.removeMtp(mtp);
					meeTimer.deterLinks.processPage(mtp);
					if( meeTimer.deterrents.test(mtp.url) ) meeTimer.deterrents.showLightbox(mtp); // show deterrent
				}
			}
		}catch(e){
			if( MEETIMERDEBUGMODE ) alert("MeeTimer createFNewPage\n" + e.toString());
		}
		};
	return fNewPage;
};

MeeTimer.prototype.fireEvent = function(){
	this.TIMINGS.lastEvent = (new Date()).valueOf();
};
MeeTimer.prototype.setInactive = function(){
	this.TIMINGS.lastEvent = (new Date()).valueOf() - this.TIMINGS.inactive_period;
};

MeeTimer.prototype.updateSelectedMtp = function(force){
	// Set it on current tab
	if( !this.selectedMtp.mtp || this.selectedMtp!=this.getBrowserThisTab().meeTimerPage || force ){
		this.selectedMtp.mtp = this.getBrowserThisTab().meeTimerPage;
		if( this.selectedMtp.mtp ){
			//this.enableSiteBasedUI(true);
			document.getElementById("meetimer-popup-site").style.display = "";
			this.selectedMtp.url = this.selectedMtp.mtp.url;
			this.selectedMtp.sharedUrl = this.urls[ this.selectedMtp.mtp.url ];
			this.selectedMtp.sharedDomain = this.domains[ this.selectedMtp.mtp.domain ];
			this.groups.setMenu(this.selectedMtp.url);
			this.ignored.setMenu(this.selectedMtp.url);	// set popup menu
		}
	}
	if( !this.selectedMtp.mtp ){	// could not load, maybe local
		//this.enableSiteBasedUI(false);
		document.getElementById("meetimer-popup-site").style.display = "none";
	}
};

MeeTimer.prototype.getBrowserThisTab = function(){
	return gBrowser.getBrowserForTab( gBrowser.selectedTab );
};
MeeTimer.prototype.getBrowserFromEvent = function(event){gBrowser.getBrowserForDocument(event.originalTarget);}; 

MeeTimer.prototype.console = function(){
	if( this.getBrowserThisTab().meeTimerPage && this.getBrowserThisTab().meeTimerPage.window.wrappedJSObject.console ){
		return this.getBrowserThisTab().meeTimerPage.window.wrappedJSObject.console;
	}
	return {'log':function(){}, 'trace':function(){}};
};

MeeTimer.prototype.addMeeTimerPage = function(mtp){
	if( mtp.url ){
		// Add to browser for easy retrieval
		mtp.attachToBrowser();
		if( !this.urls[ mtp.url ] ){	// First instance of url
			this.urls[mtp.url] = {'startTime':mtp.startTime};
			this.urls[mtp.url].duration = 0;
			this.urls[mtp.url].accumulatedDuration = this.sp.getUrlDurationToday(mtp.url);
			this.urls[mtp.url].mtp = mtp;
		}
		if( !this.domains[ mtp.domain ] ){	// First instance of domain
			this.domains[mtp.domain] = {};
			this.domains[mtp.domain].duration = this.sp.getDomainDurationToday(mtp.domain);
		}
		this.meeTimerPages.push(mtp);	// Add to known list
	}
};
MeeTimer.prototype.removeMeeTimerPage = function(mtp, options){
	for( var i = this.meeTimerPages.length - 1; i >= 0; i-- ){
		if( this.meeTimerPages[i]==mtp ){
			this.meeTimerPages.splice(i, 1);
			this.deterLinks.removeMtp( mtp );
		}
	}
	if( !this.getPagesWithUrl(mtp.url) ){	// no more of this url
		if( !(options && options.noSave) && !this.ignored.test(mtp.url) && this.settings.currentMode!="free" ){	// Do not save if explicitly denied or running in free mode
			this.sp.log( mtp.url, this.urls[mtp.url].startTime, this.urls[mtp.url].duration );	// Last one of url, stop log
		}
		this.deterrents.removePermitted(mtp.url);	// must be reapproved if shown again
		this.urls[mtp.url] = null;
		delete this.urls[mtp.url];
	}
	mtp.unload();
};

MeeTimer.prototype.zeroDurationForAllMtp = function(options){
	// Reset all urls to 0 duration
	var d = (new Date()).valueOf();
	for( url in this.urls ){
		this.zeroDurationForUrl(url, options, d);
	}
};
MeeTimer.prototype.zeroDurationForUrl = function(url, options, d){
	// Reset url to 0 duration -> used by ignore + zeroAll
	if( !d ) d = (new Date()).valueOf();
	if( options && options.saveToDb && !this.ignored.test(url) ){
		this.sp.log( url, this.urls[url].startTime, this.urls[url].duration );
	}
	this.urls[url].startTime = d;
	this.urls[url].mtp.startTime = d;
	this.urls[url].duration = 0;
	this.urls[url].accumulatedDuration = this.sp.getUrlDurationToday(url);
};

MeeTimer.prototype.getPagesWithUrl = function(url){
	// Retrieve first object with this url
	var mtps = [];
	for( var i = 0; i < this.meeTimerPages.length; i++ ){
		if( this.meeTimerPages[i].url==url ) mtps.push(this.meeTimerPages[i]);
	}
	return mtps.length>0? mtps:null;
};


MeeTimer.prototype.clickTrayMenu = function(event){

try{
	var el = MTCOMMON.element(event);

		
	if( el.groupname ){	// It's a group element
		MTCOMMON.stop(event);
		if( this.groups.isUrlInGroup( this.selectedMtp.url, el.groupname ) ){
			this.groups.removeUrl( el.groupname, this.selectedMtp.url );
			this.deterLinks.initialise( this.selectedMtp.mtp );
			this.deterrents.initialise();
			this.deterrents.removeAllDeterrents(null, true);
		}else{
			this.groups.addUrl( el.groupname, this.selectedMtp.url );
			this.deterrents.initialise();
			this.deterLinks.initialise( this.selectedMtp.mtp );
			this.deterrents.showAllDeterrents(this.selectedMtp.url);
		}

		return;	
	}
	
	switch(el.id){
		case "meetimer-popup-group-new":
			var group = prompt("Please enter a name for the new group:");
			if( !group ) return;
			this.groups.addGroup( group );
			this.groups.addUrl( group, this.selectedMtp.url );
			this.deterrents.initialise();
			this.deterLinks.initialise( this.selectedMtp.mtp );
			this.deterrents.showAllDeterrents(this.selectedMtp.url);
			break;
		case "meetimer-popup-ignore-add":
			// Pick the current group (from event) and add this URL to it
			if( !confirm("By ignoring " + this.selectedMtp.url + " it will no longer be recorded in any way.\nYou can stop ignoring a site at any time by right clicking MeeTimer and choosing 'Stop Ignoring'.\n\n\nProceed?") ) return;
			this.zeroDurationForUrl(url, {saveToDb:true} );	// save to db
			this.ignored.addUrl( this.selectedMtp.url );
			this.updateSelectedMtp();
			this.setDisplay();
			break;
		case "meetimer-popup-ignore-remove":
			var url = el.url;
			this.ignored.removeUrl( url );
			this.zeroDurationForUrl(url);	// make sure not counted
			this.updateSelectedMtp();
			this.setDisplay();
			break;
		case "meetimer-popup-remove-records":
			var url = this.selectedMtp.url;
			if( !confirm("Remove all records for " + url + "?") ) return;
			this.sp.deleteUrl(url);
			this.zeroDurationForUrl(url);	// make sure not counted
			break;
		case "meetimer-popup-map-add":
			openOptions("meetimer_renamesite," + this.selectedMtp.url);
			break;
		case "meetimer-popup-map-remove":
			openOptions("meetimer_renamesite");
			break;
		case "meetimer-popup-mode-normal":
		case "meetimer-popup-mode-deterrent":
		case "meetimer-popup-mode-free":
			this.modeChange(el);
			break;
	}


}catch(e){
	if( MEETIMERDEBUGMODE ) alert("MeeGroups construct\n" + e.toString());
}

	
};
MeeTimer.prototype.modeChange = function(el){
	// Change the MeeTimer mode
	document.getElementById("meetimer-popup-mode-normal").style.fontWeight = "";
	document.getElementById("meetimer-popup-mode-deterrent").style.fontWeight = "";
	document.getElementById("meetimer-popup-mode-free").style.fontWeight = "";
	el.style.fontWeight = "bold";
	if( this.settings.currentMode=="free" ) this.zeroDurationForAllMtp();	// reset as we're moving away from free
	this.settings.currentMode = el.getAttribute("mode");
	if( this.settings.currentMode=="free" ){
		this.zeroDurationForAllMtp({saveToDb:true});	// write out all settings as we're moving into free
	}else if( this.settings.currentMode=="normal" ){	// remove deterrents
		this.deterrents.removeAllDeterrents();
	}else if( this.settings.currentMode=="deterrent" ){
		this.deterLinks.showAllDeterLinks();
		this.deterrents.removePermitted();
		this.deterrents.showAllDeterrents();
	}
	this.saveSettings();
	this.setDisplay();
};







MeeTimer.prototype.install = function(reset){
	var lastVersion = this.options.getOption("char", "MeeTimer.lastVersion", "");
	lastVersion = lastVersion? parseFloat(lastVersion):0;
	
	if( !reset && lastVersion==0.22 ) return;	// Current	TODO
	if( reset ) lastVersion = 0;
	
	if( lastVersion < 0.1 ){
		this.db.execute("DROP TABLE IF EXISTS log");
		this.db.execute("CREATE TABLE log (url_id INTEGER NOT NULL, startdate INTEGER DEFAULT NULL, duration INTEGER DEFAULT NULL, day INTEGER DEFAULT NULL, week INTEGER DEFAULT NULL)");
		this.db.execute("CREATE INDEX log_url_index ON log(url_id)");
		this.db.execute("CREATE INDEX log_startdate_index ON log(startdate)");
		
	
		this.db.execute("DROP TABLE IF EXISTS urls");
		this.db.execute("CREATE TABLE urls (id INTEGER PRIMARY KEY AUTOINCREMENT, url VARCHAR(255))");
		this.db.execute("CREATE UNIQUE INDEX urls_id_index ON urls(id)");
		this.db.execute("CREATE UNIQUE INDEX urls_url_index ON urls(url)");
		this.db.execute("INSERT INTO urls (url) VALUES('mail.google.com')");
		this.db.execute("INSERT INTO urls (url) VALUES('www.google.com')");
		this.db.execute("INSERT INTO urls (url) VALUES('www.google.co.uk')");
		
		this.db.execute("DROP TABLE IF EXISTS ignored_urls");
		this.db.execute("CREATE TABLE ignored_urls (url VARCHAR(255) UNIQUE NOT NULL, dateadded INTEGER DEFAULT NULL)");
		this.db.execute("CREATE UNIQUE INDEX ignored_urls_index ON ignored_urls(url)");
		
		this.db.execute("DROP TABLE IF EXISTS groups");
		this.db.execute("CREATE TABLE groups (id INTEGER PRIMARY KEY AUTOINCREMENT, groupname VARCHAR(50) NOT NULL)");
		this.db.execute("CREATE UNIQUE INDEX groups_index ON groups(id)");
		this.db.execute("INSERT INTO groups (groupname) VALUES('Procrastination')");
		this.db.execute("INSERT INTO groups (groupname) VALUES('Communication')");
		this.db.execute("INSERT INTO groups (groupname) VALUES('Search')");
		
		this.db.execute("DROP TABLE IF EXISTS groups_urls");
		this.db.execute("CREATE TABLE groups_urls (group_id INTEGER NOT NULL, url_id INTEGER UNIQUE NOT NULL)");
		this.db.execute("CREATE INDEX groups_urls_group_index ON groups_urls(group_id)");
		this.db.execute("CREATE INDEX groups_urls_url_index ON groups_urls(url_id)");
		this.db.execute("INSERT INTO groups_urls (group_id, url_id) VALUES(2, 1)");
		this.db.execute("INSERT INTO groups_urls (group_id, url_id) VALUES(3, 2)");
		this.db.execute("INSERT INTO groups_urls (group_id, url_id) VALUES(3, 3)");
		
		lastVersion = 0.1;
	}
	if( lastVersion < 0.11 ){
		this.db.execute("DROP TABLE IF EXISTS url_maps");
		this.db.execute("CREATE TABLE url_maps (find VARCHAR(255) UNIQUE NOT NULL, replace VARCHAR(255))");
		this.db.execute("INSERT INTO url_maps (find,replace) VALUES('%.facebook.com%', 'facebook.com')");
		this.db.execute("INSERT INTO url_maps (find,replace) VALUES('%.google.%/reader/%', 'google.com/reader/')");
		lastVersion = 0.11;
	}
	
	if( lastVersion < 0.14 ){
		this.db.execute("DROP TABLE IF EXISTS deterrents");
		this.db.execute("CREATE TABLE deterrents (group_id INTEGER NOT NULL)");
		
		this.db.execute("DROP TABLE IF EXISTS deterrent_stats");
		this.db.execute("CREATE TABLE deterrent_stats (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, date VARCHAR(10) NOT NULL, shown INTEGER DEFAULT 0, ignored INTEGER DEFAULT 0)");
		
		var data = {};
		var fRow = function(statement){
				data.found = (statement.getInt64(0)>0);
			}
		this.db.select( "SELECT count(id) FROM groups WHERE groupname = 'Work' OR groupname = 'work'", fRow );
		if( !data.found ){	// add work
			this.db.execute("INSERT INTO groups (groupname) VALUES('Work')");
		}
		
		data = {};
		var fRow = function(statement){
				var gid = statement.getInt64(0);
				this.db.execute("INSERT INTO deterrents (group_id) VALUES(" + gid + ")" );
			};
		this.db.select("SELECT id FROM groups WHERE groupname = 'Procrastination'", MTCOMMON.bind(this, fRow));
		
		var settings = {};
		settings.currentMode = "deterrent";
		settings.deterrent = {incMisc:false};
		settings.display = {};
			settings.display.trayIcon = true;
			settings.display.trayTimer = true;
		settings.startup = {};
			settings.startup.switchToDeterrent = false;
		settings.statInfo = {};
			settings.statInfo.workingWeek = 40;
		
		var s = json.stringify( settings );
		this.options.setOption( "char", "meetimer.settings", s );
		this.settings = settings;
		
		lastVersion = 0.14;
	}
	
	if( lastVersion < 0.15 ){
		this.db.execute("DROP TABLE IF EXISTS deterrentlinks");
		this.db.execute("CREATE TABLE deterrentlinks (group_id INTEGER NOT NULL)");
		
		this.db.execute("DROP TABLE IF EXISTS deterrent_stats");
		this.db.execute("CREATE TABLE deterrent_stats (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, date VARCHAR(10) NOT NULL, shown INTEGER DEFAULT 0, ignored INTEGER DEFAULT 0, isLink INTEGER DEFAULT 0)");
		
		data = {};
		var fRow = function(statement){
				var gid = statement.getInt64(0);
				this.db.execute("INSERT INTO deterrentlinks (group_id) VALUES(" + gid + ")" );
			};
		this.db.select("SELECT id FROM groups WHERE groupname = 'Procrastination'", MTCOMMON.bind(this, fRow));
				
		lastVersion = 0.2;
	}
	
	if( lastVersion < 0.21 ){
		this.db.execute("CREATE UNIQUE INDEX groups_name_index ON groups(groupname)");
				
		lastVersion = 0.21;
	}

	if( lastVersion < 0.22 ){
		// Read in the current groups_urls, then drop & rebuild the table without the restrictive index; and repopulate the data
		
		var results = [];
		var fRow = function(statement){
				results.push( [statement.getInt64(0), statement.getInt64(1)] );
			};
		this.db.select("SELECT group_id, url_id FROM groups_urls", fRow);
		
		this.db.execute("DROP TABLE IF EXISTS groups_urls");
		this.db.execute("CREATE TABLE groups_urls (group_id INTEGER NOT NULL, url_id INTEGER NOT NULL)");
		this.db.execute("CREATE INDEX groups_urls_group_index ON groups_urls(group_id)");
		this.db.execute("CREATE INDEX groups_urls_url_index ON groups_urls(url_id)");
		
		for( var i = 0; i < results.length; i++ ){
			this.db.execute("INSERT INTO groups_urls (group_id, url_id) VALUES(" + results[i][0] + ", " + results[i][1] + ")");
		}
				
		
		lastVersion = 0.22;
	}

	// Finally, record our update:
	this.options.setOption("char", "MeeTimer.lastVersion", lastVersion);
};