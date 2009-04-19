function MeeGroups(db){
	this.db = db;
	
	this.addGroup("test");
	this.initialise();
}

MeeGroups.prototype.initialise = function(){
	this.groups = {};	// holds urls
	this.urls = {};		// points to group id
	this.ids = {};		// points to group name
	
	// Load up watched
	var fRow = function(statement){
			var id = statement.getInt64(0);
			var groupname = statement.getString(1);
			var url = statement.getString(2);
			
			if( !this.groups[groupname] ) this.groups[groupname] = {'id':id, 'urls':{}};
			this.groups[groupname].urls[url] = true;
			this.urls[url] = id;
			this.ids[id] = groupname;
		};
	this.db.select( "SELECT id, groupname, url FROM groups_urls INNER JOIN groups ON groups.id=groups_urls.group_id", MTCOMMON.bind(this, fRow) );
};

MeeGroups.prototype.addGroup = function(groupname){
	this.db.execute("INSERT INTO groups (groupname) VALUES('" + groupname + "')");
	this.initialise();
};
MeeGroups.prototype.removeGroup = function(groupname){
	this.db.execute("DELETE FROM groups WHERE groupname = '" + groupname + "'");
	this.db.execute("DELETE FROM groups_urls WHERE group_id = " + this.groups[groupname].id + "");
	this.initialise();
};

MeeGroups.prototype.addUrl = function(groupname, url){
	// Add to watch
	this.db.execute("INSERT INTO groups_urls (group_id, url, dateadded) VALUES(" + this.groups[groupname].id + "'" + url + "', " + (new Date()).valueOf() + ")" );
	this.initialise();
};

MeeGroups.prototype.removeUrl = function(groupname, url){
	// Remove from watch
	this.db.execute("DELETE FROM groups_urls WHERE group_id = " + this.groups[groupname].id + " AND url = '" + url + "'");
	this.initialise();
};

MeeGroups.prototype.test = function(url){
	// Return true if this is being watched
	return this.urls[url];
};