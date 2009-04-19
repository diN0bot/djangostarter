

function MeeGroups(meeTimer){
try{
	this.meeTimer = meeTimer;
	this.db = this.meeTimer.db;
	this.sp = this.meeTimer.sp;
	this.initialise();
}catch(e){
	if( MEETIMERDEBUGMODE ) alert("MeeGroups construct\n" + e.toString());
}
}

MeeGroups.prototype.initialise = function(){
	this.groups = {};	// holds urls, indexed by id
	this.urls = {};		// points to group object, indexed by name
	this.groupnames = {};		// points to group object, indexed by name
	this.numberGroups = 0;
	
	
	// Load up groups
	var fRow = function(statement){
			var id = statement.getInt64(0);
			var groupname = statement.getString(1);
			if( !this.groups[id] ) this.groups[id] = {'id':id, 'groupname':groupname, 'urls':{}};
			this.groupnames[groupname] = this.groups[id];
			this.numberGroups++;
		};
	this.db.select( "SELECT id, groupname FROM groups ", MTCOMMON.bind(this, fRow) );
	
	// Load urls for groups
	var fRow = function(statement){
			var id = statement.getInt64(0);
			var groupname = this.groups[id].groupname;
			var url = statement.getString(1);
			if( url ){
				this.groups[ id ].urls[url] = true;
				if( !this.urls[url] ) this.urls[url] = {};
				this.urls[url][groupname] = this.groups[id];
			}
		};
	this.db.select( "SELECT groups_urls.group_id, urls.url FROM groups_urls INNER JOIN urls ON groups_urls.url_id = urls.id;", MTCOMMON.bind(this, fRow) );
	
	
	
	// Refresh the Tray Icon Menu
	// Remove old items:
	this.iterateMenuTrayGroupElements( function(el){
			el.parentNode.removeChild(el);
		});
	// Add new ones:
	var elMenuSeperator = document.getElementById("meetimer-popup-site-after-groups");
	var i = 0;
	for( groupname in this.groupnames ){
		if( this.groupnames.hasOwnProperty(groupname) ){
			var elMenuItem = document.createElement("menuitem");
			elMenuItem.groupname = groupname;
			elMenuItem.setAttribute("label", groupname);
			elMenuItem.setAttribute("type", "checkbox");
			elMenuItem.setAttribute("autocheck", "false");
			elMenuSeperator.parentNode.insertBefore( elMenuItem, elMenuSeperator );
		}
	}
	
};

MeeGroups.prototype.iterateMenuTrayGroupElements = function(func){
	// Iterate over elements in the menu tray and apply the function
	
	var elMenuPopup = document.getElementById("meetimer-popup-site-menupopup");
	for( var i = elMenuPopup.childNodes.length - 1; i >= 0; i-- ){
		if( elMenuPopup.childNodes[i].groupname ) func(elMenuPopup.childNodes[i]);
	};
};


MeeGroups.prototype.addGroup = function(groupname){
	this.sp.addGroup(groupname);
	this.initialise();
};
MeeGroups.prototype.removeGroup = function(groupname){
	this.sp.removeGroup(this.groupnames[groupname].id);
	this.initialise();
};

MeeGroups.prototype.addUrl = function(groupname, url){
	// Add to watch
	this.sp.addGroupUrl( this.groupnames[groupname].id, null, url );
	this.initialise();
	this.setMenu(url);
};

MeeGroups.prototype.removeUrl = function(groupname, url){
	// Remove from watch
	this.sp.removeGroupUrl( this.groupnames[groupname].id, null, url );
	this.initialise();
	this.setMenu(url);
};

MeeGroups.prototype.test = function(url){
	// Return true if this is being watched
	return !!(this.urls[url]);
};

MeeGroups.prototype.getGroupNamesForUrlAsString = function(url, seperator){
	// Return a string of names
	seperator = seperator || ", ";
	var groupnames = this.urls[url];
	
	var gn = [];
	for( g in groupnames ) gn.push(g);
	
	return gn.join(seperator);
};
MeeGroups.prototype.getNumberGroupsForUrl = function(url){
	var i = 0;
	var groupnames = this.urls[url];
	for( g in groupnames ) i++;
	return i;	
};

MeeGroups.prototype.isUrlInGroup = function(url, groupname){
	if( this.urls[url] ) return this.urls[url][groupname];
};


MeeGroups.prototype.setMenu = function(url){
	// Update the Groups Popup menu to either 'Add' or 'Remove' this url
	
	
	var groupnames = this.urls[url];
		
	var iterator = function(el){
		if( groupnames && groupnames[el.groupname] ){
			el.setAttribute("checked", "true");
		}else{
			el.setAttribute("checked", "");
		}
	};

	this.iterateMenuTrayGroupElements(iterator);
	var ignore = this.meeTimer.ignored.test(url)? " - Ignored":"";
	var numberGroups = this.getNumberGroupsForUrl(url);
	if( numberGroups && numberGroups==1 ){
		numberGroups = this.getGroupNamesForUrlAsString(url);
	}else{
		numberGroups = numberGroups? (numberGroups + " groups") : "Ungrouped";
	}
	document.getElementById("meetimer-popup-site").setAttribute("label", url + " (" + numberGroups + ignore + ")" );
};