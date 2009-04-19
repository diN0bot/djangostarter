window.changeTab = function(name){	// so can be called outside
	var tabStr = name? name.split("_")[1]:"";
	if( tabStr ){	// Passed at load time, and used to specify what tab to start on. meetimer_about
		var tabId = "";
		switch( tabStr.toLowerCase() ){
			case "stats":
				tabId = "tabStats";
				break;
			case "groups":
				tabId = "tabGroups";
				break;
			case "donate":
				tabId = "tabDonate";
				break;
			case "deterrents":
				tabId = "tabDeterrents";
				break;
		}
		if( name.indexOf("renamesite")>-1 ){
			tabId = "tabRenameSite";
			if( name.indexOf(",")>-1 ){
				var details = name.split(",");
				if(details[1]){
					document.getElementById("alteration_find").value = details[1];
				}
			}
		}
		if( tabId ) document.getElementById("tabboxMain").selectedTab = document.getElementById(tabId);
	}
};

function MeeOptions(){
	changeTab(window.name);
	
	// Setup iframes
	document.getElementById("iframeDonate").setAttribute("src", "http://productivefirefox.com/donate_meetimer.htm");
	
	var db = new DB();
	var sp = new StoredProcedures(db);
	this.options = new FFOptions();
		var s = this.options.getOption("char", "meetimer.settings", "");
		this.settings = json.parse(s);
		if( !this.settings ) this.settings = {};
	this.primeSaveSettings();
	this.deterrents = new Deterrents(db, sp);
	this.group = new Groups(db, sp);
	this.popularSites = new PopularSites(db, sp);
	this.maintenance = new Maintenance(db, sp, this.popularSites);
	this.alteration = new Alteration(db,sp);	
	
	this.contextGroups = new ContextGroups(db,sp);
	
	
	var data = {msLogged:0,msSaved:0}
	var fRow = function(statement){
			data.msLogged = statement.getInt64(0) * 1000;
		}
	db.select("SELECT sum(duration) as sumDuration FROM log", fRow);
	var fRow = function(statement){
			data.msSaved = statement.getInt64(0) * 120000; // 2 mins per deterrent
		}
	db.select("SELECT sum(shown) FROM deterrent_stats WHERE isLink = 0", fRow);
	var fRow = function(statement){
			data.msSaved += statement.getInt64(0) * 30000; // 30 seconds per deterrent
		}
	db.select("SELECT sum(shown) FROM deterrent_stats WHERE isLink = 1", fRow);
	
	var fRenderTime = function(ms){
			var hrs = ms/(1000*60*60)
			var mins = ms/(1000*60);
			if( hrs<1 ) return parseInt(mins) + " minutes";
			return parseInt(hrs) + " hours";
		}
	var str = "  MeeTimer has logged " + fRenderTime(data.msLogged);
	if( data.msSaved>(1000*60) ){
		str += " and you have saved at least " + fRenderTime(data.msSaved);
	}
	
	document.getElementById("statusmsg").value += str + ".";
}
MeeOptions.prototype.notifyChange = function(){
	// Write out settings to json and notify of update
	var s = json.stringify( this.settings );
	this.options.setOption("char", "meetimer.settings", s);
	
	this.options.setOption("char", "meetimer.lastOptionId", (new Date()).valueOf() );
};
MeeOptions.prototype.primeSaveSettings = function(){
	// Find all settings, and set them up to be saved when they're changed
	
	var els = document.getElementsByTagName("*");
	for( var i = 0; i < els.length; i++ ){
		if( els[i].hasAttribute("sectionName") && els[i].hasAttribute("optionName") ){
			var s = els[i].getAttribute("sectionName");
			var o = els[i].getAttribute("optionName");
			if( !this.settings[s] ) this.settings[s] = {};	
			switch( els[i].nodeName ){
				case "checkbox":
					els[i].checked = this.settings[s][o];
					var fSave = function(event){
						var el = MTCOMMON.element(event);
						this.settings[el.getAttribute("sectionName")][el.getAttribute("optionName")] = el.checked;
						this.notifyChange();
					};
					els[i].addEventListener("CheckboxStateChange", MTCOMMON.bind(this, fSave), false);
					break;
				case "textbox":	
					els[i].value = this.settings[s][o] || "";
					var fSave = function(event){
						var el = MTCOMMON.element(event);
						this.settings[el.getAttribute("sectionName")][el.getAttribute("optionName")] = el.value;
						this.notifyChange();
					};
					els[i].addEventListener("keyup", MTCOMMON.bind(this, fSave), false);
					els[i].addEventListener("mouseup", MTCOMMON.bind(this, fSave), false);
					break;
			}			
		}
	}
};


