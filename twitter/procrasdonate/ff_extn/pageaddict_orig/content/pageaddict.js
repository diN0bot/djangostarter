// PageAddict is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2, or (at your option)
// any later version.

// PageAddict is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details


window.addEventListener('unload',stop_recording, true);
window.addEventListener('focus',start_recording, true);
window.addEventListener('blur',stop_recording, true);
window.addEventListener('mousemove',validate_mouse , true);
window.addEventListener('keydown',validate_mouse , true);

window.addEventListener('load',house_keeping, true);
//window.addEventListener('load',check_get_results, true);
check_restriction();
function register_observers() { 
   document.addEventListener('click',record_activity , true);

   document.addEventListener('scroll',record_activity , true);
   document.addEventListener('keydown',record_activity , true);
   window.addEventListener('keydown',record_activity , true);
//   document.addEventListener('mousemove',record_activity , true);
   
}

function record_activity() {
   window.user_active=true;
}

function monitor_activity() {
   if(window.page_addict_start) {
	if(window.user_active) 
		window.idle_time=0;
	else {
		window.idle_time+=1;
   //GM_log('idle time='+window.idle_time);
}
	if(window.idle_time>30)
		//window.count_seconds+=1;
   if(window.page_addict_start) {
		stop_recording();
}

	} else {
		if(window.user_active) 
			start_recording();
	}

   window.user_active=false;
   //if(window.continue_monitoring)
   //   setTimeout(monitor_activity, 15000);
}

//function start_if_active() {
//	if(window.user_active) 
//		start_recording();
//}



function house_keeping() {
   var href = window.location.host;
   href = href.replace(/\./g, '_');
      if(!(href.match(/pageaddict_com$/))) {
	 check_restriction();
      }

   check_get_results();
   check_latest_version();
//GM_setValue('page_addict_start', false);

       var last_global=GM_getValue('last_visit', 0);
   var first=GM_getValue('first_visit', 0);
      var chover = new Date();
      chover.setHours(0,0,0);
      chover=Math.round(chover.getTime()/1000);
   //GM_log('chover='+chover, ' las');
      if(first<chover) {
	 //alert('resetting, first='+first);
	 reset_visits();	
      }
   //var currentTime = new Date();
   //var t_in_s = Math.round(currentTime.getTime()/1000);

   //GM_setValue('last_visit', t_in_s);
   set_default_idle_mode(); 
}

function check_latest_version() {
   var newest_version;

   if(document.getElementById("newest_version")) {
      newest_version = parseInt(document.getElementById("newest_version").innerHTML,10);     
      if(newest_version>30) { //change to a constant somehow
	 var cell_text;
	 cell_text = "You are running an old version of PageAddict. ";
	 cell_text += 'Update <a href="https://addons.mozilla.org/firefox/3685/">here</a>';
	 document.getElementById("newest_version").innerHTML = cell_text;   
	 document.getElementById("newest_version").style.display="inline";
//	 document.getElementById("newest_version").style.color="#EDCB09"; 
      }
   }
}



function start_recording(no_retry) {
   if(window.page_addict_start) {
        //GM_log('cant start recording: local');
	//return;
   } 
   if(GM_getValue('page_addict_start', false)==true) {
        //GM_log('cant start recording: global');
        if(!no_retry) {
		setTimeout("start_recording(true)", 200);
	}
	return;
   }

        //if(no_retry) 
	   //GM_log('delayed start!');

   var currentTime = new Date();
   var t_in_s = Math.round(currentTime.getTime()/1000);
   window.page_addict_start=t_in_s;
   GM_setValue('page_addict_start', true);

   GM_log('start recording '+window.location.host+' @ '+t_in_s);
   //dump('start recording '+window.location.host);
  //window.page_addict_recording=1; 
   if(GM_getValue('idle_timeout_mode', false)) {
      //window.continue_monitoring=true;
      window.user_active=false;
	window.idle_time=0;
	//window.count_seconds=0;
      if(!(window.interval_id)) {
	   window.interval_id=setInterval(monitor_activity, 1000);
	}
      if(!(window.registered_observers)) {
         register_observers();
	 window.registered_observers=true;
      }

   }
 
}

function validate_mouse() {
   start_recording();
   //window.page_addict_valid=1; 
   window.removeEventListener('mousemove',validate_mouse , true);
	window.removeEventListener('keydown',validate_mouse , true);

}

