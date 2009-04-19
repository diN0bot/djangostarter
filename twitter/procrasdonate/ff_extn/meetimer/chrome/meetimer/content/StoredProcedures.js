function StoredProcedures(db){
	this.db = db; 
	

	this.mapROT13 = [];
	var s = "abcdefghijklmnopqrstuvwxyz";
	for(i=0; i<s.length; i++)
		this.mapROT13[s.charAt(i)] = s.charAt((i+13)%26);
	for (i=0; i<s.length; i++)
		this.mapROT13[s.charAt(i).toUpperCase()] = s.charAt((i+13)%26).toUpperCase();
}


StoredProcedures.prototype.rot13 = function(url){
	// Encode url
	s = "";
	for (i=0; i<url.length; i++){
		var b = url.charAt(i);
		s += (b>='A' && b<='Z' || b>='a' && b<='z' ? this.mapROT13[b] : b);
	}
	return s;
};

StoredProcedures.prototype.addIgnoredUrl = function(url){
	var url13 = this.rot13(url);
	this.db.execute( "INSERT INTO ignored_urls (url) VALUES('" + url13 + "')");
};
StoredProcedures.prototype.removeIgnoredUrl = function(url){
	var url13 = this.rot13(url);
	this.db.execute("DELETE FROM ignored_urls WHERE url = '" + url13 + "'");
};

StoredProcedures.prototype.log = function(url, startTime, durationMS){
	var duration = durationMS / 1000;
	
	// get day & week of year:
	var d = new Date(startTime);
	var onejan = new Date(d.getFullYear(), 0, 1);
	d.setMinutes( d.getMinutes() - d.getTimezoneOffset() );
	onejan.setMinutes( onejan.getMinutes() - onejan.getTimezoneOffset() );
	var days = parseInt((d.valueOf()-onejan.valueOf())/86400000);
	var weeks = Math.ceil( (days + onejan.getDay())/7 ); 

	var sDays = new String( d.getFullYear() );
	sDays += days;
	var sWeeks = new String( d.getFullYear() );
	sWeeks += weeks;

	// get an id for this url
	var url_id = this.getUrlId(url);
	
	// check id was found; if not; create entry for this url
	if( url_id < 0 ){
		this.db.execute("INSERT INTO urls (url) VALUES('" + url + "')");
		url_id = this.getUrlId(url);
	}

	this.db.execute("INSERT INTO log (url_id, startdate, duration, day, week) VALUES(" + url_id + ", " + startTime + ", " + duration + ", " + sDays + ", " + sWeeks + ")" );
};

StoredProcedures.prototype.getUrlId = function(url){
	// Return id, or -1 if not found
	var url_id = -1;
	var fRow = function(statement){
		url_id = statement.getInt64(0);
	}
	this.db.select("SELECT id FROM urls WHERE url = '" + url + "'", fRow);
	return url_id;
}

StoredProcedures.prototype.getGroupForUrl = function(url){
	var url_id = this.getUrlId(url);
	if( url_id < 0 ) return;
	
	var data = {};
	var fRow = function(statement){
			data.id = statement.getInt64(0);
			data.groupname = statement.getString(1);
		};
	this.db.select( "SELECT groups_urls.group_id, groups.groupname FROM groups_urls INNER JOIN groups ON groups_urls.group_id = groups.id WHERE groups_urls.url_id = " + url_id, MTCOMMON.bind(this, fRow) );
	return data;
}

StoredProcedures.prototype.getStartTodayMS = function(){
	// Return unix epoch milliseconds at midnight today (start of)
	// Now - (h*3600000 + m*60000 + s*1000)
	
	var d = new Date();
	var ms = d.valueOf();
	ms -= d.getSeconds()*1000;
	ms -= d.getMinutes()*60000;
	ms -= d.getHours()*3600000;
	return ms;
};

StoredProcedures.prototype.getStartWeekMS = function(options){
	// Return unix epoch ms at midnight of start of this week
	// Now - ()
	
	var d = new Date();
	var day = d.getDay();
	if( !options || !options.startSunday ){	// offset for monday
		day = day - 1;
		if( day<0 ) day = 7;
	}
	
	var ms = this.getStartTodayMS();
	ms -= day * 86400000;
	return ms;	
};