function ContextGroups(db, sp){
	this.db = db;
	this.sp = sp;
	
	this.fClickList = MTCOMMON.bindAsEventListener(this, "clickList");
	this.fClickMenu = MTCOMMON.bindAsEventListener(this, "clickMenu");
	
	this.init();
}
ContextGroups.prototype.init = function(){
	// Extract Menu/List els
	// Setup Menu; and add click handler to lists
	
	this.elMenu = document.getElementById("menu-change-group");
	this.elMenu.addEventListener( "mousedown", this.fClickMenu, false );
	this.refresh();
	
	var lists = ["groups-sites-listbox", "list-popular"];
	for( var i = 0; i < lists.length; i++ ){
		var el = document.getElementById(lists[i]);
		el.addEventListener( "select", this.fClickList, true );
	}
};
ContextGroups.prototype.refresh = function(){
	for( var i = 1; i < this.elMenu.childNodes.length; i++ ){
		var el = this.elMenu.childNodes[i];
		if( el && el.getAttribute("isgroup") ){
			el.label = "";
			el.style.display = "none";
			el.hidden = true;
		}
		if( el.getAttribute("ungroup") ){
			this.elMenuUngroup = el;
		}
		if( el.getAttribute("removerecords") ){
			this.elMenuRemoveRecords = el;
		}
	}
	var data = {i:1};
	var fRow = function(statement){
			var groupname = statement.getString(1);
			var el = this.elMenu.childNodes[ data.i ];
			if( el && el.getAttribute("isgroup") ){
				el.setAttribute("group_id", statement.getInt64(0) );
				el.label = groupname;
				el.style.display = "";
				el.hidden = false;
				data.i++;
			}
		};
	this.db.select("SELECT id, groupname FROM groups", MTCOMMON.bind(this, fRow) );
};
ContextGroups.prototype.clickList = function(event){
	// Extract the listitem; and extract the URL from its attribute
	// Get the group associated with the URL (if it has one) and hide on context
	
	this.url = null;
	var el = event.originalTarget.selectedItem;
	if( !el || !el.getAttribute("url") ){
		var fHide = function(){
				this.elMenu.hidePopup();
			}
		setTimeout( MTCOMMON.bind(this, fHide), 200 );
		this.elMenu.hidePopup();
		return;
	}else{
	}
	this.url = el.getAttribute("url");
	var g = this.sp.getGroupForUrl(this.url);
	this.group_id = g.id;
	
	var group = g.groupname;
	if( group ){
		this.elMenuUngroup.hidden = false;
	}else{
		group = escape("notfound");
		this.elMenuUngroup.hidden = true;
	}
	
	for( var i = 1; i < this.elMenu.childNodes.length; i++ ){
		var el = this.elMenu.childNodes[i];
		if( el.label.toLowerCase()==group.toLowerCase() ){
			el.hidden = true;
		}else{
			el.hidden = false;
		}
	}
	
};
ContextGroups.prototype.clickMenu = function(event){
	// Add the current URL to the chosen group
	// Refresh all lists

	if( !this.url ) return;
	
	var elItem = event.originalTarget;
	if( elItem.getAttribute("noaction") ) return;
	
	var group = elItem.label;
	var group_id = elItem.getAttribute("group_id");
	
	if( elItem==this.elMenuUngroup ){	// Ungroup it
		this.sp.removeGroupUrl( this.group_id, null, this.url );
	}else if( elItem==this.elMenuRemoveRecords ){	// cleanse the url
		this.sp.deleteUrl( this.url );
	}else{	// Move it
		this.sp.addGroupUrl( group_id, null, this.url );
	}
	
	// Refresh	
	window.meeOptions.group.refreshGroups();
	window.meeOptions.popularSites.refresh();
};