function stop_recording() {
   if(window.page_addict_start==null) {
        //GM_log('cant stop recording: local');
	//return;
   }
   if(GM_getValue('page_addict_start', false)==false) {
        //GM_log('cant stop recording: global');
	return;
   }

   //if(window.page_addict_valid==null) return; 
   window.continue_monitoring=false;
   var currentTime = new Date();
   var t_in_s = Math.round(currentTime.getTime()/1000);

   //var href = window.location.host;
   var href = get_this_url();
   //href = href.replace(/\./g, '_');
   //alert(href);
   if(href.length==0) return;
   //if(unsafeWindow.page_addict_start==null) return;
   var last=GM_getValue(href+'_last', 0);
   var last_visit=GM_getValue('last_visit', 0);

   //window.continue_monitoring=false;

   if(window.page_addict_start<last_visit || window.page_addict_start==null) {
      GM_log('fatal flaw?');
      window.page_addict_start=null; 
      GM_setValue('page_addict_start', false);
      window.user_active=false;

      return;
   }

   if(t_in_s>last_visit+1 || GM_getValue('idle_timeout_mode', false)) {
      var counts=Math.round(t_in_s-window.page_addict_start);
     // if(GM_getValue('idle_timeout_mode', false)) {
//	 if(window.count_seconds)
//	    counts=window.count_seconds;
//	 else
//	    counts=0;
//
  //    }

   GM_log('stop recording '+window.location.host+' for '+counts);

      GM_setValue(href+'_count', GM_getValue(href+'_count', 0)+counts);
      //GM_log('stopped recording '+href+', '+counts);
      if(last<1)
	 add_to_list(href,'visited');
      GM_setValue(href+'_last', t_in_s);
      GM_setValue('last_visit', t_in_s);
	if(t_in_s%5==0)	
		GM_savePrefs();
   }
   window.page_addict_start=null; 
GM_setValue('page_addict_start', false);
      window.user_active=false;
setTimeout("window.user_active=false",100);
	//if(GM_getValue('idle_timeout_mode', false))
	//	clearInterval(window.interval_id);

	 //window.count_seconds=0;

}

function add_to_list(item, list) {
   GM_setValue(list, GM_getValue(list, '')+item+';');
}

function delete_all_data() {
   if(!confirm('Do you really want to permenantly delete all the data from pageaddict?'))
      return;
   GM_setValue('first_visit', -1);
   reset_visits();

   var tag_list=get_tag_list();
   var i;
   
   for(i=0;i<tag_list.length;i+=1) {
      tag = tag_list[i];
      GM_delValue(tag+'_times');
      GM_delValue(tag+'_spent');
   }
   GM_delValue('ignore_list');
   GM_delValue('tag_list');
	GM_savePrefs();
}

function reset_visits() {
      var first=GM_getValue('first_visit', 0);
   if(first>0)
      store_old_visits();
	var sites_array=GM_getValue('visited', '').split(";");
	GM_setValue('visited', '');
	var currentTime = new Date();
	var t_in_s = Math.round(currentTime.getTime()/1000);
	GM_setValue('last_visit', t_in_s);
	GM_setValue('first_visit', t_in_s);
	var i;
	for(i=0;i<sites_array.length;i+=1) {
		GM_delValue(sites_array[i]+'_count');
		GM_delValue(sites_array[i]+'_last');
	}
	//alert('reset addiction counts');
	GM_savePrefs();
}

function store_old_visits() {
   calculate_time_use();
   var tag_counts=window.tag_counts;
   var tag_list=get_tag_list();
   var i, tag;
   for(i=0;i<tag_list.length;i+=1) {
      tag=tag_list[i];
      GM_setValue(tag+'_times',GM_getValue(tag+'_times','')+GM_getValue('first_visit', 0)+";");
      GM_setValue(tag+'_spent',GM_getValue(tag+'_spent','')+tag_counts[tag]+";");
	
   }

   GM_setValue('total_times',GM_getValue('total_times','')+GM_getValue('first_visit', 0)+";");
   GM_setValue('total_spent',GM_getValue('total_spent','')+window.total+";");

}

function show_hidden_links() {
      if(document.getElementById("history_link")) {
	 document.getElementById("history_link").style.display="block";
      }
  if(document.getElementById("settings_link")) {
	 document.getElementById("settings_link").style.display="block";
      }

   //document.getElementById("settings_link").style.display="block";
}

function check_get_results() {
   var tpage = window.location.host;
   var tpage2 = window.location.href;
   
   //alert(tpage);
   if(tpage.match(/pageaddict\.com$/)) {
   //if(tpage2.match(/pageaddict/)) {
      show_hidden_links();
      if(document.getElementById("insert_statistics_here")) {
	 get_results_html();
      }
      if(document.getElementById("insert_history_here")) {
	 plot_history(7);
      }
      if(document.getElementById("insert_settings_here")) {
	 make_settings();
      }

   }
}

