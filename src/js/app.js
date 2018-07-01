
(function() {
  'use strict';

  /*==================================================================
  global variables used across
  ==================================================================*/
  const el = $('#app');
  const currencyAPIUrlBase = 'https://free.currencyconverterapi.com/api/v5/';
  const template = {
    rates: Handlebars.compile($('#converter-template').html()),
    store: Handlebars.compile($('#localstore-template').html()),
    history: Handlebars.compile($('#history-template').html())
  }
  window.app = {
    container: document.querySelector('.container-fluid'),
    spinner: document.querySelector('.loader'),
    pageTitle: document.querySelector  ('.brand-logo'),
    isLoading: true,
  };

  /*==================================================================
  service worker functions below 
  ==================================================================*/
  app.registerServiceWorker = ()=>{
    if (!navigator.serviceWorker) return;

    navigator.serviceWorker.register('/currency_converter/service-worker.js').then((reg)=> {
      if (!navigator.serviceWorker.controller) {
        return;
      }

      if (reg.waiting) {
        console.log('[ServiceWorker] is waiting - call update sw');
        app.updateWorker(reg.waiting);
        return;
      }

      if (reg.installing) {
        console.log('[ServiceWorker] is installing - call to track Installing sw');
        app.trackInstalling(reg.installing);
        return;
      }

      reg.addEventListener('updatefound', ()=> {
        console.log('[ServiceWorker] is installing - call to track Installing sw');
        app.trackInstalling(reg.installing);
      });
    });
  };
  app.trackInstalling = (worker)=> {
    worker.addEventListener('statechange', function() {
      console.log('[ServiceWorker] statechange -trackInstalling');
      if (worker.state == 'installed') {
        app.updateWorker(worker);
      }
    });
  };
  app.updateWorker = (worker)=> {
    console.log('[ServiceWorker] action to update worker called -skipWaiting');
    worker.postMessage({action: 'skipWaiting'});
  };

  /*==================================================================
  Currency APi functions
  ==================================================================*/
  app.Api = ()=>{
    return {
      getCurrencyList: ()=>{
        return new Promise((resolve,reject)=>{
          fetch(`${currencyAPIUrlBase}currencies?`).then((response)=>{ 
            response.json().then((data)=>{
                resolve(data.results);
              });
          }).catch((e)=> {
              reject(e.message);
          });
        });
      },
      convertCurrency: (from,to)=>{
        return new Promise((resolve,reject)=>{
          fetch(`${currencyAPIUrlBase}convert?q=${from}_${to}&compact=ultra`).then((response)=>{ 
            response.json().then((data)=>{
                resolve(data);
              });
          }).catch((e)=> {
              reject(e.message);
          });
        });
      },
      getHistoricalData: (from,to,date)=>{
        return new Promise((resolve,reject)=>{
          fetch(`${currencyAPIUrlBase}convert?q=${from}_${to}&compact=ultra&date=${date}`).then((response)=>{ 
            response.json().then((data)=>{
                resolve(data);
              });
          }).catch((e)=> {
              reject(e.message);
          });
        });
      },
      offlineConvert: (data)=>{
        const key = data;
        const errMsg = `Fetch failed: device not connected`;
        return new Promise((resolve,reject)=>{
          window.localforage.getItem('rateList', function(err, rates) {
            if (rates) {
              let exist = rates.filter((rateObj)=>{
                return (Object.keys(rateObj)[0] == key);
              });
              (exist.length > 0) ? resolve(exist[0]) : reject(errMsg);
            }else{
              reject(errMsg);
            }        
          }); 
        })
      }
    }
  } 

  /*==================================================================
  app route and view
  ==================================================================*/
  app.switchView = (view,temp,cb)=>{
    app.spinner.removeAttribute('hidden');
    app.container.setAttribute('hidden',true);
    app.isLoading = true;

    // Highlight Active Menu on Load
    $('.menu').removeClass('active');
    $(`[href="${view}"]`).addClass('active');

    localStorage.setItem('view',view);    
    switch(view){
      case 'currency_view':
        app.pageTitle.innerHTML = 'Currency Converter';
        app.Api().getCurrencyList().then((data)=>{
          window.localforage.setItem('currencyList', data);
          app.displayCurrencyList(data,temp);
        });
      break;
      case 'store_view':
        app.pageTitle.innerHTML = 'Rates Store';
        
        window.localforage.getItem('rateList', function(err, list) {
          if (list) {
            app.displayGrid(list,temp);
          } else {        
            app.displayGrid([],temp);
            app.showToast(`Oops! Local store is empty`,`info`);
          }
        }); 
      break;
      case 'history_view':
        app.pageTitle.innerHTML = 'Historical Data';
        app.Api().getCurrencyList().then((data)=>{
          window.localforage.setItem('currencyList', data);
          app.displayCurrencyList(data,temp);
          $('#date').datepicker();
        });
      break;
    }
    (cb && cb !== undefined && typeof(cb) == 'function') && cb();
  } 

  /*==================================================================
  Utility functions
  ==================================================================*/
  app.addCommas = function (nStr) {
      nStr += '';
      let x = nStr.split('.'),
      x1 = x[0],
      x2 = x.length > 1 ? '.' + x[1] : '';
      const rgx = /(\d+)(\d{3})/;
      while (rgx.test(x1)) {
          x1 = x1.replace(rgx, '$1' + ',' + '$2');
      }
      return x1 + x2;
  };
  app.displayCurrencyList = (lists,temp)=>{
    const context = {
      currency_list: ((items)=>{
        const arrayList = []; 
        if($.isEmptyObject(items)) return arrayList;
        for(let i of Object.keys(items).sort()){
          let obj = {};
          let { id, currencyName, currencySymbol } = items[i];
          obj.id = id;
          obj.name = currencyName;
          obj.symbol = currencySymbol;
          arrayList.push(obj);
        }
        return arrayList;
      })(lists),      
    }
    el.html(temp(context));
    $('select').select2({width:'100%'});

    if (app.isLoading) {
      app.spinner.setAttribute('hidden', true);
      app.container.removeAttribute('hidden');
      app.isLoading = false;
    }
  }
  app.displayGrid = (lists,temp)=>{
    const context = {
      ratesList: ((items)=>{
        const arrayList = []; 
        if(items.length == 0) return arrayList;
        for(const t of items.sort()){
          const from = Object.keys(t)[0].split('_')[0];
          const to = Object.keys(t)[0].split('_')[1];
          const ratevalue = parseFloat(t[Object.keys(t)[0]]);
          const rate = /^0\./.test(ratevalue)? app.addCommas(ratevalue.toFixed(4)) 
                : app.addCommas(ratevalue.toFixed(2));
          const obj = {};
          obj.from = from;
          obj.to = to;
          obj.rate = rate;
          obj.ratevalue = ratevalue;
          arrayList .push(obj);
        }
        return arrayList;
      })(lists),      
    }
    el.html(temp(context));
    if (app.isLoading) {
      app.spinner.setAttribute('hidden', true);
      app.container.removeAttribute('hidden');
      app.isLoading = false;
    }
  }
  app.saveRateLocal = (rateList)=>{
    window.localforage.setItem('rateList', rateList.sort());
  }
  app.saveRate = (data)=>{
    const key = Object.keys(data)[0];
    const val = data[key];

    window.localforage.getItem('rateList', function(err, rates) {
      if (rates) {
        let exist = rates.filter((rateObj)=>{
          return (Object.keys(rateObj)[0] == key);
        });

        if(exist.length > 0){
          //update rate if item exists in the local DB
          const newRateList = rates.map((obj)=>{
            let newobj = {}; newobj[key] = val;
            return Object.keys(obj)[0] == key ? newobj : obj;
          });
          app.saveRateLocal(newRateList);
        }else{
          //insert rate if item does not exists in the local DB
          rates.push(data);
          app.saveRateLocal(rates);
        }

      } else {        
        //create localDB -rateList and add item for the first time
        let rateList = [];
        rateList.push(data);
        app.saveRateLocal(rateList);
      }
    }); 
  }
  app.computeResult = (data,amount,symbol)=>{
    const key = Object.keys(data)[0];
    const val = data[key];
    const resultView = $(document ).find('p.result');
    const convertBtn  = $(document).find('#convertbtn');
    //calculate rate
    const result = parseFloat(amount) * parseFloat(val);
    /^0\./.test(result) ? resultView.html(`${symbol} ${app.addCommas(parseFloat(result).toFixed(4))}`) 
          : resultView.html(`${symbol} ${app.addCommas(parseFloat(result).toFixed(2))}`);  
    convertBtn.html('Convert');
  }
  app.formatDate = (date)=>{
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth()+ 1}-${d.getDate()}`;
  }
  app.showToast = (msg,type)=>{
    const infoClass = (type !== undefined) ? type.toLowerCase() == 'error' ? 'red-text' 
        : type.toLowerCase() == 'success' ? 'teal-text' : 'blue-text'
      : 'blue-text';
    const icon = (type !== undefined) ? type.toLowerCase() == 'error' ? 'error' 
        : type.toLowerCase() == 'success' ? 'check_circle' : 'info'
      : 'info';
    const str = `<div class="left" style="display: inherit !important;"><i class="material-icons ${infoClass}">${icon}</i>${msg}</div>`;
    const options = {
      html: str,
      displayLength: 3000,      
    }    
    return M.toast(options);
  }
  app.event = ()=>{

    $(document).on('click','#convertbtn', function(){
        const amountInp = $('#amount'), resultView = $('p.result'), fromDrp = $('#from_drp'), toDrp = $('#to_drp');
        const $el = $(this);
        const amount = amountInp.val();
        const from = fromDrp.val();
        const to = toDrp.val();
        const sym = toDrp.find('option:selected').data('symbol');
        const symbol = (sym == '') ? to : sym;
        //reset result view
        resultView.html('0.00');
        if(amount.length == 0){
          app.showToast('Please specify amount!');
          resultView.html('0.00');
          return;
        }
        //for same currency e.g NGN to NGN
        if(from === to){
          resultView.html(`${symbol} ${app.addCommas(parseFloat(amount).toFixed(2))}`);
          return
        }
        $el.html('Converting...');
        app.Api().convertCurrency(from,to).then((data)=>{
          app.computeResult(data,amount,symbol);
          //save to loacal DB
          app.saveRate(data);
        }).catch((err)=>{
          //when error try local DB        
          app.Api().offlineConvert(`${from}_${to}`).then((data)=>{
            app.computeResult(data,amount,symbol);
          }).catch((err)=>{
            app.showToast(`${err}: device is not connected`,'error');
            resultView.html('0.00');
            $el.html('Convert');
          });

        });
    });

     $(document).on('click','.rate_item', function(){
        const target = $(this);
        const from_id = target.attr('data-from');
        const to_id = target.attr('data-to');
        const rate = parseFloat(target.attr('data-rate'));

        app.switchView('currency_view',template.rates, ()=>{
          
          const target = $(this);
          $('.menu').removeClass('active');
          $('[href="currency_view"]').addClass('active');
          
          setTimeout(()=>{
            const amountInp = $(document).find('#amount'), resultView = $(document).find('p.result'), 
                fromDrp = $(document).find('#from_drp'), toDrp = $(document).find('#to_drp');

            amountInp.val(1).focus();  
            fromDrp.val(from_id);
            fromDrp.select2('destroy').select2({width:'100%'});
            toDrp.val(to_id);
            toDrp.select2('destroy').select2({width:'100%'});
            const sym = toDrp.find('option:selected').data('symbol');
            const symbol = (sym == '') ? toDrp.val() : sym;

            /^0\./.test(rate) ? resultView.html(`${symbol} ${app.addCommas(rate.toFixed(4))}`) 
                  : resultView.html(`${symbol} ${app.addCommas(rate.toFixed(2))}`);
          },300);  
        });
     });

     $(document).on('click','#checkbtn', function(){
        const resultView = $('p.historyResult'), fromDrp = $('#from_drp2'), toDrp = $('#to_drp2');
        const from = fromDrp.val(), to = toDrp.val(), date = $('#date').val();
        const $el = $(this);
        //clear resultview
        resultView.html(``);

        if(date.length == 0){
          app.showToast('Please pick a date','info');
          return;
        }
        $el.html(`Checking...`);
        const formatted_date = app.formatDate(date);

        app.Api().getHistoricalData(from,to,formatted_date).then((data)=>{
          console.log(data);
          const key = Object.keys(data)[0];

          if(key == 'status'){
            const {error} = data;
            app.showToast(`${error}`);
            resultView.html(`${error}`);
            $el.html(`Check`);
            return;
          }

          const dateObj = data[key];
          const dateKey = Object.keys(dateObj)[0];
          const rate = dateObj[dateKey];
          const result = /^0\./.test(rate) ? app.addCommas(parseFloat(rate).toFixed(4)) : app.addCommas(parseFloat(rate).toFixed(2));

          resultView.html(`1 ${from} is equivalent to ${result} of ${to} from ${date} to ${date}`);
          $el.html(`Check`);

        }).catch((err)=>{          
          app.showToast(`${err}`);
          $el.html(`Check`);
          resultView.html(``);
        });

     });

    $('a.menu').on('click', function(event) {
      // Block page load
      event.preventDefault();

      // Highlight Active Menu on Click
      const target = $(this);
      $('.menu').removeClass('active');
      target.addClass('active');

      // Navigate to clicked view
      const href = target.attr('href');
      const temp = target.attr('data-temp');
      app.switchView(href,template[temp]);
    });
  }
  /* app.init */
  app.init = ()=>{
    //expose all event
    app.event();
    //register service worker
    app.registerServiceWorker();
    //initial view
    const view = localStorage.getItem('view') != 'null' ? localStorage.getItem('view') : 'currency_view';
    const temp = ((view == 'currency_view') ? template.rates : ((view == 'store_view') ? template.store : template.history));
    app.switchView(view,temp);
  }

  document.addEventListener('DOMContentLoaded', function() {
    app.init();

    const elems = document.querySelectorAll('.fixed-action-btn');
    const instances = M.FloatingActionButton.init(elems, {
        toolbarEnabled: true
    });
    
  });
  
})();
