function DB(){
	var file = Components.classes["@mozilla.org/file/directory_service;1"]
						.getService(Components.interfaces.nsIProperties)
						.get("ProfD", Components.interfaces.nsIFile);
	file.append("meetimer.sqlite");

	var storageService = Components.classes["@mozilla.org/storage/service;1"]
							.getService(Components.interfaces.mozIStorageService);
	this.mDBConn = storageService.openDatabase(file);
}

DB.prototype.select = function(sql, f){
	//alert("select:\n" + sql);
	try{
	var statement = this.mDBConn.createStatement(sql);
	// Process
	while( statement.executeStep() ){
		f( statement );
	}
	statement.reset();
	}catch(e){
		//alert("Fail Select\n" + sql + "\n\n\n" + e.toString());
	}
};

DB.prototype.execute = function(sql){
	//alert("execute:\n" + sql);
	try{
	this.mDBConn.executeSimpleSQL(sql);
	}catch(e){
		//alert("Fail Select\n" + sql);
	}
};


DB.prototype.destroy = function(){
	// Close the connection
	
};