function make_settings() {
   var cell_text='<table><tr><td width="300">';
   var i;
   var ignore_list=GM_getValue('ignore_list','').split(";");
   var tagmatch_list=GM_getValue('tagmatch_list','').split(";");

	if(ignore_list.length>1) {
cell_text+='<h3>List of sites to ignore</h3><table id="ignore_list">';

  for(i=0;i<ignore_list.length-1;i+=1) {
     cell_text+='<tr><td>'+ignore_list[i].replace(/_/g, '.');
     cell_text+='</td><td><a href="#" id="delete_'+ignore_list[i]+'">stop ignoring</a></td></tr>';
  }

   cell_text+='</table>';
	}
   cell_text+='<h3>Tag by match</h3><table id="tagmatch_list"><thead><th>Pattern</th><th>Tag</th><th></th></thead>'; 
  for(i=0;i<tagmatch_list.length-1;i+=1) {
     cell_text+='<tr><td>'+tagmatch_list[i].split("=")[0]+'</td><td>'+tagmatch_list[i].split("=")[1];
     cell_text+='</td><td><a href="#" id="delete_tagmatch_'+tagmatch_list[i].split("=")[0]+'">delete</a></td></tr>';
  }
 cell_text+='<tr id="tagmatch_add_row"><td></td><td></td><td><a href="#" id="add_tagmatch">+Add</a></td></tr>';
 cell_text+='<tr><td>e.g.</td><td></td></tr>';
     cell_text+='<tr><td>facebook</td><td>social';
     cell_text+='</td><td></td></tr>';
 cell_text+='<tr><td colspan="3">=> *.facebook.com tagged with "social"</td></tr>';
 
   cell_text+='</table></td><td>';

   cell_text+='<h3>Delete all data from pageaddict</h3>';
   cell_text+='<a href="#" id="delete_everything">delete everything</a>';
   cell_text+='<h3>Idle timeout mode</h3>';
   if(GM_getValue('idle_timeout_mode', false)) 
      cell_text+='<input id="idle_mode_check" type="checkbox" checked>Enable idle timeout mode';
   else
      cell_text+='<input id="idle_mode_check" type="checkbox">Enable idle timeout mode';

   cell_text+='<br />Time spent in Flash games will not be counted in this mode.';
	cell_text+='</td></tr></table>';
 
   document.getElementById("insert_settings_here").innerHTML=cell_text;
  
  for(i=0;i<ignore_list.length-1;i+=1) {
     document.getElementById("delete_"+ignore_list[i]).addEventListener('click', delete_ignore, true);
  }
   for(i=0;i<tagmatch_list.length-1;i+=1) {
     document.getElementById("delete_tagmatch_"+tagmatch_list[i].split("=")[0]).addEventListener('click', delete_tagmatch, true);
  }
   document.getElementById("delete_everything").addEventListener('click', delete_all_data, true);
   document.getElementById("add_tagmatch").addEventListener('click', add_tagmatch_first, true);
   document.getElementById("idle_mode_check").addEventListener('change', update_idle_mode, true);
}

function add_tagmatch_first() {
	document.getElementById("tagmatch_add_row").innerHTML='<td><input id="match" type="text"></td><td><input id="tag" type="text"></td>';
   document.getElementById("match").addEventListener('change', add_tagmatch_observe, true);
   document.getElementById("tag").addEventListener('change', add_tagmatch_observe, true);
}

function add_tagmatch_observe() {
	var the_tag=document.getElementById("tag").value;
	var the_match=document.getElementById("match").value;
	if(the_tag && the_tag.length>0 && the_match && the_match.length>0) {
		GM_setValue('tagmatch_list',GM_getValue('tagmatch_list','')+the_match+"="+the_tag+";");
   make_settings();

	}
}

function set_default_idle_mode() {
   //alert(navigator.platform);
   if(GM_getValue('idle_timeout_mode', true) && !(GM_getValue('idle_timeout_mode', false))) {
      if (navigator.platform.indexOf("Mac") > -1 ) 
	 GM_setValue('idle_timeout_mode', true);
      else
	 GM_setValue('idle_timeout_mode', false);
   }
}

function update_idle_mode() { 
   if(document.getElementById("idle_mode_check").checked)
      GM_setValue('idle_timeout_mode', true);
   else
      GM_setValue('idle_timeout_mode', false);
}

function delete_ignore(event) {
   var site_name=event.target.id.match(/delete_(.*)/)[1];
   var ignore_list=GM_getValue('ignore_list', '').split(";");
   var new_ignore_list='',i;
   for(i=0;i<ignore_list.length-1;i+=1) {
      if(site_name!=ignore_list[i])
	 new_ignore_list+=ignore_list[i]+';';
   }
   //alert(new_ignore_list);
   GM_setValue('ignore_list', new_ignore_list); 
   make_settings();
}

