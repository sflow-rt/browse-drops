$(function() { 
  var restPath =  '../scripts/top.js/';
  var keysURL = restPath + 'flowkeys/json';
  var topURL = restPath + 'flows/json';
  var defsURL = restPath + 'defs/json';

  $('a[href="#"]').on('click', function(e) {
    e.preventDefault();
  });

  var SEP = '_SEP_';

  var db = {};

  var defaults = {keys:'', value: '', filter: ''};
  var state = {};
  $.extend(state, defaults);

  function createQuery(params) {
    var query, key, value;
    for(key in params) {
      value = params[key];
      if(value === defaults[key]) continue;
      if(query) query += '&';
      else query = '';
      query += encodeURIComponent(key)+'='+encodeURIComponent(value);
    }
    return query;
  }

  function getState(key, defVal) {
    return window.sessionStorage.getItem('drop_browser_'+key) || state[key] || defVal;
  }

  function setState(key, val, showQuery) {
    state[key] = val;
    window.sessionStorage.setItem('drop_browser_'+key, val);
    if(showQuery) {
      var query = createQuery(state);
      window.history.replaceState({},'', query ? 'index.html?' + query : 'index.html');
    }
  }

  function setQueryParams(query) {
    var vars = query.split('&');
    var params = {};
    for(var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if(pair.length === 2) setState(decodeURIComponent(pair[0]), decodeURIComponent(pair[1]),false);
    }
  }

  var search = window.location.search;
  if(search) setQueryParams(search.substring(1));

  var top_keys = getState('keys','');
  var top_value = getState('value','');
  var top_filter = getState('filter','');

  $('#clone').click(function() {
     window.open(window.location);
  });

  function split(str,pat) {
    var re = new RegExp(pat,'g');
    var end = 0;
    while(re.test(str)) { end = re.lastIndex; }
    return [ str.substring(0,end), str.substring(end) ];
  }

  var sep_keys = ',';
  function keySuggestions(q, sync, async) {
    var parts = split(q,sep_keys);
    var prefix = parts[0];
    var suffix = parts[1];

    $.getJSON(keysURL, { search: suffix }, function(suggestedToken) {
      if(suggestedToken.length === 1 && suggestedToken[0] === suffix) return;
      var suggestions = [];
      for (var i = 0; i < suggestedToken.length; i++) {
        suggestions.push(prefix + suggestedToken[i]); 
      }
      async(suggestions); 
    });
  }

  var values = ['bps','Bps','fps'];
  function valueSuggestions(q,sync) {
    if(q) {
      var matcher = new RegExp('^' + q);
      var suggestions = values.filter((el) => matcher.test(el));
      if(suggestions.length === 1 && suggestions[0] === q) return;
      sync(suggestions);
    } else {
      sync(values);
    }
  }

  var sep_filter = '[&|(]';
  function filterSuggestions(q, sync, async) {
    var parts = split(q,sep_filter);
    var prefix = parts[0];
    var suffix = parts[1]; 
    $.getJSON(keysURL, { search: suffix }, function(suggestedToken) {
      if(suggestedToken.length === 1 && suggestedToken[0] === suffix) return;
      var suggestions = [];
      for (var i = 0; i < suggestedToken.length; i++) {
        suggestions.push(prefix + suggestedToken[i]);
      }
      async(suggestions); 
    });
  }

  $('#keys')
    .val(top_keys)
    .typeahead(
      {
        highlight: true,
        minLength: 0,
      },
      {
        name: 'keys',
        source: keySuggestions,
        limit: 200,
        display: (a) => split(a,sep_keys)[1]
      }
    )
    .bind('typeahead:active', function() {
      this.scrollLeft = this.scrollWidth;
      var input = this;
      setTimeout(function() { input.setSelectionRange(1000,1000); }, 1);
    })
    .bind('typeahead:cursorchange', function(evt,suggestion) {
      $(this).typeahead('val',$(this).typeahead('val'));
      this.scrollLeft = this.scrollWidth;
    })
    .bind('typeahead:autocomplete', function(evt,suggestion) {
      $(this).typeahead('val', suggestion);
      this.scrollLeft = this.scrollWidth;
    })
    .bind('typeahead:select', function(evt,suggestion) {
      $(this).typeahead('val', suggestion);
      this.scrollLeft = this.scrollWidth;
    });
  $('#value')
    .val(top_value)
    .typeahead(
      {
        highlight: true,
        minLength: 0
      },
      {
        name: 'value',
        source: valueSuggestions
      }
    );
  $('#filter')
    .val(top_filter)
    .typeahead(
      {
        highlight: true,
        minLength: 0
      },
      {
        name: 'filter',
        source: filterSuggestions,
        limit: 200,
        display: (a) => split(a,sep_filter)[1]
      }
    )
    .bind('typeahead:active', function() {
      this.scrollLeft = this.scrollWidth;
      var input = this;
      setTimeout(function() { input.setSelectionRange(1000,1000); }, 1);
    })
    .bind('typeahead:cursorchange', function(evt,suggestion) {
      $(this).typeahead('val',$(this).typeahead('val'));
      this.scrollLeft = this.scrollWidth;
    })
    .bind('typeahead:autocomplete', function(evt,suggestion) {
      $(this).typeahead('val',suggestion + '=');
      this.scrollLeft = this.scrollWidth;
    })
    .bind('typeahead:select', function(evt,suggestion) {
      $(this).typeahead('val',suggestion + '=');
      this.scrollLeft = this.scrollWidth;
    });

  function valueToKey(val) {
    var key;
    switch(val) {
    case 'bps': 
      key = 'bytes'; 
      break;
    case 'Bps': 
      key = 'bytes'; 
      break;
    case 'fps': 
      key = 'frames'; 
      break;
    default: 
      key = val;
    }
    return key;
  }

  function valueToScale(val) {
    return 'bps' === val ? 8 : 1;
  }

  function valueToTitle(val) {
    var title;
    switch(val) {
    case 'bps': 
      title = 'Bits per Second'; 
      break;
    case 'bytes':
      case 'Bps': 
      title = 'Bytes per Second'; 
      break;
    case 'frames':
      case 'fps': 
      title  = 'Frames per Second'; 
      break;
    case 'requests':
      title = 'Requests per Second';
      break;
    default: 
      title = val;
    }
    return title;
  }

  function addFilter(key, value, filter) {
    var newFilter = filter;
    if(!newFilter) newFilter = "";
    if(newFilter.length > 0) newFilter += "&";
    newFilter += "'" + key + "'='" + value + "'";
    $('#filter').typeahead('val',newFilter);	 
    top_filter = newFilter;
    setState('filter', top_filter, true);
    emptyTopFlows();
  }

  function updateData(data,scale) {
    if(!data 
      || !data.trend 
      || !data.trend.times 
      || data.trend.times.length == 0) return;

    if(scale !== 1) {
      var topn = data.trend.trends.topn;
      for(var i = 0; i < topn.length; i++) {
        var entry = topn[i];
        for(var flow in entry) {
          entry[flow]*=scale;
        }
      }
    }

    if(db.trend) {
      // merge in new data
      var maxPoints = db.trend.maxPoints;
      var remove = db.trend.times.length > maxPoints ? db.trend.times.length - maxPoints : 0;
      db.trend.times = db.trend.times.concat(data.trend.times);
      if(remove) db.trend.times = db.trend.times.slice(remove);
      for(var name in db.trend.trends) {
        db.trend.trends[name] = db.trend.trends[name].concat(data.trend.trends[name]);
        if(remove) db.trend.trends[name] = db.trend.trends[name].slice(remove);
      }
    } else db.trend = data.trend;

    db.trend.start = new Date(db.trend.times[0]);
    db.trend.end = new Date(db.trend.times[db.trend.times.length - 1]);

    $.event.trigger({type:'updateChart'});
  }

  var running_topflows;
  var timeout_topflows;
  function pollTopFlows() {
    running_topflows = true;
    var query = {keys:top_keys,value:valueToKey(top_value),filter:top_filter};
    if(db.trend && db.trend.end) query.after=db.trend.end.getTime();
    var scale = valueToScale(top_value);
    $.ajax({
      url: topURL,
      data: query,
      success: function(data) {
        if(running_topflows) {
          updateData(data,scale);
          timeout_topflows = setTimeout(pollTopFlows, 1000);
        }
      },
      error: function(result,status,errorThrown) {
        if(running_topflows) timeout_topflows = setTimeout(pollTopFlows, 5000);
      }
    });
  }

  function stopPollTopFlows() {
    running_topflows = false;
    if(timeout_topflows) clearTimeout(timeout_topflows);
  }

  function emptyTopFlows() {
    stopPollTopFlows();
    if(db.trend) {
      $(document).off('updateChart');
      $('#topn').stripchart('destroy');
      $('#topn').empty();
      delete db.trend;
      $('#delete').prop('disabled',true);
      $('#save').prop('disabled',true);
    }

    if(!top_keys || !top_value) {
      $('#help').show();
      $('#topn').hide();
      return;
    }

    if(!db.trend) {
       $('#topn').chart({
          type: 'topn',
          legendHeadings: top_keys.match(/(\\.|[^,])+/g),
          units:valueToTitle(top_value),
          stack: true,
          sep: SEP,
          metric: 'topn'
       },db);
    }

    $('#help').hide();
    $('#topn').show();
    var query = {keys:top_keys,value:valueToKey(top_value),filter:top_filter};
    pollTopFlows();
  }

  $('#reset').click(function() {
    $('#keys').typeahead('val','');
    $('#value').typeahead('val','');
    $('#filter').typeahead('val','');
    top_keys = '';
    top_value = '';
    top_filter = '';
    setState('keys',top_keys);
    setState('value',top_value);
    setState('filter',top_filter,true);
    emptyTopFlows();
  });

  $('#submit').click(function() {
    top_keys = $.trim($('#keys').typeahead('val')).replace(/(,$)/g, "");
    top_value = $.trim($('#value').typeahead('val'));
    top_filter = $.trim($('#filter').typeahead('val'));
    setState('keys',top_keys);
    setState('value',top_value);
    setState('filter',top_filter,true);
    emptyTopFlows();   
  });

  $('#topn').click(function(e) {
    var idx,key,val,tgt = $(e.target);
    if(tgt.is('td')) {
      idx = tgt.index() - 1;
      key = top_keys.match(/(\\.|[^,])+/g)[idx];
      val = tgt.text();
      addFilter(key,val,top_filter);
    }
    else if(tgt.is('div') && tgt.parent().is('td')) {
      var row = tgt.parent().parent();
      row.children().each(function(i,td) {
        if(i>0) {
          idx = i - 1;
          key = top_keys.match(/(\\.|[^,])+/g)[idx];
          val = $(td).text();
          addFilter(key,val,top_filter);
        }
      });
    }
  });

  emptyTopFlows();
  
});