function Deterrents(db, sp){
	this.db = db;
	this.sp = sp;
	
	this.els = {};
	this.els["listbox"] = null;
	for( id in this.els ){
		this.els[id] = document.getElementById("deterrents-" + id);
	}
		
	this.refresh();
}
Deterrents.prototype.refresh = function(){
	// Clear out the list, and reload it from the db.
	// Use a db call that takes in groups, left joined on deterrents; and wherever deterrent is not null, us a tick.
	
	// Clear out children
	for( var i = this.els["listbox"].childNodes.length - 1; i>=0; i-- ){
		var el = this.els["listbox"].childNodes[i];
		if( el.nodeName=="listitem" ) el.parentNode.removeChild(el);
	}
	
	// Read in status
	var	groupDeterLink = {};
	var fRow = function(statement){
			var id = statement.getInt64(0);
			var groupname = statement.getString(1);
			var detActive = !statement.getIsNull(2);
			groupDeterLink[id] = detActive;
		};
	this.db.select("SELECT groups.id, groupname, deterrentlinks.group_id FROM groups LEFT JOIN deterrentlinks ON groups.id = deterrentlinks.group_id", fRow );
	
	// Read in
	var fRow = function(statement){
			var id = statement.getInt64(0);
			var groupname = statement.getString(1);
			var detActive = !statement.getIsNull(2);
			
			var el = document.createElement("listitem");
				el.setAttribute("allowevents", "true");
				
			var elCell1 = document.createElement("listcell");
				elCell1.setAttribute("label", groupname);
			el.appendChild( elCell1 );
			var elCell2 = document.createElement("listcell");
				var elCheck = document.createElement("checkbox");
				elCheck.groupid = id;
				elCheck.groupname = groupname;
				elCheck.dbname = "deterrents";
				if( detActive ) elCheck.setAttribute("checked", "true");
				elCheck.addEventListener("CheckboxStateChange", MTCOMMON.bind(this, this.save), false);
				elCell2.appendChild( elCheck );
			el.appendChild( elCell2 );
			var elCell3 = document.createElement("listcell");
				var elCheck = document.createElement("checkbox");
				elCheck.groupid = id;
				elCheck.groupname = groupname;
				elCheck.dbname = "deterrentlinks";
				if( groupDeterLink[id] ) elCheck.setAttribute("checked", "true");
				elCheck.addEventListener("CheckboxStateChange", MTCOMMON.bind(this, this.save), false);
				elCell3.appendChild( elCheck );
			el.appendChild( elCell3 );
			this.els["listbox"].appendChild( el );
		};
	this.db.select("SELECT groups.id, groupname, deterrents.group_id FROM groups LEFT JOIN deterrents ON groups.id = deterrents.group_id", MTCOMMON.bind(this, fRow) );
};
Deterrents.prototype.save = function(){
	// Clear out the deterrents table; and rebuild by processing each list item, and if checked, INSERTing it.
	this.db.execute("DELETE FROM deterrents");
	this.db.execute("DELETE FROM deterrentlinks");
	
	var els = this.els["listbox"].getElementsByTagName("checkbox");
	var dbname = "";
	for( var i = 0; i < els.length; i++ ){
		if( els[i].checked ){
			dbname = els[i].dbname;
			if( dbname ){
				this.db.execute( "INSERT INTO " + dbname + " (group_id) VALUES(" + els[i].groupid + ")" );
			}
		}
	}	
	
	window.meeOptions.notifyChange();
};

function Groups(db, sp){
	this.db = db;
	this.sp = sp;
	
	// Read in elements
	this.els = {};
	this.els["listbox"] = null;
	this.els["remove"] = null;
	this.els["add"] = null;
	this.els["sites-title"] = null;
	this.els["sites-listbox"] = null;
	this.els["sites-remove"] = null;
	for( id in this.els ){
		this.els[id] = document.getElementById("groups-" + id);
	} 
	
	// Attach events
	this.els["listbox"].addEventListener("select", MTCOMMON.bind(this, this.selectList), false);
	this.els["remove"].addEventListener("command", MTCOMMON.bind(this, this.removeGroup), false);
	this.els["add"].addEventListener("command", MTCOMMON.bind(this, this.addGroup), false);
	this.els["sites-remove"].addEventListener("command", MTCOMMON.bind(this, this.removeSite), false);
	
	
	this.refreshGroups();
}

Groups.prototype.refreshGroups = function(){
	// Clear out children
	for( var i = this.els["listbox"].childNodes.length - 1; i>=0; i-- ){
		var el = this.els["listbox"].childNodes[i];
		el.parentNode.removeChild(el);
	}
	// Read in
	var fRow = function(statement){
			var id = statement.getInt64(0);
			var groupname = statement.getString(1);
			var elItem = this.els["listbox"].appendItem( groupname, id );
		};
	this.db.select("SELECT id, groupname FROM groups", MTCOMMON.bind(this, fRow) );
	
	this.refreshSites();	// clear out
	
};