function delete_tagmatch(event) {
   var site_name=event.target.id.match(/delete_tagmatch_(.*)/)[1];
	//GM_log(site_name);
   var tagmatch_list=GM_getValue('tagmatch_list', '').split(";");
   var new_tagmatch_list='',i;
   for(i=0;i<tagmatch_list.length-1;i+=1) {
      if(site_name!=tagmatch_list[i].split("=")[0])
	 new_tagmatch_list+=tagmatch_list[i]+';';
   }
   //alert(new_ignore_list);
   GM_setValue('tagmatch_list', new_tagmatch_list); 
   make_settings();
}


function change_history_cell(since_days) {
   var cell_text='<p id="history_summary">Minutes you have spent in the past:</p>';
   cell_text+='<table><tr><td colspan="3"><div id="graph" height="300" width="500"></div>';
   cell_text+='<input id="trigger_plot" type="button" onclick="plot_data()" style="display: none">';
   cell_text+='</td><td><div id="insert_legend_here"></div></td></tr><tr><td>';
   cell_text+='<a href="#" id="plot_older">Older</a></td>';
   cell_text+='<td align="center">Days ago</td>';
   cell_text+='<td align="right"><a href="#" id="plot_newer">Newer</a></td>';
   cell_text+='</tr></table><br /><br />';
   cell_text+='<div id="insert_history_here"></div><br />';

   document.getElementById("main_table_cell").innerHTML=cell_text;
   document.getElementById("plot_older").addEventListener('click', function() {
             plot_history(since_days*2);
}, true);
   document.getElementById("plot_newer").addEventListener('click', function() {
             plot_history(Math.round(since_days/2));
}, true);
}
   
function new_plot_history(since_days) {
   if(since_days<2)
      since_days=2;
   change_history_cell(since_days);
   var t=current_time();
   var since=t-60*60*24*since_days;

	var data_array=[],j, tag, days_collection,times, spent,i,tday,ttime;	
   var tag_list=get_tag_list();
	var tag_summary=[];
   var maxy=0,binning=1, xticks=[];

	var day_sum=[];

   for(i=0;i<since_days;i+=1) { 
	day_sum[i]=0;
	}

   if(since_days>10) {
      binning=Math.round(since_days/10);
   }
 
   for(i=0;i<tag_list.length;i+=1) {
      tag=tag_list[i];
	days_collection=[];

      times=GM_getValue(tag+'_times','').split(";");
      spent=GM_getValue(tag+'_spent','').split(";");
      for(j=0;j<times.length-1;j+=1) {
	 if(parseInt(times[j], 10)<since) continue;
	tday=days_after(parseInt(times[j], 10),since);
	days_collection[tday]=parseInt(spent[j], 10);
	day_sum[tday]+=parseInt(spent[j], 10);
		GM_log(tday);

	}
	tag_summary[i]=days_collection;
   }

   for(i=0;i<tag_list.length;i+=1) {
      tag=tag_list[i];
	data_array[i]=[];
  	 for(j=0;j<since_days-1;j+=1) { 
		if(maxy<day_sum[j])
			maxy=day_sum[j];
		if(tag_summary[i][j])
			ttime=tag_summary[i][j]; 
		else 
			ttime=0;
		data_array[i].push([j, 0]);
		data_array[i].push([j+0.01, day_sum[j]/60]);
		data_array[i].push([j+0.98, day_sum[j]/60]);
		data_array[i].push([j+0.99, 0]);
		day_sum[j]-=ttime;

	}


	}

  	 for(j=1;j<since_days;j+=binning) { 
     xticks.push({label: ''+(since_days-j), v: j-1+0.5});
}

	GM_log(tag_summary);
   unsafeWindow.plot_data_array=data_array;
   unsafeWindow.pageaddict_tag_list=tag_list;
   unsafeWindow.plot_since=since;
   unsafeWindow.plot_xticks=xticks;
   unsafeWindow.plot_maxy=maxy/60;

}

function days_after(time, since) {
      the_date=new Date();
      the_date.setTime(time*1000);
      the_date.setHours(0,0,0);
 
return Math.floor((the_date.getTime()/1000-since)/(60*60*24));



}

