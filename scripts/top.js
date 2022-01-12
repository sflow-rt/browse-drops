// author: InMon Corp.
// version: 1.1
// date: 1/12/2022
// description: Browse Drops
// copyright: Copyright (c) 2020-2022 InMon Corp. ALL RIGHTS RESERVED

include(scriptdir()+'/inc/trend.js');

var SEP = '_SEP_';

var aggMode  = getSystemProperty('browse-drops.aggMode')  || 'sum';
var maxFlows = getSystemProperty('browse-drops.maxFlows') || 10;
var minValue = getSystemProperty('browse-drops.minValue') || 0.0;
var agents   = getSystemProperty('browse-drops.agents')   || 'ALL';
var t        = getSystemProperty('browse-drops.t')        || 2;

var userFlows = {};

var specID = 0;
function flowSpec(keys,value,filter) {
  var keysStr = keys ? keys.join(',') : '';
  var valueStr = value ? value.join(',') : '';
  var filterStr = filter ? filter.join('&') : '';

  if(keysStr.length === 0 || valueStr.length === 0) return null;

  var key = keysStr || '';
  if(valueStr) key += '#' + valueStr;
  if(filterStr) key += '#' + filterStr;
  var entry = userFlows[key];
  if(!entry) {
    // try to create flow
    var name = 'browse_drops' + specID;
    try {
      setFlow(name,{keys:keysStr, value:valueStr, filter: filterStr.length > 0 ? filterStr : null, t:t, n:maxFlows, fs:SEP, dropped: true});
      entry = {name:name, trend: new Trend(300,1)};
      entry.trend.addPoints(Date.now(), {topn:{}});
      userFlows[key] = entry;
      specID++;
    } catch(e) {
      entry = null;
    }
  }
  if(!entry) return null;
  entry.lastQuery = Date.now();

  return entry;
}

setIntervalHandler(function(now) {
  var key, entry, top, topN, i;
  for(key in userFlows) {
    entry = userFlows[key];
    if(now - entry.lastQuery > 10000) {
      clearFlow(entry.name);
      delete userFlows[key];
    } else {
      topN = {};
      top = activeFlows(agents,entry.name,maxFlows,minValue,aggMode);
      if(top) {
        for(i = 0; i < top.length; i++) {
          topN[top[i].key] = top[i].value;
        }
      }
      entry.trend.addPoints(now,{topn:topN}); 
    }
  }
}, 1);

setHttpHandler(function(req) {
  var result, key, search, matcher, trend, key, entry, path = req.path;
  if(!path || path.length === 0) throw "not_found";
     
  switch(path[0]) {
    case 'flowkeys':
      if(path.length > 1) throw "not_found";
      result = [];
      search = req.query['search'];
      if(search) {
        matcher = new RegExp('^' + search[0].replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&'), 'i');
        result = Object.keys(flowKeys()).filter((k) => matcher.test(k));
      } else {
        result = Object.keys(flowKeys());
      }
      result.sort();
      break;
    case 'flows':
      if(path.length > 1) throw "not_found";
      entry = flowSpec(req.query['keys'],req.query['value'],req.query['filter']);
      if(!entry) throw 'bad_request';
      trend = entry.trend;
      result = {};
      result.trend = req.query.after ? trend.after(parseInt(req.query.after)) : trend;
      break;
    default: throw 'not_found';
  } 
  return result;
});

