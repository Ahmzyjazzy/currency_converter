
(function() {
  'use strict';

  /*==================================================================
  global variables used across
  ==================================================================*/
  const el = $('#app');
  const currencyAPIUrlBase = 'https://free.currencyconverterapi.com/api/v5/';
  const template = {
    rates: Handlebars.compile($('#converter-template').html()),
    store: Handlebars.compile($('#localstore-template').html())
  }
  let app = {
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

    navigator.serviceWorker.register('/service-worker.js').then((reg)=> {
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
      offlineConvert: (data)=>{
        const key = data;
        return new Promise((resolve,reject)=>{
          window.localforage.getItem('rateList', function(err, rates) {
            if (rates) {
              let exist = rates.filter((rateObj)=>{
                return (Object.keys(rateObj)[0] == key);
              });
              (exist.length > 0) ? resolve(exist[0]) : reject(`Fetch failed: Please try connect to the internet`);
            }else{
              reject(`Fetch failed: Please try connect to the internet`);
            }        
          }); 
        })
      }
    }
  } 

  /*==================================================================
  app route and view
  ==================================================================*/
  app.switchView = (view,temp)=>{
    switch(view){
      case 'currency_view':
        app.pageTitle.innerHTML = 'Currency Converter';
        app.Api().getCurrencyList().then((data)=>{
          window.localforage.setItem('currencyList', data);
          //display ui
          console.log(data);
          app.displayCurrencyList(data,temp);
        }); 
      break;
      case 'store_view':
        app.pageTitle.innerHTML = 'Rates Store';
        
        window.localforage.getItem('rateList', function(err, list) {
          if (list) {
            //display ui
            app.displayGrid(list,temp);
          } else {        
            M.toast({html: `Oops! Local store is empty` });
          }
        }); 
      break;
    }
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
        for(const t of items.sort()){
          const from = Object.keys(t)[0].split('_')[0];
          const to = Object.keys(t)[0].split('_')[1];
          const ratevalue = parseFloat(t[Object.keys(t)[0]]);
          const rate = /^0\./.test(ratevalue)? app.addCommas(ratevalue.toFixed(4)) : app.addCommas(ratevalue.toFixed(2));
          const obj = {};
          obj.from = from;
          obj.to = to;
          obj.rate = rate;
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
  app.computeResult = (data,amount)=>{
    const key = Object.keys(data)[0];
    const val = data[key];
    const resultView = $(document ).find('p.result');
    const convertBtn  = $(document).find('#convertbtn');
    //calculate rate
    const result = parseFloat(amount) * parseFloat(val);
    /^0\./.test(result) ? resultView.html(app.addCommas(result.toFixed(4))) : resultView.html(app.addCommas(result.toFixed(2)));    
    // M.toast({html: `result: ${result.toFixed(2)}`});
    convertBtn.html('Convert');
  }
  app.event = ()=>{
    // Highlight Active Menu onLoad
    const link = $(`a[href$='${window.location.pathname}']`);
    link.addClass('active');

    $(document).on('click','#convertbtn', function(){
        const amountInp = $('#amount'), resultView = $('p.result'), fromDrp = $('#from_drp'), toDrp = $('#to_drp');
        const $el = $(this);
        const amount = amountInp.val();
        const from = fromDrp.val();
        const to = toDrp.val();
        if(amount.length == 0){
          //display error
          M.toast({html: 'Please specify amount!'});
          return;
        }
        //for same currency e.g NGN to NGN
        if(from === to){
          resultView.html(app.addCommas(parseFloat(amount).toFixed(2)));
          return
        }
        $el.html('Converting...');
        app.Api().convertCurrency(from,to).then((data)=>{
          app.computeResult(data,amount);
          //save to loacal DB
          app.saveRate(data);
        }).catch((err)=>{
          //when error try local DB        
          app.Api().offlineConvert(`${from}_${to}`).then((data)=>{
            app.computeResult(data,amount);
          }).catch((err)=>{
            M.toast({html: `${err}` });
            resultView.html('0.00');
            $el.html('Convert');
          });

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
    app.switchView('currency_view',template.rates);
  }

  document.addEventListener('DOMContentLoaded', function() {
    app.init();

    const elems = document.querySelectorAll('.fixed-action-btn');
    const instances = M.FloatingActionButton.init(elems, {
        toolbarEnabled: true
      });
    });
  
})();