function plot_history(since_days) {
new_plot_history(since_days);
   if(since_days<2)
      since_days=2;
   change_history_cell(since_days);
   var t=current_time();
   var since=t-60*60*24*since_days;
   var tag_list=get_tag_list();
   var i, tag,j,times, spent, all_times=new Object;
   var all_spent=[];
   var all_times_array=[];
   var all_spent_array=[];
   
   for(i=0;i<tag_list.length;i+=1) {
      all_spent[i]=new Object;
      tag=tag_list[i];
      times=GM_getValue(tag+'_times','').split(";");
      spent=GM_getValue(tag+'_spent','').split(";");
      for(j=0;j<times.length-1;j+=1) {
	 if(parseInt(times[j], 10)<since) continue;
	 all_spent[i][times[j]]=parseInt(spent[j], 10);
	 all_times[times[j]]=1
      }
   }

   var total_times=GM_getValue('total_times','').split(";");
   var total_spent=GM_getValue('total_spent','').split(";");
   var total_object=new Object;
   for(i=0;i<total_times.length-1;i+=1) {
      total_object[total_times[i]]=parseInt(total_spent[i], 10);
   }
   var total_array=[];

   for(var ttime in all_times) all_times_array.push(parseInt(ttime, 10));

   for(i=0;i<all_times_array.length;i+=1) {
      all_spent_array[i]=[];
      for(j=0;j<tag_list.length;j+=1) {
	 if(all_spent[j][''+all_times_array[i]]) 
	    all_spent_array[i].push(all_spent[j][''+all_times_array[i]]);
	 else
	    all_spent_array[i].push(0);
	 
      }
      if(total_object[''+all_times_array[i]])
	 total_array.push(total_object[''+all_times_array[i]]);
      else
	 total_array.push(0);
      
   }

   var data_array=[];
   var this_array, this_sum=[];
   var binning=1;
   var ntimes=all_times_array.length;
   var maxy=0, xticks=[];
   var the_date;

   if(ntimes>10) {
      binning=Math.round(ntimes/10);
   }
   //alert(''+ntimes+' '+binning);

   for(i=0;i<all_times_array.length;i+=1) {
      this_sum.push(0.0);
   }
   for(j=0;j<tag_list.length;j+=1) {
      for(i=0;i<all_times_array.length;i+=1) {
	 this_sum[i]+=(all_spent_array[i][j]/60);
      }
   }
   for(i=0;i<all_times_array.length;i+=1) {
      if(this_sum[i]>maxy) {
	 maxy=this_sum[i];
      }
   }
	
   for(j=0;j<tag_list.length;j+=1) {
      this_array=[];
		
      for(i=0;i<all_times_array.length;i+=1) {
	 the_date=new Date();
	 the_date.setTime(all_times_array[i]*1000);
	 the_date.setHours(0,0,0);

	 this_array.push([Math.floor((the_date.getTime()/1000-since)/(60*60*24)),this_sum[i]]);
	 this_sum[i]-=(all_spent_array[i][j]/60);
      }
      data_array.push(this_array);
   }

	var last_days_ago, this_days_ago, days_to_insert, previously_inserted=0;

   for(i=0;i<all_times_array.length;i+=binning) {
      the_date=new Date();
      the_date.setTime(all_times_array[i]*1000);
      the_date.setHours(0,0,0);
 this_days_ago=Math.floor((t-the_date.getTime()/1000)/(60*60*24));
      xticks.push({label: ''+this_days_ago, v: Math.floor((the_date.getTime()/1000-since)/(60*60*24))});

	if(i>0) {
		days_to_insert=	last_days_ago-this_days_ago-1;
		if(days_to_insert>0) {
			for(j=0;j<days_to_insert;j+=1) {
				//insert zeroin data_array and xticks at position i-1+previously_inserted
			}
			previously_inserted+=days_to_insert;
		}			
	}
	last_days_ago=this_days_ago;

   }

   //var line = new EasyPlot("line", {}, $('graph'), data_array);
//   unsafeWindow.plot_data_array=data_array;
//   unsafeWindow.pageaddict_tag_list=tag_list;
//   unsafeWindow.all_times_array=all_times_array;
//   unsafeWindow.plot_since=since;
//   unsafeWindow.plot_xticks=xticks;
//   unsafeWindow.plot_maxy=maxy;

   
document.getElementById("trigger_plot").click();

   var page_text='';
   page_text+='<table width="500px" id="history_table" cellspacing="0"><tr align="left"><th>Day</th>';
   for(i=0;i<tag_list.length;i+=1) {
      page_text+='<th>'+tag_list[i]+'</th>';
   }
   page_text+='<th>all</th></tr><tbody>';
   var months=['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for(i=all_times_array.length-1;i>0;i-=1) {
     the_date=new Date();
     the_date.setTime(all_times_array[i]*1000);
     //page_text+='<tr><td>'+Math.floor((t-all_times_array[i])/(60*60*24))+'</td>';
     page_text+='<tr><td>'+the_date.getDate()+'-'+months[the_date.getMonth()]+'-'+the_date.getFullYear()+'</td>';
     for(j=0;j<tag_list.length;j+=1) {
	page_text+='<td>'+Math.round(all_spent_array[i][j]/60)+'</td>';
      }
     page_text+='<td>'+Math.round(total_array[i]/60)+'</td></tr>';
  }


   page_text+='</tbody></table>';

   document.getElementById("insert_history_here").innerHTML=page_text;
}


