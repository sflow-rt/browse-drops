$(function() { 
  var keys = [
    'reason',
    'function',
    'agent',
    'datasource',
    'inputifindex',
    'macsource',
    'macdestination',
    'vlan',
    'priority',
    'ethernetprotocol',
    'ipsource',
    'ipdestination',
    'ipdscp',
    'ipprotocol',
    'icmptype',
    'icmpcode',
    'ip6source',
    'ip6destination',
    'ip6dscp',
    'ip6nexthdr',
    'icmp6type',
    'icmp6code',
    'tcpsourceport',
    'tcpdestinationport',
    'udpsourceport',
    'udpdestinationport'
  ];

  $('a[href="#"]').on('click', function(e) {
    e.preventDefault();
  });

  var SEP = ',';

  var maxPoints = 5 * 60;
  var step = 1000;
  var db = {};

  var defaults = {keys:'', filter: ''};
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
    return window.sessionStorage.getItem('flow_browser_'+key) || state[key] || defVal;
  }

  function setState(key, val, showQuery) {
    state[key] = val;
    window.sessionStorage.setItem('discard_browser_'+key, val);
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
    if(q) {
      var parts = split(q,sep_keys);
      var prefix = parts[0];
      var suffix = parts[1];
      var matcher = new RegExp('^' + suffix);
      var suggestions = keys.filter((el) => matcher.test(el));
      if(suggestions.length === 1 && suggestions[0] === suffix) return;
      suggestions = suggestions.map((el) => prefix + el);
      sync(suggestions);
    } else {
      sync(keys);
    }
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

  var sep_filter = '&';
  function filterSuggestions(q, sync, async) {
    if(q) {
      var parts = split(q,sep_filter);
      var prefix = parts[0];
      var suffix = parts[1];
      var matcher = new RegExp('^' + suffix);
      var suggestions = keys.filter((el) => matcher.test(el));
      if(suggestions.length === 1 && suggestions[0] === suffix) return;
      suggestions = suggestions.map((el) => prefix + el);
      sync(suggestions);
    } else {
      sync(keys);
    } 
  }

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

  var running_topflows;
  var timeout_topflows;
  function pollTopFlows() {
    running_topflows = true;
    $.ajax({
      url: '../../../dropped/ALL/dropped_2/10/' + top_keys + '/json?' + top_filter,
      success: function(data) {
        if(running_topflows) {
          updateData(data);
          timeout_topflows = setTimeout(pollTopFlows, step);
        }
      },
      error: function(result,status,errorThrown) {
        if(running_topflows) timeout_topflows = setTimeout(pollTopFlows, 5000);
      }
    });
  }

  function resetChart() {
    db.trend = {times:[], trends: {topn: []}};
    var i, t = Date.now();
    for(i = 0; i < maxPoints; i++) {
      t = t - step;
      db.trend.times.unshift(t);
    }
    for(i = 0; i < db.trend.times.length; i++) db.trend.trends.topn.push({});
  }

  function updateData(data) {
    if(!data || data.length === 0) return;

    var now = Date.now();
    db.trend.times.push(now);

    var tmin = now - (maxPoints * 1.04 * step);
    var nshift = 0;
    while(db.trend.times.length >= maxPoints || db.trend.times[0] < tmin) {
      db.trend.times.shift();
      nshift++;
    }
    var topn = db.trend.trends.topn;
    var entry = {};
    for(var i = 0; i < data.length; i++) {
      entry[data[i].key] = data[i].value;
    }
    topn.push(entry);
    for(var i = 0; i < nshift; i++) {
      topn.shift();
    }    

    $.event.trigger({type:'updateChart'});
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
    }

    if(!top_keys) {
      $('#help').show();
      $('#topn').hide();
      return;
    }

    resetChart();
    $('#topn').chart({
      type: 'topn',
      legendHeadings: top_keys.match(/(\\.|[^,])+/g),
      units:'Frames per Second',
      stack: true,
      sep: SEP,
      metric: 'topn'
    }, db);

    $('#help').hide();
    $('#topn').show();
    pollTopFlows();
  }

  $('#reset').click(function() {
    $('#keys').typeahead('val','');
    $('#value').typeahead('val','');
    $('#filter').typeahead('val','');
    top_keys = '';
    top_filter = '';
    setState('keys',top_keys);
    setState('filter',top_filter,true);
    emptyTopFlows();
  });

  $('#submit').click(function() {
    top_keys = $.trim($('#keys').typeahead('val')).replace(/(,$)/g, "");
    top_filter = $.trim($('#filter').typeahead('val'));
    setState('keys',top_keys);
    setState('filter',top_filter,true);
    emptyTopFlows();   
  });

  function addFilter(key,value,filter) {
    var newFilter = filter;
    if(!newFilter) newFilter = "";
    if(newFilter.length > 0) newFilter += "&";
    newFilter += key + "=" + value;
    $('#filter').typeahead('val',newFilter);	 
    top_filter = newFilter;
    setState('filter', top_filter, true);
    emptyTopFlows();
  }

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