Groups.prototype.refreshSites = function(group_id){
	// Clear out children
	for( var i = this.els["sites-listbox"].childNodes.length - 1; i>=0; i-- ){
		var el = this.els["sites-listbox"].childNodes[i];
		el.parentNode.removeChild(el);
	}
	// Read in
	if( group_id && group_id!=0 ){
		var fRow = function(statement){
				var url = statement.getString(0);
				var elItem = this.els["sites-listbox"].appendItem( url, group_id );
				elItem.setAttribute("url", url);
			};
		this.db.select("SELECT url FROM groups_urls INNER JOIN urls ON groups_urls.url_id=urls.id WHERE group_id = " + group_id, MTCOMMON.bind(this, fRow) );
	}
};

Groups.prototype.selectList = function(){
	// Set title and refresh sites
	var elItem = this.els["listbox"].selectedItem;
	if( !elItem ) return;
	
	this.els["sites-title"] = "Sites in " + elItem.getAttribute("label");
	
	this.refreshSites( elItem.value );
};

Groups.prototype.addGroup = function(){
	// Get a name and add it
	
	if( this.els["listbox"].getRowCount()>=10 ){
		alert("You can only have 10 groups!");
		return;
	}
	
	var groupname = prompt("Please enter a name for this group:");
	if( !groupname ) return;
	
	this.sp.addGroup(groupname);
	this.refreshGroups();
	window.meeOptions.deterrents.refresh();
	window.meeOptions.contextGroups.refresh();
	window.meeOptions.notifyChange();
};

Groups.prototype.removeGroup = function(){
	// Remove selected group
	
	var elItem = this.els["listbox"].selectedItem;
	if( !elItem ) return;
	
	if( !confirm("Remove group?") ) return;
	
	this.sp.removeGroup( elItem.value );
	window.meeOptions.deterrents.refresh();
	window.meeOptions.contextGroups.refresh();
	this.refreshGroups();
	window.meeOptions.notifyChange();
};

Groups.prototype.removeSite = function(){
	// Remove selected site
	
	var elItem = this.els["sites-listbox"].selectedItem;
	if( !elItem ) return;
	
	var url = elItem.getAttribute("label");
	var group_id = elItem.value;
	if( !confirm("Remove " + url + "?") ) return;
	
	this.sp.removeGroupUrl( group_id, null, url );
	this.refreshSites(group_id);
	window.meeOptions.notifyChange();
};





function Alteration(db, sp){
	this.db = db;
	this.sp = sp;
	
	this.elButtonRemove = document.getElementById("alteration_remove");
	this.elButtonAdd = document.getElementById("alteration_add");
	this.elTextFind = document.getElementById("alteration_find");
	this.elTextReplace = document.getElementById("alteration_replace");
	this.elList = document.getElementById("alteration_list");
	
	this.elButtonRemove.addEventListener("command", MTCOMMON.bind(this, this.remove), false );
	this.elButtonAdd.addEventListener("command", MTCOMMON.bind(this, this.add), false );
	
	this.refresh();
};
Alteration.prototype.refresh = function(){
	var els = this.elList.getElementsByTagName("listitem");
	for( var i = els.length - 1; i >=0; i--) els[i].parentNode.removeChild( els[i] );
	
	var fRow = function(statement){
		var find = statement.getString(0);
		var replace = statement.getString(1);
		var el = document.createElement("listitem");
			el.find = find;
			el.replace = replace;
		var elCell1 = document.createElement("listcell");
			elCell1.setAttribute("label", find);
		el.appendChild( elCell1 );
		var elCell2 = document.createElement("listcell");
			elCell2.setAttribute("label", replace);
		el.appendChild( elCell2 );
		this.elList.appendChild( el );
	};
	this.db.select("SELECT find, replace FROM url_maps", MTCOMMON.bind(this, fRow) );
};
Alteration.prototype.add = function(){
	if( !this.elTextFind.value ){
		alert("Please enter a site address to capture.");
		return;
	}
	if( !this.elTextReplace.value ){
		alert("Please enter an alteration for this site.");
		return;
	}
	
	this.sp.addMap(this.elTextFind.value, this.elTextReplace.value);
	this.refresh();
	window.meeOptions.notifyChange();
};
Alteration.prototype.remove = function(){
	var elItem = this.elList.selectedItem;
	if( !elItem ) return;
	
	this.sp.removeMap( elItem.find, elItem.replace );
	this.refresh();
	window.meeOptions.notifyChange();
};