function calculate_time_use() {
   var sites_array=GM_getValue('visited', '').split(";");
   var i, count, alert_str='', total=0;
   var unsort_arr=[];
   var tag_counts=new Object;
   var span=GM_getValue('last_visit', 0)-GM_getValue('first_visit', 0);
   if(span<1) {span=1;}

   var tag_list=GM_getValue('tag_list', '').split(";");
   tag_list.pop();
   tag_list.push("undefined")
   var this_tags, j, found_tag;

   for(i=0;i<tag_list.length;i+=1) {
      tag_counts[tag_list[i]]=0;
   }

   for(i=0;i<sites_array.length-1;i+=1) {
      if(in_ignore_list(sites_array[i])==1) { continue; }
      //if(sites_array[i].length>1) {
      count=GM_getValue(sites_array[i]+'_count', 0);
      //alert_str+=sites_array[i]+': '+(Math.round(count*10/12)/10)+' mins\n';
      unsort_arr.push([sites_array[i], count, Math.round(count*1000/span)/10.0]);
      //}
      total+=count;
      this_tags=get_tag_for_site(sites_array[i]);

	if(this_tags.length>0)
	 tag_counts[this_tags]+=count;
      else
	 tag_counts["undefined"]+=count;
      
      
      
   }

   window.tag_counts=tag_counts;
   window.total=total;
   window.unsort_arr=unsort_arr;
}

function get_results_html() {
   var sites_array=GM_getValue('visited', '').split(";");
   var i, count, alert_str='', total=0;
   var unsort_arr=[];
   var tag_counts=new Object;
   var span=GM_getValue('last_visit', 0)-GM_getValue('first_visit', 0);
   if(span<1) {span=1;}

   var tag_list=GM_getValue('tag_list', '').split(";");
   tag_list.pop();
   tag_list.push("undefined");
   var this_tags, j, found_tag;

   calculate_time_use();

   unsort_arr=window.unsort_arr;
   total=window.total;
   tag_counts=window.tag_counts;

   var sort_arr=unsort_arr.sort(sortf);
   var page_text='';
   var terror=GM_getValue('error', '');
   if(terror.length>0) {
      page_text+='<div id="pa_error">'+terror+'</div>';
      GM_setValue('error', '');
   }
 

   page_text+='<br /><span id="total_summary">';
   page_text+='Total time spent: '+pretty_time(total)+'<br />'+Math.round(total*100/span)+'% of '+pretty_time(span)+' since browser started today</span><br /><br />';
  
   //page_text+='<p>defined tags: '+tag_list;


   page_text+='<table width="500px" id="tags_table" cellspacing="0"><tr align="left"><th>Tag</th><th>Time</th><th>% Total</th><th>Restrict?</th><th>Minutes/day</th><th></th></tr><tbody>';
   for(i=0;i<tag_list.length;i+=1) {
      page_text+='<tr><td>'+tag_list[i]+'</td>';
      page_text+='<td>'+pretty_time(tag_counts[tag_list[i]])+'</td>';
      page_text+='<td>'+Math.round(tag_counts[tag_list[i]]*1000/span)/10.0+'%</td>';
      if(GM_getValue(tag_list[i]+'_restricted', 0)>0) {
	 page_text+='<td align="center"><input id="check_restrict_'+tag_list[i]+'" type="checkbox" checked></td>';
	 page_text+='<td><input id="number_restrict_'+tag_list[i]+'" type="text" value="'+GM_getValue(tag_list[i]+'_max_time', 0)+'" size="5"></td>';
      } else {
	 page_text+='<td align="center"><input id="check_restrict_'+tag_list[i]+'" type="checkbox"></td>';
	 page_text+='<td><input id="number_restrict_'+tag_list[i]+'" type="text" disabled" size="5"></td>';
      }
      page_text+='<td><a href="#" id="delete_tag_'+tag_list[i]+'" style="color: black">delete</a></td></tr>';
   }
   
   page_text+='</tbody></table>';

   page_text+='<br /><span>';
   page_text+='<select id="tag_drop">';
   page_text+='<option value="_ignore">Tag...</option>';
   page_text+='<option value="_new_tag">&nbsp;&nbsp;&nbsp;New tag...</option>';
   page_text+='<option value="_remove_tags">&nbsp;&nbsp;&nbsp;Remove tags</option>';
   page_text+='<option value="_ignore_forever">&nbsp;&nbsp;&nbsp;Ignore site</option>';
   page_text+='<option value="_ignore" disabled>----</option>';
   page_text+='<option value="_ignore" disabled>Apply tag</option>';

   for(i=0;i<tag_list.length-1;i+=1) { //leave undefined tag out
      page_text+='<option value="'+tag_list[i]+'">&nbsp;&nbsp;&nbsp;'+tag_list[i]+'</option>';
   }
   page_text+='</select>';
   page_text+='</span><span>';
   page_text+='<input type="text" id="new_tag_name" style="display: none;">';
   page_text+='</span>';

   page_text+='<br /><table width="500px" id="sites_table" cellspacing="0"><tr align="left"><th></th><th>Site</th><th>Time</th><th>% Total</th><th>Tags</th></tr><tbody>';

  for(i=0;i<sort_arr.length;i+=1) {
     page_text+='<tr><td><input id="check_'+sort_arr[i][0]+'" type="checkbox"></td>';
     page_text+='<td>'+sort_arr[i][0].replace(/__/g, '/').replace(/_/g, '.');
     //page_text+=' "'+sort_arr[i][0]+'" ';
     page_text+='</td>';
      page_text+='<td>'+pretty_time(sort_arr[i][1])+'</td>';
      page_text+='<td>'+sort_arr[i][2]+'%</td><td>'+get_tag_for_site(sort_arr[i][0])+'</td></tr>';
   }
   page_text+='</tbody></table>';
   
   document.getElementById("insert_statistics_here").innerHTML=page_text;
   var add_tag_field=document.getElementById("new_tag_name");
   add_tag_field.addEventListener('change', add_tag, true); 
   var tname;
   for(i=0;i<tag_list.length;i+=1) {
      tname=tag_list[i];
      document.getElementById("check_restrict_"+tag_list[i]).addEventListener('change', update_restriction_policy, true);
      document.getElementById("number_restrict_"+tag_list[i]).addEventListener('change', update_restriction_policy, true);
      document.getElementById("delete_tag_"+tag_list[i]).addEventListener('click', delete_tag, true);
   }
   document.getElementById("tag_drop").addEventListener('change', drop_watch, true);
   //get_results();a
}

