
(function() {
  'use strict';

  /*==================================================================
  Global variables used across
  ==================================================================*/
  const currencyAPIUrlBase = 'https://free.currencyconverterapi.com/api/v5/';
  const convertBtn = $('#convertbtn'), amountInp = $('#amount'), 
        resultView = $('p.result'), fromDrp = $('#from_drp'), toDrp = $('#to_drp');
  let app = {
    currencyList : {},
  };
  /* end of global variable========================================*/

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
  /*end service worker functions====================================*/

  /*==================================================================
  Currency online APi functions
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
    }
  } 
  /*end currency api functions====================================*/

  /*==================================================================
  Currency offline functions
  ==================================================================*/
  app.offlineCurrencyConvert = (data)=>{
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

  /*end currency api functions====================================*/

  /*==================================================================
  Currency functions
  ==================================================================*/

  /*display currency list*/
  app.displayCurrencyList = (lists)=>{
    let htmlstr = '';
    for(let item of Object.keys(lists).sort()){
      let { currencyName } = lists[item];
      let opt = `<option value="${item}">${item} ( ${currencyName} )</option>`;
      htmlstr += opt;
    }
    $('select').html(htmlstr);
    $('select').formSelect();
  }

  /*save rateList to local DB*/
  app.saveRateLocal = (rateList)=>{
    window.localforage.setItem('rateList', rateList.sort());
  }

  /*save rate logic*/
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
    //calculate rate
    const result = parseFloat(amount) * parseFloat(val);
    resultView.html(result.toFixed(2));
    M.toast({html: `result: ${result.toFixed(2)}`});
  }
  
  app.event = ()=>{

    convertBtn.on('click', function(){
      const amount = amountInp.val();
      const from = fromDrp.val();
      const to = toDrp.val();
      if(amount.length == 0){
        //display error
        M.toast({html: 'Please specify amount!'});
        return;
      }
      app.Api().convertCurrency(from,to).then((data)=>{
        app.computeResult(data,amount);
        //save to loacal DB
        app.saveRate(data);
      }).catch((err)=>{
        //when error try local DB        
        app.offlineCurrencyConvert(`${from}_${to}`).then((data)=>{
          app.computeResult(data,amount);
        }).catch((err)=>{
          M.toast({html: `${err}` });
        });

      });
    });

  }

  /* app.init */
  app.init = ()=>{
    //call sw registration
    app.registerServiceWorker();
    //currency list check
    window.localforage.getItem('currencyList', function(err, list) {
      if (list) {
        console.log('offline list ', list);
        //display ui
        app.displayCurrencyList(list);
      } else {        
        app.Api().getCurrencyList().then((data)=>{
          window.localforage.setItem('currencyList', data);
          console.log('online list ', data);
          //display ui
          app.displayCurrencyList(data);
        });
      }
    }); 
  }

  document.addEventListener('DOMContentLoaded', function() {
    app.init();
    app.event();
  });
  
})();