StoredProcedures.prototype.getUrlDurationToday = function(url){
	return this.getUrlDuration( url, this.getStartTodayMS() );
}
StoredProcedures.prototype.getUrlDurationWeek = function(url){
	return this.getUrlDuration( url, this.getStartWeekMS() );
};
StoredProcedures.prototype.getDomainDurationToday = function(domain){
	return this.getUrlDuration( domain, this.getStartTodayMS(), true );
}
StoredProcedures.prototype.getGroupDurationToday = function(groupid){
	return this.getGroupDuration( groupid, this.getStartTodayMS() );
}
StoredProcedures.prototype.getGroupDurationWeek = function(groupid){
	return this.getGroupDuration( groupid, this.getStartWeekMS() );
};
StoredProcedures.prototype.getGroupsDurationToday = function(){
	return this.getGroupsDuration( this.getStartTodayMS() );
}
StoredProcedures.prototype.getGroupsDurationWeek = function(){
	return this.getGroupsDuration( this.getStartWeekMS() );
};
StoredProcedures.prototype.getUngroupedDurationToday = function(){
	return this.getUngroupedDuration( this.getStartTodayMS() );
};
StoredProcedures.prototype.getUngroupedDurationWeek = function(){
	return this.getUngroupedDuration( this.getStartWeekMS() );
};
StoredProcedures.prototype.getAllDurationWeek = function(){
	data = {duration:0};
	var fRow = function(statement){
			data.duration = statement.getInt64(0);
		};
	
	this.db.select("SELECT SUM(duration) AS sumDuration FROM log WHERE startdate > " + this.getStartWeekMS(), fRow);
	return data.duration * 1000;
};
StoredProcedures.prototype.getUrlDuration = function(url, startdate, useLike){
	// Return duration on an url, in ms
	data = {duration:0};
	var fRow = function(statement){
			data.duration = statement.getInt64(0);
		};
	
	if(url)	url = " AND url " + (useLike? "LIKE '%":"= '") + url + "'";
	else url = "";
	
	this.db.select("SELECT SUM(duration) AS sumDuration FROM log INNER JOIN urls ON log.url_id=urls.id WHERE startdate > " + startdate + url, fRow);
	return data.duration * 1000;
};

StoredProcedures.prototype.getGroupDuration = function( groupid, startdate){
		
	var data = {duration:0};
	var fRow = function(statement){
			data.duration = statement.getInt64(0);
		};
		
	this.db.select("SELECT SUM(duration) AS sumDuration FROM groups_urls INNER JOIN log ON groups_urls.url_id = log.url_id WHERE duration NOT NULL AND group_id = " + groupid + " AND startdate > " + startdate + " GROUP BY group_id", fRow);
	return data.duration * 1000;
};

StoredProcedures.prototype.getGroupsDuration = function( startdate){
	// Return duration on an url, in ms, in an object: groups[id] = duration
	
	groups = {};
	var fRow = function(statement){
			var duration = 0;
			if( !statement.getIsNull(1) ){
				var id = statement.getInt64(0);
				duration = statement.getInt64(1);
			}
			groups[id] = duration * 1000;
		};
		
	this.db.select("SELECT group_id, SUM(duration) AS sumDuration FROM groups_urls INNER JOIN log ON groups_urls.url_id = log.url_id WHERE startdate > " + startdate + " GROUP BY group_id", fRow);

	return groups;
};


StoredProcedures.prototype.getUngroupedDuration = function(startdate){
	// Return duration on an url, in ms
	data = {duration:0};
	var fRow = function(statement){
			data.duration = statement.getInt64(0);
		};
	
	this.db.select("SELECT SUM(duration) AS sumDuration FROM log LEFT OUTER JOIN groups_urls ON log.url_id=groups_urls.url_id WHERE group_id IS NULL AND startdate > " + startdate, fRow);
	return data.duration * 1000;
};

StoredProcedures.prototype.deleteUrl = function(url){
	// Ensure delete correctly - leave url intact if in group
	
	var urlData = {};
	var fRow = function(statement){
			urlData.id = statement.getInt64(0);
			urlData.inGroup = !statement.getIsNull(1);
		};
	this.db.select( "SELECT urls.id, groups_urls.group_id FROM urls LEFT JOIN groups_urls ON urls.id = groups_urls.url_id WHERE urls.url='" + url + "'", fRow);
	if( !urlData.id && urlData.id!=0 ) return;	// not found

	this.db.execute( "DELETE FROM log WHERE url_id = " + urlData.id );
	
	if( !urlData.inGroup ){
		this.db.execute( "DELETE FROM urls WHERE id = " + urlData.id );
	}
};