function Maintenance(db, sp, popularSites){
	this.db = db;
	this.sp = sp;
	this.popularSites = popularSites;
	this.elText = document.getElementById("delete_text");
	this.elButton = document.getElementById("delete_button");
	
	this.elButton.addEventListener( "click", MTCOMMON.bind(this, this.deleteSites), false);
};

Maintenance.prototype.deleteSites = function(){
	
	if( !this.elText.value ){
		alert("Please enter a site to remove!");
		return;
	}
	
	var data = {};
	data.urlids = [];
	data.urls = [];
	var fRow = function(statement){
		var url = statement.getString(0);
		var id = statement.getInt64(1);
		data.urls.push(url);
		data.urlids.push(id);
	};
	this.db.select( "SELECT DISTINCT url, id FROM urls WHERE url LIKE '" + this.elText.value + "'", fRow );
	
	if( !confirm("This will remove the records for the following site(s):\n  " + data.urls.join("\n  ") + "\nProceed?") ) return;
	
	this.db.execute("DELETE FROM urls WHERE url LIKE '" + this.elText.value + "'");
	
	for( var i = 0; i < data.urlids.length; i++ ){
		var id = data.urlids[i];
		this.db.execute("DELETE FROM log WHERE url_id = " + id);
	}
	
	this.popularSites.refresh();
	
	if( !confirm("Do you also wish to permanently ignore the following sites?\n  " + data.urls.join("\n  ")) ) return;
	for( var i = 0; i < data.urls.length; i++ ){
		var url = data.urls[i];
		this.sp.addIgnoredUrl(url);
	}
	this.popularSites.refresh();
	
};














function PopularSites(db, sp){
	this.db = db;
	this.sp = sp;
	
	// Attach into els
	this.elTimeContainer = document.getElementById("timepane_popular");
	this.elMainContainer = document.getElementById("maincontent_popular");
	
	this.elListOverview = document.getElementById("list-overview");
	this.elListPopular = document.getElementById("list-popular");
	
	this.timePane = new TimePane( this.elTimeContainer, MTCOMMON.bind(this, this.refresh), this.db, this.sp ); 
	
};

PopularSites.prototype.refresh = function(starttime, endtime){
	// Generate total time elements
	// Generate rankings
	
	if( this.last ){
		if( !starttime ) starttime = this.last.starttime;
		//if( !endtime ) endtime = this.last.endtime;
	}
	this.last = {'starttime':starttime, 'endtime':endtime};
	
		var els = this.elListOverview.getElementsByTagName("listitem");
		for( var i = els.length - 1; i >=0; i--) els[i].parentNode.removeChild( els[i] );
		
		var els = this.elListPopular.getElementsByTagName("listitem");
		for( var i = els.length - 1; i >=0; i--) els[i].parentNode.removeChild( els[i] );
		
		this.refreshTotals(starttime, endtime);
		this.refreshPopular(starttime, endtime);

};