function delete_tag(event) {
   var tag_name=event.target.id.match(/delete_tag_(.*)/)[1];
   var tag_list=GM_getValue('tag_list', '').split(";");
   var new_tag_list='',i;
   if(!confirm("Are you sure you want to delete the tag '"+tag_name+"'?"))
      return;
   for(i=0;i<tag_list.length-1;i+=1) {
      if(tag_name!=tag_list[i])
	 new_tag_list+=tag_list[i]+';';
   }
   //alert(new_tag_list);
   var tag_list=GM_setValue('tag_list', new_tag_list); 
   get_results_html();
}

function get_tag_list() {
   var tag_list=GM_getValue('tag_list', '').split(";");
   tag_list.pop();
   tag_list.push("undefined");
   return tag_list;
}

function update_restriction_policy() {
   var tag_list=get_tag_list();
   var element, element2;
   for(i=0;i<tag_list.length;i+=1) {
      element=document.getElementById("check_restrict_"+tag_list[i]);
      if(element && element.checked) {
	 GM_setValue(tag_list[i]+'_restricted', 1);
	 element2=document.getElementById("number_restrict_"+tag_list[i]);
	 if(element2 && parseInt(element2.value, 10)>0) 
	    GM_setValue(tag_list[i]+'_max_time', parseInt(element2.value, 10));	 
      } else {
	 GM_setValue(tag_list[i]+'_restricted', 0);
      }
   }
   get_results_html();
}

function get_this_url() {
   var site = window.location.host;
	
   site = site.replace(/\./g, '_');
   if(site.match(/www_google_com$/)) {
	var path_array=window.location.pathname.split('/');
		if(path_array.length>1 && path_array[1].length>0) { 
			site=site+"__"+path_array[1];
		}
	}

	return site;
}

function get_tag_for_site(site) {
	var tag=GM_getValue(site+'_tags','');
	if(tag[tag.length-1]==';')
		tag=tag.slice(0,-1);

	if(tag.length==0) {
  var tagmatch_list=GM_getValue('tagmatch_list', '').split(";");
   var site2 = site.replace(/__/g, '/').replace(/_/g, '.');

   for(i=0;i<tagmatch_list.length-1;i+=1) {
      if(site2.indexOf(tagmatch_list[i].split("=")[0])>-1) {
	tag=tagmatch_list[i].split("=")[1];
}
}
}
	return tag;

}

function check_restriction() {
	var site=get_this_url();

   if(site.match(/pageaddict_com$/)) return;

   var this_tags=get_tag_for_site(site);
   var i;
   var tags_to_check=[];

   //alert(site);
   if(this_tags.length==0) {
      this_tags='undefined';
   }

      if(GM_getValue(this_tags+'_restricted', 0)>0) {
	 tags_to_check.push(this_tags);
      }
 
   if(tags_to_check.length>0) {
      calculate_time_use();
      var tag_counts=window.tag_counts;
      for(i=0;i<tags_to_check.length;i+=1) {
	 if(tag_counts[tags_to_check[i]]>(GM_getValue(tags_to_check[i]+'_max_time', 0))*60) {
	    enforce_restriction();
	 }
      }
   }
}