StoredProcedures.prototype.addGroupUrl = function(group_id, url_id, url){
	// Get the url id then add
	if(!url_id) url_id = this.getUrlId(url);
	// check id was found; if not; create entry for this url
	if( url_id < 0 ){
		this.db.execute("INSERT INTO urls (url) VALUES('" + url + "')");
		url_id = this.getUrlId(url);
	}
	this.db.execute("DELETE FROM groups_urls WHERE group_id = " + group_id + " AND url_id = " + url_id);	// Ensure its not already there
	this.db.execute("INSERT INTO groups_urls (group_id, url_id) VALUES(" + group_id + ", " + url_id + ")");
};
StoredProcedures.prototype.removeGroupUrl = function(group_id, url_id, url){
	if(!url_id) url_id = this.getUrlId(url);
	this.db.execute("DELETE FROM groups_urls WHERE group_id = " + group_id + " AND url_id = " + url_id );
};
StoredProcedures.prototype.addGroup = function(groupname){
	this.db.execute("INSERT INTO groups (groupname) VALUES('" + groupname + "')");
};
StoredProcedures.prototype.removeGroup = function(group_id){
	// Ensure delete from groups and group_urls
	this.db.execute("DELETE FROM groups WHERE id = " + group_id);
	this.db.execute("DELETE FROM groups_urls WHERE group_id = " + group_id);
};

StoredProcedures.prototype.addMap = function(find, replace){
	this.db.execute("INSERT INTO url_maps (find, replace) VALUES('" + find + "', '" + replace + "')");
};
StoredProcedures.prototype.removeMap = function(find, replace){
	this.db.execute("DELETE FROM url_maps WHERE find = '" + find + "' AND replace = '" + replace + "'");
};

StoredProcedures.prototype.addDeterredSite = function(groupid, shown, ignored, isLink){
	// Deterred sites work by day; so if already one added for today, do an update
	
	if( !shown ) shown = 0;
	if( !ignored ) ignored = 0;
	var isLink = isLink? "1":"0";
	
	var d = new Date();
	var day = d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate();
	
	var data = {found:false}
	var fRow = function(statement){
		if( statement.getInt64(0)>0 ){
			data.found = true;
		}
	}
	this.db.select( "SELECT count(group_id) FROM deterrent_stats WHERE isLink = " + isLink + " AND group_id = " + groupid + " AND date = '" + day + "'", fRow );
	
	if( data.found ){	// do an update
		this.db.execute( "UPDATE deterrent_stats SET shown = shown + " + shown + ", ignored = ignored + " + ignored + " WHERE isLink = " + isLink + " AND group_id = " + groupid + " AND date = '" + day + "'" );
	}else{
		this.db.execute( "INSERT INTO deterrent_stats (group_id, date, shown, ignored, isLink) VALUES (" + groupid + ", '" + day + "', " + shown + ", " + ignored + ", " + isLink + ")" );		
	}
};
StoredProcedures.prototype.getDeterrentUrls = function(){
	var urlData = {};
	var fRow = function(statement){
			var url = statement.getString(0);
			urlData[url] = {'url':url};
			urlData[url].groupId = statement.getIsNull(1)? null : statement.getInt64(1);
		};
	this.db.select( "SELECT urlgroup.url, urlgroup.group_id FROM (SELECT url, group_id FROM groups_urls INNER JOIN urls ON groups_urls.url_id = urls.id) AS urlgroup INNER JOIN deterrents ON urlgroup.group_id = deterrents.group_id", fRow);
	return urlData;
};

StoredProcedures.prototype.getDeterrentLinksUrls = function(){
	var urlData = {};
	var fRow = function(statement){
			var url = statement.getString(0);
			urlData[url] = {'url':url};
			urlData[url].groupId = statement.getIsNull(1)? null : statement.getInt64(1);
		};
	this.db.select( "SELECT urlgroup.url, urlgroup.group_id FROM (SELECT url, group_id FROM groups_urls INNER JOIN urls ON groups_urls.url_id = urls.id) AS urlgroup INNER JOIN deterrentlinks ON urlgroup.group_id = deterrentlinks.group_id", fRow);
	return urlData;
};