PopularSites.prototype.refreshPopular = function(starttime, endtime){
	// Grab top 30 by duration; then top 30 by daily average; and merge
	
	var baseSelect = "(SELECT duration*1000 as duration, url_id, url, day FROM log INNER JOIN urls ON urls.id=log.url_id WHERE startdate>" + starttime + (endtime? " AND startdate < " + endtime : "") + ") AS logbase";

	// Load the groups -> must be distinct as only grabbing top 10s
	var groupIds = {};
	var groups = [];
	var fRow = function(statement){
			var group = statement.getString(0);
			var id = statement.getInt64(1);
			if( !groupIds[id] ) groupIds[id] = group;
			groups.push( group );
		}
	this.db.select( "SELECT groupname, id FROM groups", fRow );
	
	// Totals
	var dataTotals = {currentType:""};
	var fRow = function(statement){
			var duration = statement.getInt64(0);
			var url = statement.getString(1);
			var id = statement.getInt64(2);
			if( !dataTotals[ dataTotals.currentType ] ) dataTotals[ dataTotals.currentType ] = {};
			dataTotals[ dataTotals.currentType ][url] = {'duration': duration, 'sum':0, 'count':0, 'url_id': id};
		};
	dataTotals.currentType = "all";
	this.db.select( "SELECT sum(duration) as sumDuration, url, url_id FROM " + baseSelect + " GROUP BY url ORDER BY sumDuration DESC LIMIT 10", fRow );
	dataTotals.currentType = "ungroup";
	this.db.select( "SELECT sum(duration) as sumDuration, url, logbase.url_id FROM " + baseSelect + " LEFT JOIN groups_urls ON groups_urls.url_id=logbase.url_id WHERE group_id IS NULL GROUP BY url ORDER BY sumDuration DESC LIMIT 10", fRow );

	var fRow = function(statement){
			var duration = statement.getInt64(0);
			var url = statement.getString(1);
			var group_id = statement.getInt64(2);
			var id = statement.getInt64(3);
			var group = groupIds[group_id];
			dataTotals[ "group_" + group ][url] = {'duration': duration, 'sum':0, 'count':0, 'url_id': id, 'group_id':group_id};
		};
	for( id in groupIds ){
		var group = groupIds[id];
		if( !dataTotals["group_" + group] ) dataTotals["group_" + group] = {};
		this.db.select( "SELECT sum(duration) as sumDuration, url, group_id, logbase.url_id FROM " + baseSelect + " INNER JOIN groups_urls ON groups_urls.url_id=logbase.url_id WHERE group_id = " + id + " GROUP BY url, group_id ORDER BY sumDuration DESC LIMIT 10", fRow );
	}
	
	// Averages (feed into dataTotals)
	var fRow = function(statement){
			var duration = statement.getInt64(0);
			var count = statement.getInt64(1);
			var url = statement.getString(2);
			if( dataTotals[ dataTotals.currentType ][url] ) {
				//alert( url + "\n\n" + duration / count );
				dataTotals[ dataTotals.currentType ][url].avg = (duration==0 || count==0)? 0 : (duration / count);  
			}
		};
	var fRow2 = function(statement){
			var duration = statement.getInt64(0);
			var count = statement.getInt64(1);
			var url = statement.getString(2);
			var group_id = statement.getInt64(3);
			var group = groupIds[group_id]
			if( dataTotals[ "group_" + group ][url] ) {
				dataTotals[ "group_" + group ][url].avg = (duration==0 || count==0)? 0 : (duration / count);  
			}
		};
	
	// Creation:
	var fCreateSection = function(name){
			var el = document.createElement("listitem");
			var elCell1 = document.createElement("listcell");
				elCell1.setAttribute("label", (name || " ") );
			el.appendChild( elCell1 );
			var elCell2 = document.createElement("listcell");
				elCell2.setAttribute("label", " ");
			el.appendChild( elCell2 );
			var elCell3 = document.createElement("listcell");
				elCell3.setAttribute("label", " ");
			el.appendChild( elCell3 );
			var elCell4 = document.createElement("listcell");
				elCell4.setAttribute("label", " ");
			el.appendChild( elCell4 );
			this.elListPopular.appendChild( el );
		};
	fCreateSection = MTCOMMON.bind(this, fCreateSection);
	var fCreateEntry = function(name, timeTotalMS, timeAverageMS){
			//alert( name + "\n" + timeTotalMS + "\n" + timeAverageMS );
			var el = document.createElement("listitem");
			el.setAttribute("url", name);
			var elCell1 = document.createElement("listcell");
				elCell1.setAttribute("label", " ");
			el.appendChild( elCell1 );
			var elCell2 = document.createElement("listcell");
				elCell2.setAttribute("label", name);
			el.appendChild( elCell2 );
			var elCell3 = document.createElement("listcell");
				elCell3.setAttribute("label", this.renderTime(timeTotalMS) );
			el.appendChild( elCell3 );
			var elCell4 = document.createElement("listcell");
				elCell4.setAttribute("label", this.renderTime(timeAverageMS) );
			el.appendChild( elCell4 );
			this.elListPopular.appendChild( el );
		};
	fCreateEntry = MTCOMMON.bind(this, fCreateEntry);

	// Process all (and fill out averages along the way		
	var name = "";
	for( type in dataTotals ){
		if( type!="currentType" ){
			if( type=="all" ){
				// Get all
				dataTotals.currentType = "all";
				fCreateSection("All Sites");
				for( url in dataTotals["all"] ){
					var id = dataTotals["all"][url]["url_id"];
					this.db.select( "SELECT sum(sumDuration), count(day), url FROM (SELECT sum(duration) AS sumDuration, day, url FROM " + baseSelect + " WHERE logbase.url_id = " + id + " GROUP BY day)", fRow );
					//alert( url + "\n\n" + dataTotals["all"][url].duration + "\n" + dataTotals["all"][url].avg );
					fCreateEntry(url, dataTotals["all"][url].duration, dataTotals["all"][url].avg );
				}
				
			}else if( type=="ungroup" ){
				// Get ungrouped
				dataTotals.currentType = "ungroup";
				fCreateSection("Ungrouped Sites");
				for( url in dataTotals["ungroup"] ){
					var id = dataTotals["ungroup"][url]["url_id"];
					this.db.select( "SELECT sum(sumDuration), count(day), url FROM (SELECT sum(duration) AS sumDuration, day, url FROM " + baseSelect + " LEFT JOIN groups_urls ON groups_urls.url_id=logbase.url_id WHERE group_id IS NULL AND logbase.url_id = " + id + " GROUP BY day)", fRow );
					fCreateEntry(url, dataTotals["ungroup"][url].duration, dataTotals["ungroup"][url].avg );
				}
			}else if( type.indexOf("group_")==0 ){	// group
				// Each group:
				fCreateSection( this.camelise( type.substring(6) ) );
				for( url in dataTotals[type] ){
					var url_id = dataTotals[type][url]["url_id"];
					var group_id = dataTotals[type][url]["group_id"];
					this.db.select( "SELECT sum(sumDuration), count(day), url, group_id FROM (SELECT sum(duration) AS sumDuration, day, url, group_id FROM " + baseSelect + " INNER JOIN groups_urls ON groups_urls.url_id=logbase.url_id WHERE group_id = " + group_id + " AND logbase.url_id = " + url_id + " GROUP BY day)", fRow2 );
					fCreateEntry(url, dataTotals[type][url].duration, dataTotals[type][url].avg );
				}
			}
		}
		fCreateSection("");
	}
	
	
};