function enforce_restriction() {
//   document.body.bgColor='white';
//   document.body.background='none';
//   document.body.style.background='none';
//   document.body.style.color='black';

	var i;
	     for(i=0;i<document.styleSheets.length;i+=1) {
		document.styleSheets[i].disabled=true;

}

   document.body.innerHTML='<p />get back to work!<p />page access blocked by pageaddict';
}

function drop_watch() {
   var menu=document.getElementById("tag_drop").value;
   //alert(menu.value);
   if(menu=='_new_tag') {
      document.getElementById("new_tag_name").style.display='inline';
      document.getElementById("new_tag_name").focus();
      return;
   } 
   document.getElementById("new_tag_name").style.display='inline';
   if(menu=='_remove_tags') {
      remove_tags(menu);
     return;
   }
   if(menu=='_ignore_forever') {
      ignore_forever(menu);
     return;
   }

   if(menu=='_ignore') {
      return;
   }
   apply_tag(menu);

}

function add_tag() {

   var field=document.getElementById("new_tag_name");
   var tag=field.value;

   if(!tag.match(/[a-zA-Z0-9]+/)) {
      GM_setValue('error', 'Invalid tag name');
      get_results_html();
      return;
   }

   var tag_list=GM_getValue('tag_list', '');
   GM_setValue('tag_list', tag_list+tag+';');
	apply_tag(tag);
   get_results_html();
}

function apply_tag(tag) {
   //var tag_list=GM_getValue('tag_list', '');
   //GM_setValue('tag_list', tag_list+tag+';');
   var sites_array=GM_getValue('visited', '').split(";");
   var check;
   for(i=0;i<sites_array.length-1;i+=1) {
      check=document.getElementById("check_"+sites_array[i]);
      if(check && check.checked ) {
	 //if(in_list(tag, sites_array[i]+'_tags')==0)
	 //ensure_in_list(tag, sites_array[i]+'_tags');
	    GM_setValue(sites_array[i]+'_tags', tag+';');
      }
   }
   get_results_html();

}

function ignore_forever() {
   //var tag_list=GM_getValue('tag_list', '');
   //GM_setValue('tag_list', tag_list+tag+';');
   var sites_array=GM_getValue('visited', '').split(";");
   var check;
   for(i=0;i<sites_array.length-1;i+=1) {
      check=document.getElementById("check_"+sites_array[i]);
      if(check && check.checked) {
	 GM_setValue('ignore_list', GM_getValue('ignore_list','')+sites_array[i]+';');
      }
   }
   get_results_html();

}

function ensure_in_list(item, list) {
   if(in_list(item, list)==0)
      add_to_list(item, list);
}

function in_list(item, listn) {
   var list=GM_getValue(listn,'').split(";");
   for(i=0;i<list.length-1;i+=1) {
      if(item==list[i]) {
	 return 1;
      }
   }
   return 0;
}

function in_ignore_list(site) {
   var list=GM_getValue('ignore_list','').split(";");
   for(i=0;i<list.length-1;i+=1) {
      if(site==list[i]) {
	 return 1;
      }
   }
   return 0;
}

function current_time() {
   var currentTime = new Date();
   return Math.round(currentTime.getTime()/1000);

}

function insert_into_array(arr, item, position) {
	var left, right;
	left=arr.splice(0, position);
	right=arr.slice(position+1);
	left.push(item);
	return left.concat([item], right);
	
}

function remove_tags(tag) {
   //var tag_list=GM_getValue('tag_list', '');
   //GM_setValue('tag_list', tag_list+tag+';');
   var sites_array=GM_getValue('visited', '').split(";");
   var check;
   for(i=0;i<sites_array.length-1;i+=1) {
      check=document.getElementById("check_"+sites_array[i]);
      if(check && check.checked) {
	 GM_setValue(sites_array[i]+'_tags', '');
      }
   }
   get_results_html();

}

function sortf(b, a)
{
return ((a[1] < b[1]) ? -1 : ((a[1] > b[1]) ? 1 : 0));
//return a[1] - b[1];
}

function pretty_time(ts) {
	if(ts>3600*2) {
	   return ''+Math.floor(ts/3600)+' hrs '+Math.round((ts-Math.floor(ts/3600)*3600)/60)+' mins';
	} else if(ts>60*2) {
		return ''+Math.round(ts/60)+' minutes';
	} else {
		return ''+Math.round(ts)+' seconds';
	} 
}