PopularSites.prototype.refreshTotals = function(starttime, endtime){
	// Total time
	var sql = "";
	var baseSelect = "(SELECT duration*1000 AS duration, url_id, day FROM log WHERE startdate > " + starttime + (endtime? " AND startdate < " + endtime : "") + ") AS logbase";
	
	var dataTotals = {currentType:""};
	var fRow = function(statement){
			var duration = statement.getInt64(0);
			dataTotals[ dataTotals.currentType ] = duration;
		};
	dataTotals.currentType = "all";
	sql = "SELECT sum(duration) as sumDuration FROM " + baseSelect;
	this.db.select(sql, fRow);

	dataTotals.currentType = "ungroup";
	sql = "SELECT Sum(duration) AS sumDuration FROM " + baseSelect + " LEFT JOIN groups_urls ON logbase.url_id = groups_urls.url_id"
	sql += " GROUP BY groups_urls.url_id HAVING groups_urls.url_id Is Null"
	this.db.select(sql, fRow);

	var fRow = function(statement){
		var duration = statement.getInt64(0);
		var type = "group_" + statement.getString(1);
		dataTotals[ type ] = duration;
	}
	sql = "SELECT Sum(duration) AS sumDuration, groupname";
	sql += " FROM (SELECT duration, logbase.url_id, day, group_id FROM " + baseSelect + " INNER JOIN groups_urls ON logbase.url_id = groups_urls.url_id) AS loggroupbase INNER JOIN groups ON groups.id=loggroupbase.group_id";
	sql += " GROUP BY groupname";
	this.db.select( sql, fRow );
	
	// Daily
	var dataAverages = {currentType:""};
	var fRow = function(statement){
			var duration = statement.getInt64(0);
			if( !dataAverages[ dataAverages.currentType ] ) dataAverages[dataAverages.currentType] = {sum:0, count:0};
			dataAverages[dataAverages.currentType].sum += duration;
			dataAverages[dataAverages.currentType].count++;
		};
	dataAverages.currentType = "all";
	sql = "SELECT Sum(duration) AS SumOfduration FROM " + baseSelect + " GROUP BY day";
	this.db.select(sql, fRow);

	dataAverages.currentType = "ungroup";
	sql = "SELECT Sum(duration) AS sumDuration FROM " + baseSelect + " LEFT JOIN groups_urls ON logbase.url_id = groups_urls.url_id"
	sql += " GROUP BY day, groups_urls.url_id HAVING groups_urls.url_id Is Null"
	this.db.select(sql, fRow);

	var fRow = function(statement){
			var duration = statement.getInt64(0);
			var type = "group_" + statement.getString(1);
			if( !dataAverages[ type ] ) dataAverages[type] = {sum:0, count:0};
			dataAverages[type].sum += duration;
			dataAverages[type].count++;
	}
	sql = "SELECT Sum(duration) AS sumDuration, groupname";
	sql += " FROM (SELECT duration, logbase.url_id, day, group_id FROM " + baseSelect + " INNER JOIN groups_urls ON logbase.url_id = groups_urls.url_id) AS loggroupbase INNER JOIN groups ON groups.id=loggroupbase.group_id";
	sql += " GROUP BY groupname, day";
	this.db.select( sql, fRow );


	// Now render
	var fCreateRow = function(elParent, name, totalTimeMs, dailyAverageMs){
			var el = document.createElement("listitem");
			var elCell1 = document.createElement("listcell");
				elCell1.setAttribute("label", name);
			el.appendChild( elCell1 );
			var elCell2 = document.createElement("listcell");
				elCell2.setAttribute("label", this.renderTime(totalTimeMs) );
			el.appendChild( elCell2 );
			var elCell3 = document.createElement("listcell");
				elCell3.setAttribute("label", this.renderTime(dailyAverageMs) );
			el.appendChild( elCell3 );
			elParent.appendChild( el );
		};
	fCreateRow = MTCOMMON.bind( this, fCreateRow);
	for( type in dataTotals ){
		if( type!="currentType" ){
			var name = "";
			if( type.indexOf("group_")==0 ){
				name = this.camelise( type.substring(6) );
			}else{
				name = this.camelise( type ) + " Sites";
				if( name=="Ungroup Sites" ) name = "Ungrouped Sites";
			}
			var avg = dataAverages[type]? (dataAverages[type].sum / dataAverages[type].count):0;
			fCreateRow( this.elListOverview, name, dataTotals[type], avg ); 
		}
	}
};

PopularSites.prototype.renderTime = function(timeMs){
	if( !timeMs || timeMs=="undefined" ) return "0h 0m";
	
	var msPerH = (1000*60*60);
	var msPerM = (1000*60);	
	var h = parseInt(timeMs / msPerH);
	var m = parseInt((timeMs-(h*msPerH)) / msPerM);
	
	m++;
	if( m>=60 ){
		h++;
		m = 0;
	}
	
	return (h + "h" + " " + m + "m");
};	
PopularSites.prototype.camelise = function(str){
	if( !str ) return;
	return str.substring(0, 1).toUpperCase() + str.substring(1);
};

function TimePane(elParent, fCallback, db, sp){
	this.fCallback = fCallback;
	this.db = db;
	this.sp = sp;
	this.elParent = elParent;
	this.create(elParent);
	
	this.fCallback( this.sp.getStartTodayMS() );
}
TimePane.prototype.create = function(elParent){
	// Create times
	
	// Attach elements
	var els = elParent.getElementsByTagName("*");
	var id = null;
	for( var i = 0; i < els.length; i++ ){
		if( id = els[i].getAttribute("timePane") ){
			switch(id){
				case "today":
					els[i].starttime = this.sp.getStartTodayMS();
					break;
				case "thisweek":
					els[i].starttime = this.sp.getStartWeekMS();
					break;
				case "yesterday":
					els[i].starttime = this.timeAgo(0,0,1, this.sp.getStartTodayMS() );
					els[i].endtime = this.sp.getStartTodayMS();
					break;
				case "lastworkingweek":
					els[i].starttime = this.sp.getStartWeekMS() - (1000*60*60*24*7);
					els[i].endtime = this.sp.getStartWeekMS();
					break;
				case "lastweek":
					els[i].starttime = this.timeAgo(0,0,7);
					break;
				case "lastmonth":
					els[i].starttime = this.timeAgo(0,1);
					break;
				case "lastyear":
					els[i].starttime = this.timeAgo(1);
					break;
			}
			els[i].addEventListener( "mousedown", MTCOMMON.bind( this, this.timeClick ), false );
		}
	}
	
};

TimePane.prototype.timeClick = function(event){
	// Unbolden all elements:
	var els = this.elParent.getElementsByTagName("*");
	for( var i = 0; i < els.length; i++ ){
		if( els[i].getAttribute("timePane") ){
			els[i].style.fontWeight = "";
		}
	}

	var el = event.originalTarget;
	el.style.fontWeight = "bold";
	this.fCallback( el.starttime, el.endtime );
};

TimePane.prototype.timeAgo = function(years, months, days, time){
	var d = new Date();
	if( time ) d = new Date(time);
	d.setFullYear( d.getFullYear() - (years || 0) );
	d.setMonth( d.getMonth() - (months || 0) );
	d.setHours( d.getHours() - ((days || 0)*24) );
	
	return d.valueOf();
};